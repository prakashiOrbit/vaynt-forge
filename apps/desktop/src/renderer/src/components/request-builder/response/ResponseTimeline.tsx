import type { TimingBreakdown } from '@vayntforge/engine'

const SEGMENTS: { key: keyof Omit<TimingBreakdown, 'total'>; label: string; color: string }[] = [
  { key: 'dns', label: 'DNS Lookup', color: 'bg-accent-2' },
  { key: 'connect', label: 'TCP Connect', color: 'bg-accent' },
  { key: 'tls', label: 'TLS Handshake', color: 'bg-ok' },
  { key: 'wait', label: 'Waiting (TTFB)', color: 'bg-warn' },
  { key: 'download', label: 'Download', color: 'bg-err' },
]

export function ResponseTimeline({ timing }: { timing: TimingBreakdown }) {
  const total = timing.total || 1

  return (
    <div className="space-y-4 p-4">
      <div className="flex h-3 w-full overflow-hidden rounded-full border border-border">
        {SEGMENTS.map((seg) => {
          const ms = timing[seg.key]
          const pct = (ms / total) * 100
          return pct > 0 ? (
            <div
              key={seg.key}
              className={seg.color}
              style={{ width: `${pct}%` }}
              title={`${seg.label}: ${ms}ms`}
            />
          ) : null
        })}
      </div>
      <div className="space-y-1.5">
        {SEGMENTS.map((seg) => (
          <div key={seg.key} className="flex items-center gap-2 text-[12px]">
            <span className={`h-2 w-2 shrink-0 rounded-full ${seg.color}`} />
            <span className="text-muted">{seg.label}</span>
            <span className="ml-auto font-mono text-faint">{timing[seg.key]}ms</span>
          </div>
        ))}
        <div className="mt-2 flex items-center gap-2 border-t border-border pt-2 text-[12px] font-medium">
          <span className="text-text">Total</span>
          <span className="ml-auto font-mono text-text">{timing.total}ms</span>
        </div>
      </div>
    </div>
  )
}
