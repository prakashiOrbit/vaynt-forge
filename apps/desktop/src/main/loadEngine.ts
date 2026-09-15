import { performance } from 'node:perf_hooks'
import { Pool } from 'undici'
import { resolveRequest, collectVariables } from '@vayntforge/engine'
import type { PerfSample, PerfTestConfig, RequestModel } from '@vayntforge/engine'
import type { VariableScopes } from '../shared/types'

/**
 * Sprint 11 — the load engine: fires `request` at real concurrency (one
 * shared `undici.Pool` per run, sized to `concurrency` so connections are
 * genuinely reused, not opened per request) with an optional linear ramp-up.
 * The request is resolved (variables + auth) once up front, same as
 * `UndiciRequestClient`, and repeated as-is — a load test targets one
 * endpoint shape, not a per-iteration variable sweep.
 */

const FLUSH_INTERVAL_MS = 200

const cancelFns = new Map<string, () => void>()

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

export function cancelLoadTest(runId: string): void {
  cancelFns.get(runId)?.()
}

export function startLoadTest(
  runId: string,
  request: RequestModel,
  scopes: VariableScopes,
  config: PerfTestConfig,
  onProgress: (batch: PerfSample[]) => void,
  onDone: (samples: PerfSample[], durationMs: number) => void
): void {
  const resolved = resolveRequest(request, collectVariables(scopes))
  const url = new URL(resolved.url)
  const concurrency = Math.max(1, config.concurrency)
  const pool = new Pool(url.origin, { connections: concurrency })

  let cancelled = false
  let dispatched = 0
  const samples: PerfSample[] = []
  let progressBuffer: PerfSample[] = []
  const startedAt = performance.now()
  let lastFlush = startedAt

  const flush = (): void => {
    if (progressBuffer.length === 0) return
    onProgress(progressBuffer)
    progressBuffer = []
    lastFlush = performance.now()
  }

  const fireOne = async (): Promise<void> => {
    const t0 = performance.now()
    let status = 0
    try {
      const res = await pool.request({
        path: url.pathname + url.search,
        method: resolved.method as never,
        headers: resolved.headers,
        body: resolved.body,
      })
      status = res.statusCode
      await res.body.dump().catch(() => undefined)
    } catch {
      status = 0
    }
    const sample: PerfSample = { timestamp: Date.now(), latencyMs: performance.now() - t0, status, ok: status > 0 && status < 400 }
    samples.push(sample)
    progressBuffer.push(sample)
    if (performance.now() - lastFlush > FLUSH_INTERVAL_MS) flush()
  }

  const timeBoxed = typeof config.durationSec === 'number' && config.durationSec > 0
  const deadline = timeBoxed ? startedAt + config.durationSec! * 1000 : undefined

  const worker = async (index: number): Promise<void> => {
    if (config.rampUpSec > 0) {
      await sleep((index / concurrency) * config.rampUpSec * 1000)
    }
    while (!cancelled) {
      if (deadline !== undefined) {
        if (performance.now() >= deadline) return
      } else {
        if (dispatched >= config.totalRequests) return
        dispatched++
      }
      await fireOne()
    }
  }

  cancelFns.set(runId, () => {
    cancelled = true
  })

  void Promise.all(Array.from({ length: concurrency }, (_, i) => worker(i))).then(async () => {
    flush()
    cancelFns.delete(runId)
    await pool.close().catch(() => undefined)
    onDone(samples, performance.now() - startedAt)
  })
}
