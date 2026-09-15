import { useState } from 'react'
import { ChevronDown, ChevronRight, FolderOpen, Plus } from 'lucide-react'
import { MethodBadge, Button } from '@vayntforge/ui'
import type { RequestModel } from '@vayntforge/engine'
import { useActiveWorkspaceData } from '../../stores/data'
import { useSession } from '../../stores/session'

/**
 * Flat collection/request explorer for Sprint 5. The full tree — nesting,
 * drag-and-drop reordering, context menus — is Sprint 7's job; this gives
 * the three-pane layout a real left panel to open requests from meanwhile.
 */
export function RequestExplorer() {
  const { collections, requests } = useActiveWorkspaceData()
  const openTab = useSession((s) => s.openTab)
  const activeTabId = useSession((s) => s.activeTabId)
  const openNewRequest = useSession((s) => s.openNewRequest)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const byCollection = new Map<string, RequestModel[]>()
  const unfiled: RequestModel[] = []
  for (const r of requests) {
    if (r.collectionId) {
      byCollection.set(r.collectionId, [...(byCollection.get(r.collectionId) ?? []), r])
    } else {
      unfiled.push(r)
    }
  }

  const open = (r: RequestModel) =>
    openTab({ id: r.id, method: r.method, name: r.name, url: r.url })

  const renderGroup = (id: string, label: string, items: RequestModel[]) => {
    const isCollapsed = collapsed[id]
    return (
      <div key={id}>
        <button
          onClick={() => setCollapsed((c) => ({ ...c, [id]: !c[id] }))}
          className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-[12px] font-medium text-muted hover:bg-bg-hover hover:text-text"
        >
          {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          <FolderOpen className="h-3.5 w-3.5 text-faint" />
          <span className="truncate">{label}</span>
          <span className="ml-auto text-[10px] text-faint">{items.length}</span>
        </button>
        {!isCollapsed && (
          <div className="ml-2.5 space-y-0.5 border-l border-border pl-1.5">
            {items.map((r) => (
              <button
                key={r.id}
                onClick={() => open(r)}
                className={`flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-[12px] ${
                  r.id === activeTabId ? 'bg-bg-active text-text' : 'text-muted hover:bg-bg-hover hover:text-text'
                }`}
              >
                <MethodBadge method={r.method} />
                <span className="truncate">{r.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-2.5 py-2">
        <span className="text-[11px] font-semibold tracking-wide text-faint uppercase">Explorer</span>
        <Button size="sm" variant="ghost" onClick={openNewRequest} aria-label="New request">
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-1.5">
        {collections.map((c) => renderGroup(c.id, c.name, byCollection.get(c.id) ?? []))}
        {unfiled.length > 0 && renderGroup('unfiled', 'Unfiled', unfiled)}
        {collections.length === 0 && unfiled.length === 0 && (
          <p className="px-1.5 py-4 text-center text-[12px] text-faint">No requests yet.</p>
        )}
      </div>
    </div>
  )
}
