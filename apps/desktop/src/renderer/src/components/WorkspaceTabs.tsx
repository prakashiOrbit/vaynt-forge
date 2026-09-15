import { Plus, X } from 'lucide-react'
import { MethodBadge } from '@vayntforge/ui'
import { useSession } from '../stores/session'
import type { TabKind } from '@vayntforge/engine'

const PROTOCOL_LABELS: Record<NonNullable<TabKind>, string> = {
  http: 'HTTP',
  ws: 'WS',
  sse: 'SSE',
  graphql: 'GQL',
  grpc: 'gRPC',
}

function ProtocolBadge({ kind }: { kind?: TabKind }) {
  if (!kind || kind === 'http') return null
  return (
    <span className="rounded bg-accent-2/20 px-1 py-0.5 text-[9px] font-semibold text-accent-2">
      {PROTOCOL_LABELS[kind]}
    </span>
  )
}

export function WorkspaceTabs() {
  const tabs = useSession((s) => s.tabs)
  const activeTabId = useSession((s) => s.activeTabId)
  const setActiveTab = useSession((s) => s.setActiveTab)
  const closeTab = useSession((s) => s.closeTab)
  const openNewRequest = useSession((s) => s.openNewRequest)

  return (
    <div className="flex h-9 shrink-0 items-end overflow-x-auto border-b border-border bg-bg">
      <div className="flex items-stretch self-stretch">
        {tabs.map((tab) => {
          const active = tab.id === activeTabId
          return (
            <div
              key={tab.id}
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(tab.id)}
              onAuxClick={(e) => {
                if (e.button === 1) closeTab(tab.id)
              }}
              className={`group flex max-w-[220px] cursor-default items-center gap-2 border-r border-border px-3 text-[12px] whitespace-nowrap transition-colors ${
                active
                  ? 'border-t-2 border-t-accent bg-raised text-text'
                  : 'border-t-2 border-t-transparent bg-bg text-muted hover:bg-bg-hover hover:text-text'
              }`}
            >
              {tab.kind ? <ProtocolBadge kind={tab.kind} /> : <MethodBadge method={tab.method} />}
              <span className="truncate">{tab.name}</span>
              {tab.dirty && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  closeTab(tab.id)
                }}
                aria-label={`Close ${tab.name}`}
                className="shrink-0 rounded p-0.5 text-faint opacity-0 transition-opacity hover:bg-bg-active hover:text-text group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )
        })}
      </div>
      <button
        onClick={openNewRequest}
        aria-label="New request tab"
        className="flex h-full items-center px-3 text-muted transition-colors hover:bg-bg-hover hover:text-text"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}