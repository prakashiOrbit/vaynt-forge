import { useEffect, useMemo, useRef, useState } from 'react'
import { Terminal, Trash2 } from 'lucide-react'
import { Button, EmptyState, JsonTreeView } from '@vayntforge/ui'
import type { ConsoleEntry, ConsoleProtocol } from '@vayntforge/engine'
import { useConsole } from '../stores/console'

const PROTOCOL_FILTERS: { value: ConsoleProtocol | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'http', label: 'HTTP' },
  { value: 'ws', label: 'WS' },
  { value: 'sse', label: 'SSE' },
  { value: 'grpc', label: 'gRPC' },
]

const formatTime = (ts: number) =>
  new Date(ts).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })

function statusTone(status?: number): string {
  if (status === undefined) return 'text-faint'
  if (status === 0) return 'text-err'
  if (status < 300) return 'text-ok'
  if (status < 400) return 'text-warn'
  return 'text-err'
}

function protocolTone(protocol: ConsoleProtocol): string {
  switch (protocol) {
    case 'http':
      return 'text-accent'
    case 'ws':
      return 'text-accent-2'
    case 'sse':
      return 'text-warn'
    case 'grpc':
      return 'text-ok'
  }
}

function tryPretty(body: string | undefined): { json: unknown } | { text: string } | undefined {
  if (body === undefined || body === '') return undefined
  try {
    return { json: JSON.parse(body) }
  } catch {
    return { text: body }
  }
}

function BodyView({ body }: { body: string | undefined }) {
  const parsed = tryPretty(body)
  if (!parsed) return <div className="text-faint">(empty)</div>
  if ('json' in parsed) return <JsonTreeView data={parsed.json} />
  return <pre className="whitespace-pre-wrap break-all">{parsed.text}</pre>
}

function HeadersView({ headers }: { headers: Record<string, string> | undefined }) {
  const entries = Object.entries(headers ?? {})
  if (entries.length === 0) return <div className="text-faint">(none)</div>
  return (
    <div className="space-y-0.5">
      {entries.map(([k, v]) => (
        <div key={k} className="flex gap-1.5">
          <span className="shrink-0 text-faint">{k}:</span>
          <span className="min-w-0 break-all text-text">{v}</span>
        </div>
      ))}
    </div>
  )
}

export function ConsolePage() {
  const entries = useConsole((s) => s.entries)
  const clear = useConsole((s) => s.clear)
  const [protocolFilter, setProtocolFilter] = useState<ConsoleProtocol | 'all'>('all')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)
  const listEndRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return entries
      .filter((e) => protocolFilter === 'all' || e.protocol === protocolFilter)
      .filter((e) => !q || e.summary.toLowerCase().includes(q) || (e.url ?? '').toLowerCase().includes(q))
  }, [entries, protocolFilter, query])

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [filtered.length])

  const selected: ConsoleEntry | undefined = filtered.find((e) => e.id === selectedId) ?? filtered[filtered.length - 1]

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2.5">
        <Terminal className="h-4 w-4 text-faint" />
        <span className="text-[13px] font-medium text-text">Console</span>
        <div className="ml-2 flex items-center gap-1">
          {PROTOCOL_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setProtocolFilter(f.value)}
              className={`rounded px-2 py-0.5 text-[11px] font-medium uppercase ${
                protocolFilter === f.value ? 'bg-accent/20 text-accent' : 'text-faint hover:text-text'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter..."
          className="ml-2 h-7 w-48 rounded-md border border-border bg-bg-input px-2 text-[12px] text-text outline-none placeholder:text-faint focus:border-accent"
        />
        <span className="ml-auto text-[11px] text-faint">{filtered.length} entries</span>
        <Button size="sm" variant="ghost" onClick={clear} disabled={entries.length === 0}>
          <Trash2 className="h-3.5 w-3.5" /> Clear
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Terminal}
          title="Nothing logged yet"
          description="Every real request, response, and WebSocket/SSE/gRPC event this session sends or receives shows up here, raw."
        />
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[1fr_1.2fr] gap-px bg-border">
          <div className="min-h-0 overflow-y-auto bg-bg font-mono text-[12px]">
            {filtered.map((e) => (
              <button
                key={e.id}
                onClick={() => setSelectedId(e.id)}
                className={`flex w-full items-center gap-2 border-b border-border px-3 py-1.5 text-left hover:bg-bg-hover ${
                  selected?.id === e.id ? 'bg-bg-active' : ''
                }`}
              >
                <span className="w-20 shrink-0 text-right text-faint">{formatTime(e.timestamp)}</span>
                <span className={`w-10 shrink-0 text-[10px] font-semibold uppercase ${protocolTone(e.protocol)}`}>
                  {e.protocol}
                </span>
                <span className="min-w-0 flex-1 truncate text-text">{e.summary}</span>
                {e.status !== undefined && <span className={`shrink-0 ${statusTone(e.status)}`}>{e.status}</span>}
                {e.timeMs !== undefined && <span className="shrink-0 text-faint">{e.timeMs}ms</span>}
              </button>
            ))}
            <div ref={listEndRef} />
          </div>

          <div className="min-h-0 overflow-y-auto bg-bg p-3 font-mono text-[12px]">
            {!selected ? (
              <div className="text-faint">Select an entry to see details</div>
            ) : (
              <div className="space-y-4">
                <div className="text-[11px] text-faint">
                  {formatTime(selected.timestamp)} · {selected.protocol.toUpperCase()}
                  {selected.timeMs !== undefined ? ` · ${selected.timeMs}ms` : ''}
                </div>
                {selected.url && <div className="break-all text-text">{selected.method ?? ''} {selected.url}</div>}
                {selected.error && <div className="text-err">{selected.error}</div>}

                {(selected.requestHeaders || selected.requestBody !== undefined) && (
                  <div>
                    <div className="mb-1 text-[11px] font-semibold uppercase text-faint">Request</div>
                    {selected.requestHeaders && <HeadersView headers={selected.requestHeaders} />}
                    {selected.requestBody !== undefined && (
                      <div className="mt-1.5 rounded border border-border p-2">
                        <BodyView body={selected.requestBody} />
                      </div>
                    )}
                  </div>
                )}

                {(selected.status !== undefined || selected.responseHeaders || selected.responseBody !== undefined) && (
                  <div>
                    <div className="mb-1 text-[11px] font-semibold uppercase text-faint">Response</div>
                    {selected.status !== undefined && (
                      <div className={`mb-1 ${statusTone(selected.status)}`}>
                        {selected.status} {selected.statusText}
                      </div>
                    )}
                    {selected.responseHeaders && <HeadersView headers={selected.responseHeaders} />}
                    {selected.responseBody !== undefined && (
                      <div className="mt-1.5 rounded border border-border p-2">
                        <BodyView body={selected.responseBody} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
