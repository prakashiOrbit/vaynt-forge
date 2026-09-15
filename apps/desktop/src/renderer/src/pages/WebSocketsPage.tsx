import { Radio } from 'lucide-react'
import { EmptyState } from '@apiforge/ui'

export function WebSocketsPage() {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-2.5">
        <div className="text-[13px] font-semibold text-text">WebSockets</div>
        <div className="text-[11px] text-faint">Live connection testing (Sprint 9)</div>
      </div>
      <div className="min-h-0 flex-1">
        <EmptyState
          icon={Radio}
          title="No WebSocket connections"
          description="Connect to a ws:// or wss:// endpoint to send and receive live messages with a frame-by-frame trace."
        />
      </div>
    </div>
  )
}