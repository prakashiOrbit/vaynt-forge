import type { HttpMethod } from './request'

/**
 * Sprint 11 — performance/load testing types. A run targets a saved request
 * (so it inherits headers/auth/variable resolution for free via
 * `resolveRequest`), fired at real concurrency with an optional ramp-up.
 */
export interface PerfTestConfig {
  requestId: string
  environmentId?: string
  /** Total requests to fire. Ignored if `durationSec` is set (time-boxed run instead). */
  totalRequests: number
  concurrency: number
  /** Spread worker start times linearly across this many seconds (0 = all at once). */
  rampUpSec: number
  /** When set, the run keeps firing requests for this long instead of a fixed count. */
  durationSec?: number
}

export interface PerfSample {
  timestamp: number
  latencyMs: number
  status: number
  ok: boolean
}

export interface PerfPercentiles {
  p50: number
  p90: number
  p95: number
  p99: number
}

export interface PerfResult {
  totalRequests: number
  successful: number
  failed: number
  requestsPerSec: number
  avgLatencyMs: number
  percentiles: PerfPercentiles
  errorRate: number
  durationMs: number
}

export type PerfRunStatus = 'running' | 'completed' | 'cancelled'

export interface PerformanceRun {
  id: string
  workspaceId: string
  name: string
  config: PerfTestConfig
  status: PerfRunStatus
  result?: PerfResult
  /** Capped, downsampled series kept for the charts — see `capSamples`. */
  samples: PerfSample[]
  createdAt: number
  updatedAt: number
}

/** Used by the request builder / debugger to label a run's target. */
export interface PerfTargetInfo {
  method: HttpMethod
  url: string
}
