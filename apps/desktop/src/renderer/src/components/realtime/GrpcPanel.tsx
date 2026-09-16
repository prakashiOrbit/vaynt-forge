import { useEffect, useMemo, useState } from 'react'
import { FolderOpen, Play, Radio, Send, Square, Unplug } from 'lucide-react'
import { Button } from '@vayntforge/ui'
import type { GrpcMethodKind, GrpcService } from '@vayntforge/engine'
import { useRealtime } from '../../stores/realtime'

const KIND_LABEL: Record<GrpcMethodKind, string> = {
  unary: 'unary',
  'server-stream': 'server-stream',
  'client-stream': 'client-stream',
  'bidi-stream': 'bidi',
}

/** A readable stand-in for literal .proto source when a target was discovered via reflection (no source file to show). */
function renderServiceSummary(services: GrpcService[]): string {
  if (services.length === 0) return ''
  return (
    `// Reconstructed from server reflection — this target has no .proto\n` +
    `// source file, so this lists what reflection reported instead.\n\n` +
    services
      .map(
        (svc) =>
          `service ${svc.name} {\n` +
          svc.methods
            .map((m) => {
              const req = m.kind === 'client-stream' || m.kind === 'bidi-stream' ? `stream ${m.requestType}` : m.requestType
              const res = m.kind === 'server-stream' || m.kind === 'bidi-stream' ? `stream ${m.responseType}` : m.responseType
              return `  rpc ${m.name}(${req}) returns (${res});`
            })
            .join('\n') +
          `\n}`
      )
      .join('\n\n')
  )
}

export function GrpcPanel({ tabId }: { tabId: string }) {
  const grpc = useRealtime((s) => s.getGrpc(tabId))
  const grpcStartDemo = useRealtime((s) => s.grpcStartDemo)
  const grpcConnectExternal = useRealtime((s) => s.grpcConnectExternal)
  const grpcDisconnect = useRealtime((s) => s.grpcDisconnect)
  const grpcCall = useRealtime((s) => s.grpcCall)
  const grpcBidiStart = useRealtime((s) => s.grpcBidiStart)
  const grpcBidiSend = useRealtime((s) => s.grpcBidiSend)
  const grpcBidiEnd = useRealtime((s) => s.grpcBidiEnd)
  const bindGrpc = useRealtime((s) => s.bindGrpc)

  const [address, setAddress] = useState(grpc.address || '127.0.0.1:50051')
  const [tls, setTls] = useState(grpc.tls)
  const [protoPath, setProtoPath] = useState<string | null>(null)

  const allMethods = useMemo(
    () => grpc.services.flatMap((svc) => svc.methods.map((m) => ({ ...m, service: svc.name }))),
    [grpc.services]
  )
  const [method, setMethod] = useState<string | undefined>(allMethods[0]?.name)
  const selected = allMethods.find((m) => m.name === method) ?? allMethods[0]
  const [input, setInput] = useState(
    '{\n  "customer_id": "usr_1",\n  "items": [\n    { "sku": "acme-1", "quantity": 2 }\n  ]\n}'
  )
  const [calling, setCalling] = useState(false)
  const [leftView, setLeftView] = useState<'services' | 'proto'>('services')

  useEffect(() => {
    bindGrpc()
  }, [bindGrpc])

  useEffect(() => {
    const first = allMethods[0]
    if (first && !allMethods.some((m) => m.name === method)) {
      setMethod(first.name)
    }
  }, [allMethods, method])

  const handleStartDemo = () => {
    void grpcStartDemo(tabId)
  }

  const handleConnect = () => {
    void grpcConnectExternal(tabId, address, tls, protoPath ?? undefined)
  }

  const handleBrowseProto = async () => {
    const path = await window.vayntforge.dialog.openProtoFile()
    if (path) setProtoPath(path)
  }

  const parseMessage = (): unknown => {
    try {
      return JSON.parse(input) as unknown
    } catch {
      return {}
    }
  }

  const handleCall = async () => {
    if (!selected) return
    setCalling(true)
    try {
      if (selected.kind === 'bidi-stream') {
        if (!grpc.bidiOpen) {
          await grpcBidiStart(tabId, selected.name)
        } else {
          await grpcBidiSend(tabId, parseMessage())
        }
      } else {
        await grpcCall(tabId, selected.name, selected.kind, parseMessage())
      }
    } finally {
      setCalling(false)
    }
  }

  if (!grpc.connected) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-3 border-b border-border px-3 py-2">
          <Radio className="h-3.5 w-3.5 text-faint" />
          <span className="text-[12px] font-medium text-text">gRPC</span>
        </div>
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="w-full max-w-md space-y-4">
            <div>
              <div className="mb-1 text-[11px] font-semibold uppercase text-faint">Connect to a real target</div>
              <div className="flex items-center gap-2">
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="host:port"
                  className="flex-1 rounded border border-border bg-bg px-2 py-1 font-mono text-[12px] text-text"
                />
                <label className="flex items-center gap-1 text-[11px] text-faint">
                  <input type="checkbox" checked={tls} onChange={(e) => setTls(e.target.checked)} />
                  TLS
                </label>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={handleBrowseProto}>
                  <FolderOpen className="h-3 w-3" /> Browse .proto…
                </Button>
                <span className="truncate font-mono text-[11px] text-faint">
                  {protoPath ? protoPath.split('/').pop() : 'none selected — falls back to server reflection'}
                </span>
              </div>
              <Button size="sm" className="mt-3 w-full" onClick={handleConnect} disabled={grpc.connecting || !address}>
                {grpc.connecting ? 'Connecting…' : 'Connect'}
              </Button>
              {grpc.error && <div className="mt-2 text-[11px] text-err">{grpc.error}</div>}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-faint">
              <div className="h-px flex-1 bg-border" />
              or
              <div className="h-px flex-1 bg-border" />
            </div>
            <Button size="sm" variant="ghost" className="w-full" onClick={handleStartDemo} disabled={grpc.connecting}>
              Start in-app demo server
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-border px-3 py-2">
        <Radio className="h-3.5 w-3.5 text-faint" />
        <span className="text-[12px] font-medium text-text">gRPC</span>
        <span className="font-mono text-[11px] text-faint">
          {grpc.address}
          {grpc.tls ? ' (tls)' : ''}
        </span>
        <div className="ml-auto flex items-center gap-1">
          {selected?.kind === 'bidi-stream' && grpc.bidiOpen ? (
            <>
              <Button size="sm" onClick={handleCall} disabled={calling}>
                <Send className="h-3 w-3" /> Send
              </Button>
              <Button size="sm" variant="ghost" onClick={() => grpcBidiEnd(tabId)}>
                <Square className="h-3 w-3" /> End stream
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={handleCall} disabled={calling || !selected}>
              <Play className="h-3 w-3" /> {selected?.kind === 'bidi-stream' ? 'Start stream' : 'Call'}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => grpcDisconnect(tabId)} title="Disconnect">
            <Unplug className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[220px_1fr_1fr] gap-px bg-border">
        <div className="flex min-h-0 flex-col bg-bg p-2">
          <div className="mb-1.5 flex gap-1">
            <button
              onClick={() => setLeftView('services')}
              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                leftView === 'services' ? 'bg-accent/20 text-accent' : 'text-faint hover:text-text'
              }`}
            >
              Services
            </button>
            <button
              onClick={() => setLeftView('proto')}
              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                leftView === 'proto' ? 'bg-accent/20 text-accent' : 'text-faint hover:text-text'
              }`}
            >
              Proto
            </button>
          </div>
          {leftView === 'proto' ? (
            <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-muted">
              {grpc.protoSource ?? renderServiceSummary(grpc.services)}
            </pre>
          ) : (
            <div className="min-h-0 flex-1 overflow-auto">
              {grpc.services.map((svc) => (
                <div key={svc.fullName} className="mb-2">
                  <div className="font-mono text-[11px] font-semibold text-text">{svc.name}</div>
                  <div className="mt-0.5 space-y-0.5 pl-2">
                    {svc.methods.map((m) => (
                      <button
                        key={m.name}
                        onClick={() => setMethod(m.name)}
                        className={`flex w-full items-center justify-between rounded px-1.5 py-1 text-left font-mono text-[11px] ${
                          m.name === method ? 'bg-accent/20 text-accent' : 'text-muted hover:bg-bg-hover hover:text-text'
                        }`}
                      >
                        <span>{m.name}</span>
                        <span className="text-[9px] uppercase text-faint">{KIND_LABEL[m.kind]}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex min-h-0 flex-col bg-bg p-2">
          <div className="mb-1 text-[11px] font-semibold uppercase text-faint">
            {selected?.requestType} → {selected?.responseType}
          </div>
          {selected?.description && <div className="mb-2 text-[11px] text-faint">{selected.description}</div>}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="min-h-0 flex-1 resize-none rounded border border-border bg-bg p-2 font-mono text-[12px] text-text"
            spellCheck={false}
            placeholder={
              selected?.kind === 'client-stream'
                ? 'A single message, or a JSON array of messages to stream'
                : undefined
            }
          />
        </div>
        <div className="flex min-h-0 flex-col bg-bg p-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase text-faint">Frames</span>
            {selected && selected.kind !== 'unary' && (
              <span className="text-[10px] text-faint">
                {grpc.frames.filter((f) => f.method === selected.name && f.kind === 'data').length} received
              </span>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-auto rounded border border-border bg-bg p-2 font-mono text-[12px]">
            {grpc.frames.length === 0 ? (
              <div className="text-faint">Call a method to see frames</div>
            ) : (
              <div className="space-y-1">
                {grpc.frames.map((f, i) => (
                  <div key={i} className={f.kind === 'error' ? 'text-err' : f.kind === 'data' ? 'text-ok' : 'text-faint'}>
                    <span className="text-faint">[{f.method}:{f.kind}]</span>{' '}
                    {typeof f.message === 'object' && f.message !== null
                      ? JSON.stringify(f.message)
                      : (f.text ?? String(f.message ?? ''))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
