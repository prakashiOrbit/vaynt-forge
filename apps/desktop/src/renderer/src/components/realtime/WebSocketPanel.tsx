import { useEffect, useRef, useState } from 'react'
import { Radio, Send, Trash2 } from 'lucide-react'
import { Button, EmptyState } from '@vayntforge/ui'
import type { WsMessageFormat } from '@vayntforge/engine'
import { useRealtime } from '../../stores/realtime'

function StatusBadge({ status }: { status: string }) {
  const color =
    status === 'connected'
      ? 'bg-ok text-ok'
      : status === 'connecting'
        ? 'bg-warn text-warn'
        : status === 'closing'
          ? 'bg-faint text-faint'
          : status === 'closed'
            ? 'bg-faint text-faint'
            : 'bg-faint text-faint'
  return (
    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${color}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${color.split(' ')[0]}`} />
      {status}
    </span>
  )
}

const formatTime = (ts: number) => new Date(ts).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })

export function WebSocketPanel({ tabId }: { tabId: string }) {
  const ws = useRealtime((s) => s.getWs(tabId))
  const connectWs = useRealtime((s) => s.connectWs)
  const disconnectWs = useRealtime((s) => s.disconnectWs)
  const sendWs = useRealtime((s) => s.sendWs)
  const pingWs = useRealtime((s) => s.pingWs)
  const reconnectWs = useRealtime((s) => s.reconnectWs)
  const setWsFormat = useRealtime((s) => s.setWsFormat)
  const clearWs = useRealtime((s) => s.clearWs)
  const bindWs = useRealtime((s) => s.bindWs)
  const frameEndRef = useRef<HTMLDivElement>(null)
  const [input, setInput] = useState('')
  const [url, setUrl] = useState(ws.url)
  const [showLog, setShowLog] = useState(false)

  useEffect(() => {
    bindWs()
  }, [bindWs])

  useEffect(() => { frameEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [ws.frames.length, ws.logs.length, showLog])

  if (ws.status === 'idle') {
    return (
      <EmptyState
        icon={Radio}
        title="WebSocket connection"
        description="Enter a ws:// or wss:// endpoint and connect to start sending and receiving live messages."
        action={
          <div className="flex items-center gap-2">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-72 rounded border border-border bg-bg px-2 py-1 font-mono text-[12px] text-text"
            />
            <Button onClick={() => connectWs(tabId, url || ws.url)}>Connect</Button>
          </div>
        }
      />
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-border px-3 py-2">
        <StatusBadge status={ws.status} />
        <span className="text-[11px] text-faint font-mono">{ws.url}</span>
        <div className="ml-auto flex items-center gap-1">
          <select
            value={ws.format}
            onChange={(e) => setWsFormat(tabId, e.target.value as WsMessageFormat)}
            className="rounded border border-border bg-bg px-1.5 py-1 text-[11px] text-text"
            title="Outgoing message format"
          >
            <option value="json">JSON</option>
            <option value="text">Text</option>
            <option value="base64">Binary (base64)</option>
          </select>
          <Button size="sm" variant="ghost" onClick={() => setShowLog((v) => !v)}>
            {showLog ? 'Frames' : 'Log'}
          </Button>
          {ws.status === 'connected' ? (
            <>
              <Button size="sm" variant="ghost" onClick={() => pingWs(tabId)}>Ping</Button>
              <Button size="sm" variant="ghost" onClick={() => disconnectWs(tabId)}>Disconnect</Button>
            </>
          ) : (
            <Button size="sm" onClick={() => reconnectWs(tabId)}>Reconnect</Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => clearWs(tabId)} title="Clear frames and log">
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2 font-mono text-[12px]">
        {showLog ? (
          ws.logs.length === 0 ? (
            <div className="text-faint">No connection log entries yet</div>
          ) : (
            <div className="space-y-0.5">
              {ws.logs.map((line, i) => (
                <div key={i} className="text-faint">{line}</div>
              ))}
              <div ref={frameEndRef} />
            </div>
          )
        ) : ws.frames.length === 0 ? (
          <div className="text-faint">No frames yet — {ws.logs.length} log entries</div>
        ) : (
          <div className="space-y-0.5">
            {ws.frames.map((f) => (
              <div key={f.id} className={`flex gap-2 ${f.direction === 'sent' ? 'text-accent' : 'text-ok'}`}>
                <span className="w-20 shrink-0 text-right text-faint">{formatTime(f.timestamp)}</span>
                <span className="w-4 shrink-0 text-center text-faint">{f.direction === 'sent' ? '→' : '←'}</span>
                <span className="w-10 shrink-0 text-faint">{f.format}</span>
                <span className="min-w-0 break-all">{f.payload}</span>
              </div>
            ))}
            <div ref={frameEndRef} />
          </div>
        )}
      </div>
      <div className="flex gap-2 border-t border-border px-3 py-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && input.trim()) { sendWs(tabId, input); setInput('') } }}
          placeholder="Send a message..."
          className="flex-1 rounded border border-border bg-bg px-2 py-1 font-mono text-[12px] text-text"
          disabled={ws.status !== 'connected'}
        />
        <Button
          size="sm"
          onClick={() => { if (input.trim()) { sendWs(tabId, input); setInput('') } }}
          disabled={ws.status !== 'connected'}
        >
          <Send className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}
