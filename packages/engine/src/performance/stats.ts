import type { PerfPercentiles, PerfResult, PerfSample } from '../types/performance'

/**
 * Sprint 11 — pure statistics over a load test's samples. Nearest-rank
 * percentile (no interpolation): simplest correct definition, and matches
 * what k6/wrk report closely enough for a dev tool.
 */
export function computePercentiles(latenciesMs: number[]): PerfPercentiles {
  if (latenciesMs.length === 0) return { p50: 0, p90: 0, p95: 0, p99: 0 }
  const sorted = [...latenciesMs].sort((a, b) => a - b)
  const at = (p: number): number => {
    const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)
    return sorted[Math.max(0, idx)] ?? 0
  }
  return { p50: at(50), p90: at(90), p95: at(95), p99: at(99) }
}

export function summarizeRun(samples: PerfSample[], durationMs: number): PerfResult {
  const successful = samples.filter((s) => s.ok).length
  const failed = samples.length - successful
  const latencies = samples.map((s) => s.latencyMs)
  const avgLatencyMs = latencies.length === 0 ? 0 : latencies.reduce((a, b) => a + b, 0) / latencies.length
  return {
    totalRequests: samples.length,
    successful,
    failed,
    requestsPerSec: durationMs > 0 ? (samples.length / durationMs) * 1000 : 0,
    avgLatencyMs,
    percentiles: computePercentiles(latencies),
    errorRate: samples.length > 0 ? failed / samples.length : 0,
    durationMs,
  }
}

/** Downsamples to at most `max` points (evenly spaced) for chart storage — a
 * 5,000-request run shouldn't persist 5,000 chart points. */
export function capSamples(samples: PerfSample[], max = 500): PerfSample[] {
  if (samples.length <= max) return samples
  const step = samples.length / max
  const out: PerfSample[] = []
  for (let i = 0; i < max; i++) {
    const sample = samples[Math.floor(i * step)]
    if (sample) out.push(sample)
  }
  return out
}
