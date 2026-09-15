import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computePercentiles, summarizeRun, capSamples, diagnoseFailure } from '../src/index.ts'
import type { PerfSample, ResponseModel } from '../src/index.ts'

test('computePercentiles returns zeros for an empty sample set', () => {
  assert.deepEqual(computePercentiles([]), { p50: 0, p90: 0, p95: 0, p99: 0 })
})

test('computePercentiles picks the nearest-rank value for a known distribution', () => {
  const latencies = Array.from({ length: 100 }, (_, i) => i + 1) // 1..100
  const p = computePercentiles(latencies)
  assert.equal(p.p50, 50)
  assert.equal(p.p90, 90)
  assert.equal(p.p95, 95)
  assert.equal(p.p99, 99)
})

test('summarizeRun computes rps, avg latency, and error rate from real samples', () => {
  const samples: PerfSample[] = [
    { timestamp: 0, latencyMs: 100, status: 200, ok: true },
    { timestamp: 1, latencyMs: 200, status: 200, ok: true },
    { timestamp: 2, latencyMs: 300, status: 500, ok: false },
    { timestamp: 3, latencyMs: 400, status: 200, ok: true },
  ]
  const result = summarizeRun(samples, 2000)
  assert.equal(result.totalRequests, 4)
  assert.equal(result.successful, 3)
  assert.equal(result.failed, 1)
  assert.equal(result.requestsPerSec, 2)
  assert.equal(result.avgLatencyMs, 250)
  assert.equal(result.errorRate, 0.25)
})

test('capSamples evenly downsamples a large run to the cap', () => {
  const samples: PerfSample[] = Array.from({ length: 5000 }, (_, i) => ({
    timestamp: i,
    latencyMs: i,
    status: 200,
    ok: true,
  }))
  const capped = capSamples(samples, 500)
  assert.equal(capped.length, 500)
  // still spans the full run, not just the first 500
  assert.ok(capped[capped.length - 1]!.timestamp > 4000)
})

test('capSamples leaves a small run untouched', () => {
  const samples: PerfSample[] = [{ timestamp: 0, latencyMs: 10, status: 200, ok: true }]
  assert.equal(capSamples(samples, 500).length, 1)
})

function response(overrides: Partial<ResponseModel>): ResponseModel {
  return {
    status: 200,
    statusText: 'OK',
    headers: {},
    bodyText: '',
    size: 100,
    timeMs: 50,
    timing: { dns: 0, connect: 0, tls: 0, wait: 0, download: 0, total: 50 },
    cookies: [],
    redirects: [],
    ...overrides,
  }
}

test('diagnoseFailure gives real, distinct causes for a 500', () => {
  const d = diagnoseFailure(response({ status: 500, statusText: 'Internal Server Error' }), 'https://api.acme.dev/orders')
  assert.equal(d.isNetworkError, false)
  assert.ok(d.title.includes('500'))
  assert.ok(d.causes.length > 0)
  assert.ok(d.causes.some((c) => /database|exception|deploy/i.test(c)))
})

test('diagnoseFailure gives auth-specific causes for a 401', () => {
  const d = diagnoseFailure(response({ status: 401, statusText: 'Unauthorized' }), 'https://api.acme.dev/orders')
  assert.ok(d.causes.some((c) => /auth/i.test(c)))
})

test('diagnoseFailure treats a client error (no HTTP status) as a network failure', () => {
  const d = diagnoseFailure(
    response({ status: 0, statusText: 'Error', error: { code: 'ENOTFOUND', message: 'not found' } }),
    'https://bogus.invalid/x'
  )
  assert.equal(d.isNetworkError, true)
  assert.ok(d.causes.some((c) => /unreachable|does not exist/i.test(c)))
})

test('diagnoseFailure warns on a slow response', () => {
  const d = diagnoseFailure(response({ timeMs: 5000 }), 'https://api.acme.dev/x')
  assert.ok(d.warnings.some((w) => /slower/i.test(w)))
})

test('diagnoseFailure warns on plain HTTP to a non-local host', () => {
  const d = diagnoseFailure(response({}), 'http://api.acme.dev/x')
  assert.ok(d.warnings.some((w) => /https/i.test(w)))
})

test('diagnoseFailure does not warn on plain HTTP to localhost', () => {
  const d = diagnoseFailure(response({}), 'http://localhost:4010/x')
  assert.ok(!d.warnings.some((w) => /https/i.test(w)))
})

test('diagnoseFailure has no causes or warnings for a fast, well-formed 200', () => {
  const d = diagnoseFailure(
    response({ headers: { 'content-type': 'application/json' }, bodyText: '{"ok":true}' }),
    'https://api.acme.dev/x'
  )
  assert.equal(d.causes.length, 0)
  assert.equal(d.warnings.length, 0)
})
