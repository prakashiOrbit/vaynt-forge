import { create } from 'zustand'
import { summarizeRun, capSamples } from '@vayntforge/engine'
import type { PerfSample, PerformanceRun, RequestModel } from '@vayntforge/engine'
import { toast } from '@vayntforge/ui'
import { useData } from './data'
import type { VariableScopes } from '../../../shared/types'

/**
 * Sprint 11 — live load-test progress, fed by `window.vayntforge.performance`.
 * Mirrors `mockRuntime.ts`: the store is the source of truth for samples
 * while a run is in flight (avoids a DB write per request/progress batch);
 * the persisted `PerformanceRun` row is the source of truth once it finishes.
 */
interface PerfRuntimeState {
  liveSamples: Record<string, PerfSample[]>
  running: Record<string, boolean>
  cancelling: Record<string, boolean>
  /** The run row being started, kept until `onDone` so it can be finalized with a result. */
  pendingRuns: Record<string, PerformanceRun>
  cancelledIds: Set<string>
  _bound: boolean
  bind(): void
  start(run: PerformanceRun, request: RequestModel, scopes: VariableScopes): Promise<void>
  cancel(runId: string): Promise<void>
}

const SAMPLE_CAP = 500

export const usePerfRuntime = create<PerfRuntimeState>()((set, get) => ({
  liveSamples: {},
  running: {},
  cancelling: {},
  pendingRuns: {},
  cancelledIds: new Set(),
  _bound: false,

  bind: () => {
    if (get()._bound) return
    set({ _bound: true })

    window.vayntforge.performance.onProgress((runId, batch) => {
      set((s) => ({
        liveSamples: { ...s.liveSamples, [runId]: [...(s.liveSamples[runId] ?? []), ...batch] },
      }))
    })

    window.vayntforge.performance.onDone((runId, samples, durationMs) => {
      const run = get().pendingRuns[runId]
      const cancelled = get().cancelledIds.has(runId)
      set((s) => {
        const cancelledIds = new Set(s.cancelledIds)
        cancelledIds.delete(runId)
        const pendingRuns = { ...s.pendingRuns }
        delete pendingRuns[runId]
        return {
          running: { ...s.running, [runId]: false },
          cancelling: { ...s.cancelling, [runId]: false },
          cancelledIds,
          pendingRuns,
        }
      })
      if (!run) return
      const result = summarizeRun(samples, durationMs)
      void useData.getState().savePerformanceRun({
        ...run,
        status: cancelled ? 'cancelled' : 'completed',
        result,
        samples: capSamples(samples, SAMPLE_CAP),
      })
      toast.success(
        cancelled ? 'Performance run cancelled' : 'Performance run complete',
        `${result.totalRequests} requests · ${result.requestsPerSec.toFixed(1)} req/s · ${(result.errorRate * 100).toFixed(1)}% errors`
      )
    })
  },

  start: async (run, request, scopes) => {
    set((s) => ({
      running: { ...s.running, [run.id]: true },
      liveSamples: { ...s.liveSamples, [run.id]: [] },
      pendingRuns: { ...s.pendingRuns, [run.id]: run },
    }))
    await useData.getState().savePerformanceRun(run)
    try {
      await window.vayntforge.performance.start(run.id, request, scopes, run.config)
    } catch (err) {
      set((s) => ({ running: { ...s.running, [run.id]: false } }))
      toast.error('Failed to start performance run', err instanceof Error ? err.message : String(err))
    }
  },

  cancel: async (runId) => {
    set((s) => {
      const cancelledIds = new Set(s.cancelledIds)
      cancelledIds.add(runId)
      return { cancelledIds, cancelling: { ...s.cancelling, [runId]: true } }
    })
    await window.vayntforge.performance.cancel(runId)
  },
}))
