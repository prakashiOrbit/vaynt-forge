import { useState, type ReactNode } from 'react'
import { Play } from 'lucide-react'
import { Button } from '@vayntforge/ui'
import type { Environment, PerfTestConfig, RequestModel } from '@vayntforge/engine'

export interface PerfConfigFormValue {
  requestId: string
  environmentId: string
  totalRequests: number
  concurrency: number
  rampUpSec: number
  useDuration: boolean
  durationSec: number
}

const DEFAULT_VALUE: PerfConfigFormValue = {
  requestId: '',
  environmentId: '',
  totalRequests: 200,
  concurrency: 10,
  rampUpSec: 0,
  useDuration: false,
  durationSec: 30,
}

function field(label: string, children: ReactNode) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold uppercase text-faint">{label}</div>
      {children}
    </div>
  )
}

const inputClass = 'h-8 w-full rounded border border-border bg-bg-input px-2 text-[12px] text-text'

export function PerfConfigForm({
  requests,
  environments,
  starting,
  onStart,
}: {
  requests: RequestModel[]
  environments: Environment[]
  starting: boolean
  onStart(config: PerfTestConfig): void
}) {
  const [value, setValue] = useState<PerfConfigFormValue>(DEFAULT_VALUE)
  const patch = (p: Partial<PerfConfigFormValue>) => setValue((v) => ({ ...v, ...p }))
  const request = requests.find((r) => r.id === value.requestId)

  const handleStart = () => {
    if (!value.requestId) return
    const config: PerfTestConfig = {
      requestId: value.requestId,
      environmentId: value.environmentId || undefined,
      totalRequests: Math.max(1, value.totalRequests),
      concurrency: Math.max(1, value.concurrency),
      rampUpSec: Math.max(0, value.rampUpSec),
      durationSec: value.useDuration ? Math.max(1, value.durationSec) : undefined,
    }
    onStart(config)
  }

  return (
    <div className="space-y-4 p-4">
      {field(
        'Target request',
        <select value={value.requestId} onChange={(e) => patch({ requestId: e.target.value })} className={inputClass}>
          <option value="">Select a saved request…</option>
          {requests.map((r) => (
            <option key={r.id} value={r.id}>
              {r.method} {r.name}
            </option>
          ))}
        </select>
      )}
      {request && <div className="-mt-2 truncate font-mono text-[11px] text-faint">{request.url}</div>}

      {field(
        'Environment',
        <select value={value.environmentId} onChange={(e) => patch({ environmentId: e.target.value })} className={inputClass}>
          <option value="">No environment</option>
          {environments.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      )}

      <div className="grid grid-cols-2 gap-3">
        {field(
          'Concurrency',
          <input
            type="number"
            min={1}
            value={value.concurrency}
            onChange={(e) => patch({ concurrency: Number(e.target.value) || 1 })}
            className={inputClass}
          />
        )}
        {field(
          'Ramp-up (seconds)',
          <input
            type="number"
            min={0}
            value={value.rampUpSec}
            onChange={(e) => patch({ rampUpSec: Number(e.target.value) || 0 })}
            className={inputClass}
          />
        )}
      </div>

      <div className="flex items-center gap-2 text-[12px] text-muted">
        <input
          id="use-duration"
          type="checkbox"
          checked={value.useDuration}
          onChange={(e) => patch({ useDuration: e.target.checked })}
        />
        <label htmlFor="use-duration">Run for a fixed duration instead of a request count</label>
      </div>

      {value.useDuration
        ? field(
            'Duration (seconds)',
            <input
              type="number"
              min={1}
              value={value.durationSec}
              onChange={(e) => patch({ durationSec: Number(e.target.value) || 1 })}
              className={inputClass}
            />
          )
        : field(
            'Total requests',
            <input
              type="number"
              min={1}
              value={value.totalRequests}
              onChange={(e) => patch({ totalRequests: Number(e.target.value) || 1 })}
              className={inputClass}
            />
          )}

      <Button onClick={handleStart} disabled={!value.requestId || starting} className="w-full justify-center">
        <Play className="h-3.5 w-3.5" /> Start run
      </Button>
    </div>
  )
}
