import { useEffect, useMemo, useState } from 'react'
import { Clipboard, Copy, FolderOpen, Plus, RefreshCw, Search, Send } from 'lucide-react'
import { InMemoryStorage } from '@apiforge/engine'
import type { HttpMethod } from '@apiforge/engine'
import {
  Button,
  Drawer,
  DataTable,
  EmptyState,
  LoadingState,
  MethodBadge,
  toast,
  useContextMenu,
  type DataColumn,
} from '@apiforge/ui'
import { useSession } from '../stores/session'

interface RequestRow {
  id: string
  name: string
  method: string
  url: string
  collectionName?: string
}

export function RequestsPage() {
  const openTab = useSession((s) => s.openTab)
  const openNewRequest = useSession((s) => s.openNewRequest)
  const { openContextMenu } = useContextMenu()

  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<RequestRow | null>(null)

  const requests = useMemo(() => {
    const storage = new InMemoryStorage()
    const wsId = storage.listWorkspaces()[0]?.id ?? ''
    const cols = storage.listCollections(wsId)
    const nameOf = (id?: string) => cols.find((c) => c.id === id)?.name
    return storage.listRequests(wsId).map((r) => ({
      id: r.id,
      name: r.name,
      method: r.method,
      url: r.url,
      collectionName: nameOf(r.collectionId),
    }))
  }, [])

  useEffect(() => {
    const t = window.setTimeout(() => setLoading(false), 350)
    return () => window.clearTimeout(t)
  }, [])

  const refresh = () => {
    setLoading(true)
    window.setTimeout(() => setLoading(false), 300)
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return requests
    return requests.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.url.toLowerCase().includes(q) ||
        r.method.toLowerCase().includes(q)
    )
  }, [requests, query])

  const open = (r: RequestRow) =>
    openTab({ id: r.id, method: r.method as HttpMethod, name: r.name, url: r.url })

  const duplicate = (r: RequestRow) =>
    openTab({
      id: `dup_${crypto.randomUUID().slice(0, 8)}`,
      method: r.method as HttpMethod,
      name: `${r.name} (copy)`,
      url: r.url,
    })

  const columns: DataColumn<RequestRow>[] = [
    {
      id: 'method',
      header: 'Method',
      sortable: true,
      width: 92,
      sortValue: (r) => r.method,
      render: (r) => <MethodBadge method={r.method} />,
    },
    {
      id: 'name',
      header: 'Name',
      sortable: true,
      width: 240,
      minWidth: 160,
      sortValue: (r) => r.name,
      render: (r) => <span className="font-medium text-text">{r.name}</span>,
    },
    {
      id: 'url',
      header: 'URL',
      render: (r) => <span className="font-mono text-[12px] text-muted">{r.url}</span>,
    },
    {
      id: 'collection',
      header: 'Collection',
      width: 160,
      render: (r) =>
        r.collectionName ? (
          <span className="text-faint">{r.collectionName}</span>
        ) : (
          <span className="text-faint/60">—</span>
        ),
    },
  ]

  const onContextMenu = (e: React.MouseEvent, r: RequestRow) => {
    openContextMenu(e, [
      { label: 'Open in new tab', icon: <Send className="h-3.5 w-3.5" />, onSelect: () => open(r) },
      {
        label: 'Duplicate',
        icon: <Copy className="h-3.5 w-3.5" />,
        onSelect: () => {
          duplicate(r)
          toast.success('Request duplicated', `${r.name} (copy) is open in a new tab.`)
        },
      },
      {
        label: 'Copy URL',
        icon: <Clipboard className="h-3.5 w-3.5" />,
        onSelect: () => {
          void navigator.clipboard.writeText(r.url)
          toast.success('URL copied')
        },
      },
      { separator: true },
      {
        label: 'Open collection',
        icon: <FolderOpen className="h-3.5 w-3.5" />,
        disabled: !r.collectionName,
        onSelect: () => toast.info('Collections open in a later sprint'),
      },
    ])
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2.5">
        <div className="relative flex min-w-0 flex-1 items-center">
          <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter requests..."
            className="h-7 w-full max-w-sm rounded-md border border-border bg-bg-input pr-3 pl-8 text-[12px] text-text outline-none placeholder:text-faint focus:border-accent"
          />
        </div>
        <Button size="sm" variant="ghost" onClick={refresh}>
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
        <Button size="sm" onClick={openNewRequest}>
          <Plus className="h-3.5 w-3.5" /> New Request
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {loading ? (
          <LoadingState rows={8} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Send}
            title={query ? 'No matching requests' : 'No requests yet'}
            description={
              query
                ? 'Try a different search term.'
                : 'Create your first request to start testing your API.'
            }
            action={
              !query && (
                <Button size="sm" onClick={openNewRequest}>
                  <Plus className="h-3.5 w-3.5" /> New Request
                </Button>
              )
            }
          />
        ) : (
          <DataTable
            columns={columns}
            rows={filtered}
            rowKey={(r) => r.id}
            onRowClick={setSelected}
            onRowDoubleClick={open}
            onRowContextMenu={onContextMenu}
            emptyLabel="No records"
          />
        )}
      </div>

      <Drawer
        open={selected !== null}
        onClose={() => setSelected(null)}
        title="Request details"
        width={360}
        footer={
          selected && (
            <Button
              size="sm"
              onClick={() => {
                open(selected)
                setSelected(null)
              }}
            >
              Open in new tab
            </Button>
          )
        }
      >
        {selected && (
          <div className="space-y-4">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-faint">
                Method
              </div>
              <div className="mt-1">
                <MethodBadge method={selected.method} />
              </div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-faint">
                Name
              </div>
              <div className="mt-1 text-[13px] font-medium text-text">{selected.name}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-faint">
                URL
              </div>
              <div className="mt-1 font-mono text-[11px] break-all text-muted">{selected.url}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-faint">
                Collection
              </div>
              <div className="mt-1 text-[12px] text-muted">{selected.collectionName ?? '—'}</div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  )
}