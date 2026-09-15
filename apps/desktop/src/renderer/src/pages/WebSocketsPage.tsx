import { Radio } from 'lucide-react'
import { Button, EmptyState } from '@vayntforge/ui'
import { useSession } from '../stores/session'

export function WebSocketsPage() {
  const openNewWebSocket = useSession((s) => s.openNewWebSocket)

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div>
          <div className="text-[13px] font-semibold text-text">WebSockets</div>
          <div className="text-[11px] text-faint">Live connection testing (Sprint 9)</div>
        </div>
        <Button size="sm" onClick={openNewWebSocket}>
          New WebSocket connection
        </Button>
      </div>
      <div className="min-h-0 flex-1">
        <EmptyState
          icon={Radio}
          title="No WebSocket connections open"
          description="New connections open as workspace tabs — connect to a ws:// or wss:// endpoint to send and receive live messages with a frame-by-frame trace."
          action={<Button onClick={openNewWebSocket}>New WebSocket connection</Button>}
        />
      </div>
    </div>
  )
}