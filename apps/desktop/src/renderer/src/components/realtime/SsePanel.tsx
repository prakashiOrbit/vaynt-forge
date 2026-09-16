import { useEffect, useRef, useState } from 'react'
import { Radio, Pause, Play, RotateCcw, Trash2, X } from 'lucide-react'
import { Button, EmptyState } from '@vayntforge/ui'
import { useRealtime } from '../../stores/realtime'

const formatTime = (ts: number) => new Date(ts).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })

export function SsePanel({ tabId }: { tabId: string }) {
  const sse = useRealtime((s) => s.getSse(tabId))
  const connectSse = useRealtime((s) => s.connectSse)
  const pauseSse = useRealtime((s) => s.pauseSse)
  const resumeSse = useRealtime((s) => s.resumeSse)
  const closeSse = useRealtime((s) => s.closeSse)
  const reconnectSse = useRealtime((s) => s.reconnectSse)
  const clearSse = useRealtime((s) => s.clearSse)
  const bindSse = useRealtime((s) => s.bindSse)
  const eventEndRef = useRef<HTMLDivElement>(null)
  const [url, setUrl] = useState(sse.url)

  useEffect(() => {
    bindSse()
  }, [bindSse])

  useEffect(() => { eventEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [sse.events.length])

  if (sse.status === 'idle') {
    return (
      <EmptyState
        icon={Radio}
        title="Server-Sent Events monitor"
        description="Enter an SSE endpoint and connect to watch its live event stream."
        action={
          <div className="flex items-center gap-2">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-72 rounded border border-border bg-bg px-2 py-1 font-mono text-[12px] text-text"
            />
            <Button onClick={() => connectSse(tabId, url || sse.url)}>Connect</Button>
          </div>
        }
      />
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-border px-3 py-2">
        <span
          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${
            sse.status === 'open' ? 'bg-ok text-ok' : 'bg-faint text-faint'
          }`}
        >
          {sse.status}
        </span>
        <span className="text-[11px] text-faint font-mono">{sse.url}</span>
        <div className="ml-auto flex items-center gap-1">
          {sse.status === 'open' && (
            sse.paused ? (
              <Button size="sm" variant="ghost" onClick={() => resumeSse(tabId)}>
                <Play className="h-3 w-3" /> Resume
              </Button>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => pauseSse(tabId)}>
                <Pause className="h-3 w-3" /> Pause
              </Button>
            )
          )}
          <Button size="sm" variant="ghost" onClick={() => reconnectSse(tabId)}>
            <RotateCcw className="h-3 w-3" /> Reconnect
          </Button>
          <Button size="sm" variant="ghost" onClick={() => clearSse(tabId)} title="Clear events and log">
            <Trash2 className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => closeSse(tabId)}>
            <X className="h-3 w-3" /> Close
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2 font-mono text-[12px]">
        {sse.events.length === 0 ? (
          <div className="text-faint">Waiting for events... ({sse.logs.length} logs)</div>
        ) : (
          <div className="space-y-0.5">
            {sse.events.map((evt) => (
              <div key={evt.id} className="flex gap-2">
                <span className="w-20 shrink-0 text-right text-faint">{formatTime(evt.timestamp)}</span>
                <span className="w-16 shrink-0 text-faint">{evt.id}</span>
                <span className="w-24 shrink-0 text-faint">{evt.event}</span>
                <span className="min-w-0 break-all text-ok">{evt.data}</span>
              </div>
            ))}
            <div ref={eventEndRef} />
          </div>
        )}
      </div>
    </div>
  )
}
