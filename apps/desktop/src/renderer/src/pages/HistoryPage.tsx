import { useMemo, useState } from 'react'
import { Clipboard, History, RefreshCw, ScanSearch, Send } from 'lucide-react'
import type { HttpMethod } from '@vayntforge/engine'
import {
  Button,
  DataTable,
  EmptyState,
  LoadingState,
  MethodBadge,
  StatusCode,
  toast,
  useContextMenu,
  type DataColumn,
} from '@vayntforge/ui'
import { useSession } from '../stores/session'
import { useActiveWorkspaceData, useData } from '../stores/data'

interface HistoryRow {
  id: string
  name: string
  method: string
  url: string
  status: number
  durationMs: number
  timestamp: number
}

function formatDuration(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  const today = new Date()
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  return sameDay
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export function HistoryPage() {
  const openTab = useSession((s) => s.openTab)
  const workspaceId = useSession((s) => s.activeWorkspaceId)
  const { openContextMenu } = useContextMenu()

  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)

  const history = useActiveWorkspaceData().history

  const refresh = () => {
    setLoading(true)
    void useData.getState().refresh(workspaceId).finally(() => setLoading(false))
  }

  const filtered = useMemo(() => {
    const rows = [...history]
      .map(
        (h): HistoryRow => ({
          id: h.id,
          name: h.requestName ?? h.method,
          method: h.method,
          url: h.url,
          status: h.status,
          durationMs: h.durationMs,
          timestamp: h.timestamp,
        })
      )
      .sort((a, b) => b.timestamp - a.timestamp)
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.url.toLowerCase().includes(q) ||
        r.method.toLowerCase().includes(q) ||
        String(r.status).includes(q)
    )
  }, [history, query])

  const open = (r: HistoryRow) =>
    openTab({ id: r.id, method: r.method as HttpMethod, name: r.name, url: r.url })

  const columns: DataColumn<HistoryRow>[] = [
    {
      id: 'method',
      header: 'Method',
      sortable: true,
      width: 92,
      sortValue: (r) => r.method,
      render: (r) => <MethodBadge method={r.method} />,
    },
    {
      id: 'url',
      header: 'URL',
      render: (r) => <span className="font-mono text-[12px] text-muted">{r.url}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      width: 90,
      sortValue: (r) => r.status,
      render: (r) => <StatusCode code={r.status} />,
    },
    {
      id: 'duration',
      header: 'Duration',
      align: 'right',
      sortable: true,
      width: 96,
      sortValue: (r) => r.durationMs,
      render: (r) => <span className="font-mono text-[12px] text-faint">{formatDuration(r.durationMs)}</span>,
    },
    {
      id: 'time',
      header: 'Time',
      align: 'right',
      sortable: true,
      width: 110,
      sortValue: (r) => r.timestamp,
      render: (r) => <span className="font-mono text-[12px] text-faint">{formatTime(r.timestamp)}</span>,
    },
  ]

  const onContextMenu = (e: React.MouseEvent, r: HistoryRow) => {
    openContextMenu(e, [
      { label: 'Open in new tab', icon: <Send className="h-3.5 w-3.5" />, onSelect: () => open(r) },
      {
        label: 'Copy URL',
        icon: <Clipboard className="h-3.5 w-3.5" />,
        onSelect: () => {
          void navigator.clipboard.writeText(r.url)
          toast.success('URL copied')
        },
      },
    ])
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2.5">
        <div className="relative flex min-w-0 flex-1 items-center">
          <ScanSearch className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter history..."
            className="h-7 w-full max-w-sm rounded-md border border-border bg-bg-input pr-3 pl-8 text-[12px] text-text outline-none placeholder:text-faint focus:border-accent"
          />
        </div>
        <Button size="sm" variant="ghost" onClick={refresh}>
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {loading ? (
          <LoadingState rows={8} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={History}
            title={query ? 'No matching history' : 'No requests yet'}
            description={
              query
                ? 'Try a different search term.'
                : 'Once you send requests, they will appear here ready to reuse.'
            }
          />
        ) : (
          <DataTable
            columns={columns}
            rows={filtered}
            rowKey={(r) => r.id}
            onRowDoubleClick={open}
            onRowContextMenu={onContextMenu}
            emptyLabel="No records"
          />
        )}
      </div>
    </div>
  )
}