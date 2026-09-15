import { useMemo } from 'react'
import { Square } from 'lucide-react'
import { Chart, Button } from '@vayntforge/ui'
import { summarizeRun } from '@vayntforge/engine'
import type { PerfSample, PerformanceRun } from '@vayntforge/engine'

function StatTile({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'err' | 'warn' }) {
  const toneClass = tone === 'ok' ? 'text-ok' : tone === 'err' ? 'text-err' : tone === 'warn' ? 'text-warn' : 'text-text'
  return (
    <div className="rounded border border-border bg-raised px-3 py-2">
      <div className="text-[10px] font-semibold uppercase text-faint">{label}</div>
      <div className={`mt-0.5 font-mono text-[16px] font-semibold ${toneClass}`}>{value}</div>
    </div>
  )
}

/** Buckets samples into 1-second windows, keyed by elapsed second from the first sample. */
function bucketBySecond(
  samples: PerfSample[]
): { second: number; count: number; avgLatency: number; errorRate: number }[] {
  if (samples.length === 0) return []
  const t0 = samples[0]!.timestamp
  const buckets = new Map<number, { count: number; totalLatency: number; failed: number }>()
  for (const s of samples) {
    const second = Math.floor((s.timestamp - t0) / 1000)
    const bucket = buckets.get(second) ?? { count: 0, totalLatency: 0, failed: 0 }
    bucket.count += 1
    bucket.totalLatency += s.latencyMs
    if (!s.ok) bucket.failed += 1
    buckets.set(second, bucket)
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([second, b]) => ({ second, count: b.count, avgLatency: b.totalLatency / b.count, errorRate: b.failed / b.count }))
}

function statusGroups(samples: PerfSample[]): { label: string; count: number; color: string }[] {
  const groups = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0, error: 0 }
  for (const s of samples) {
    if (s.status === 0) groups.error += 1
    else if (s.status < 300) groups['2xx'] += 1
    else if (s.status < 400) groups['3xx'] += 1
    else if (s.status < 500) groups['4xx'] += 1
    else groups['5xx'] += 1
  }
  return [
    { label: '2xx', count: groups['2xx'], color: '#22c55e' },
    { label: '3xx', count: groups['3xx'], color: '#60a5fa' },
    { label: '4xx', count: groups['4xx'], color: '#f59e0b' },
    { label: '5xx', count: groups['5xx'], color: '#ef4444' },
    { label: 'network error', count: groups.error, color: '#94a3b8' },
  ].filter((g) => g.count > 0)
}

export function PerfResultsView({
  run,
  liveSamples,
  isRunning,
  cancelling,
  onCancel,
}: {
  run: PerformanceRun
  liveSamples: PerfSample[] | undefined
  isRunning: boolean
  cancelling: boolean
  onCancel(): void
}) {
  const samples = isRunning ? (liveSamples ?? []) : run.samples
  const result = useMemo(
    () => run.result ?? (samples.length > 0 ? summarizeRun(samples, samples[samples.length - 1]!.timestamp - samples[0]!.timestamp) : undefined),
    [run.result, samples]
  )
  const buckets = useMemo(() => bucketBySecond(samples), [samples])
  const groups = useMemo(() => statusGroups(samples), [samples])

  const latencyOption = {
    grid: { left: 48, right: 16, top: 24, bottom: 28 },
    xAxis: { type: 'category' as const, data: buckets.map((b) => `${b.second}s`), name: 'Elapsed' },
    yAxis: { type: 'value' as const, name: 'ms' },
    series: [{ type: 'line' as const, data: buckets.map((b) => Math.round(b.avgLatency)), smooth: true, showSymbol: false, color: '#60a5fa' }],
    tooltip: { trigger: 'axis' as const },
  }

  const rpsOption = {
    grid: { left: 48, right: 16, top: 24, bottom: 28 },
    xAxis: { type: 'category' as const, data: buckets.map((b) => `${b.second}s`), name: 'Elapsed' },
    yAxis: { type: 'value' as const, name: 'req/s' },
    series: [{ type: 'bar' as const, data: buckets.map((b) => b.count), color: '#a78bfa' }],
    tooltip: { trigger: 'axis' as const },
  }

  const errorRateOption = {
    grid: { left: 48, right: 16, top: 24, bottom: 28 },
    xAxis: { type: 'category' as const, data: buckets.map((b) => `${b.second}s`), name: 'Elapsed' },
    yAxis: { type: 'value' as const, name: '%', max: 100 },
    series: [
      { type: 'line' as const, data: buckets.map((b) => Math.round(b.errorRate * 100)), smooth: true, showSymbol: false, color: '#ef4444' },
    ],
    tooltip: { trigger: 'axis' as const },
  }

  const distributionOption = {
    grid: { left: 90, right: 24, top: 16, bottom: 24 },
    xAxis: { type: 'value' as const },
    yAxis: { type: 'category' as const, data: groups.map((g) => g.label) },
    series: [
      {
        type: 'bar' as const,
        data: groups.map((g) => ({ value: g.count, itemStyle: { color: g.color } })),
      },
    ],
    tooltip: { trigger: 'axis' as const },
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-[13px] font-semibold text-text">{run.name}</div>
          <div className="text-[11px] text-faint">
            {run.config.concurrency}x concurrency · {run.config.durationSec ? `${run.config.durationSec}s duration` : `${run.config.totalRequests} requests`}
            {run.config.rampUpSec > 0 ? ` · ${run.config.rampUpSec}s ramp-up` : ''}
          </div>
        </div>
        {isRunning && (
          <Button size="sm" variant="outline" onClick={onCancel} disabled={cancelling}>
            <Square className="h-3 w-3" /> {cancelling ? 'Cancelling…' : 'Cancel'}
          </Button>
        )}
      </div>

      {!result ? (
        <div className="flex-1 text-center text-[12px] text-faint">Waiting for the first responses…</div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-2">
            <StatTile label="Requests/sec" value={result.requestsPerSec.toFixed(1)} />
            <StatTile label="Avg latency" value={`${result.avgLatencyMs.toFixed(0)}ms`} />
            <StatTile label="Successful" value={String(result.successful)} tone="ok" />
            <StatTile label="Failed" value={String(result.failed)} tone={result.failed > 0 ? 'err' : undefined} />
          </div>
          <div className="mt-2 grid grid-cols-4 gap-2">
            <StatTile label="P50" value={`${result.percentiles.p50.toFixed(0)}ms`} />
            <StatTile label="P90" value={`${result.percentiles.p90.toFixed(0)}ms`} />
            <StatTile label="P95" value={`${result.percentiles.p95.toFixed(0)}ms`} />
            <StatTile label="P99" value={`${result.percentiles.p99.toFixed(0)}ms`} />
          </div>
          <div className="mt-2">
            <StatTile
              label="Error rate"
              value={`${(result.errorRate * 100).toFixed(1)}%`}
              tone={result.errorRate > 0.05 ? 'err' : result.errorRate > 0 ? 'warn' : 'ok'}
            />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <div className="mb-1 text-[11px] font-semibold uppercase text-faint">Latency over time</div>
              <Chart option={latencyOption} height={200} />
            </div>
            <div>
              <div className="mb-1 text-[11px] font-semibold uppercase text-faint">Requests/sec over time</div>
              <Chart option={rpsOption} height={200} />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <div className="mb-1 text-[11px] font-semibold uppercase text-faint">Error rate over time</div>
              <Chart option={errorRateOption} height={180} />
            </div>
            <div>
              <div className="mb-1 text-[11px] font-semibold uppercase text-faint">Response distribution</div>
              <Chart option={distributionOption} height={180} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
