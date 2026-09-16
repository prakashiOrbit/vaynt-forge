import { useMemo, useRef, useState } from 'react'
import { Clipboard, History, RefreshCw, ScanSearch, Send, Trash2, Upload, Zap } from 'lucide-react'
import type { HttpMethod, RequestModel } from '@vayntforge/engine'
import { createDraftRequest, parseHar } from '@vayntforge/engine'
import {
  Button,
  ConfirmDialog,
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
import { useRequestDrafts } from '../stores/requestDrafts'
import { runAndRecordRequest } from '../lib/runAndRecord'

interface HistoryRow {
  id: string
  requestId?: string
  name: string
  method: string
  url: string
  status: number
  durationMs: number
  environmentId?: string
  collectionName: string
  timestamp: number
}

const STATUS_BUCKETS = ['2xx', '3xx', '4xx', '5xx', 'Error'] as const

function statusBucket(status: number): (typeof STATUS_BUCKETS)[number] {
  if (status === 0) return 'Error'
  if (status < 300) return '2xx'
  if (status < 400) return '3xx'
  if (status < 500) return '4xx'
  return '5xx'
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

const selectClass = 'h-7 rounded-md border border-border bg-bg-input px-2 text-[11px] text-text outline-none focus:border-accent'

export function HistoryPage() {
  const openTab = useSession((s) => s.openTab)
  const workspaceId = useSession((s) => s.activeWorkspaceId)
  const activeEnvironmentId = useSession((s) => s.activeEnvironmentId)
  const { openContextMenu } = useContextMenu()

  const { history, requests, collections, foldersByCollection, environments, globalVariables } = useActiveWorkspaceData()
  const deleteHistoryEntry = useData((s) => s.deleteHistoryEntry)
  const clearHistory = useData((s) => s.clearHistory)

  const [query, setQuery] = useState('')
  const [methodFilter, setMethodFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [envFilter, setEnvFilter] = useState('all')
  const [collectionFilter, setCollectionFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [importing, setImporting] = useState(false)
  const harInputRef = useRef<HTMLInputElement>(null)

  const requestById = useMemo(() => new Map(requests.map((r) => [r.id, r])), [requests])
  const collectionById = useMemo(() => new Map(collections.map((c) => [c.id, c])), [collections])

  const refresh = () => {
    setLoading(true)
    void useData.getState().refresh(workspaceId).finally(() => setLoading(false))
  }

  const rows = useMemo(() => {
    return history.map((h): HistoryRow => {
      const source = h.requestId ? requestById.get(h.requestId) : undefined
      const collectionName = source?.collectionId ? (collectionById.get(source.collectionId)?.name ?? '') : ''
      return {
        id: h.id,
        requestId: h.requestId,
        name: h.requestName ?? h.method,
        method: h.method,
        url: h.url,
        status: h.status,
        durationMs: h.durationMs,
        environmentId: h.environmentId,
        collectionName,
        timestamp: h.timestamp,
      }
    })
  }, [history, requestById, collectionById])

  const availableCollections = useMemo(
    () => [...new Set(rows.map((r) => r.collectionName).filter(Boolean))].sort(),
    [rows]
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const fromTs = dateFrom ? new Date(dateFrom).setHours(0, 0, 0, 0) : undefined
    const toTs = dateTo ? new Date(dateTo).setHours(23, 59, 59, 999) : undefined
    return [...rows]
      .filter((r) => methodFilter === 'all' || r.method === methodFilter)
      .filter((r) => statusFilter === 'all' || statusBucket(r.status) === statusFilter)
      .filter((r) => envFilter === 'all' || r.environmentId === envFilter)
      .filter((r) => collectionFilter === 'all' || r.collectionName === collectionFilter)
      .filter((r) => fromTs === undefined || r.timestamp >= fromTs)
      .filter((r) => toTs === undefined || r.timestamp <= toTs)
      .filter(
        (r) =>
          !q ||
          r.name.toLowerCase().includes(q) ||
          r.url.toLowerCase().includes(q) ||
          r.method.toLowerCase().includes(q) ||
          String(r.status).includes(q)
      )
      .sort((a, b) => b.timestamp - a.timestamp)
  }, [rows, query, methodFilter, statusFilter, envFilter, collectionFilter, dateFrom, dateTo])

  const draftFromRow = (r: HistoryRow): RequestModel => {
    const source = r.requestId ? requestById.get(r.requestId) : undefined
    if (source) return source
    return createDraftRequest({ id: r.requestId ?? r.id, workspaceId, method: r.method as HttpMethod, name: r.name, url: r.url })
  }

  const open = (r: HistoryRow) => {
    const draft = draftFromRow(r)
    openTab({ id: draft.id, method: draft.method, name: draft.name, url: draft.url })
    useRequestDrafts.getState().ensure(draft.id, draft)
  }

  const duplicate = (r: HistoryRow) => {
    const source = draftFromRow(r)
    const id = `req_${crypto.randomUUID().slice(0, 8)}`
    const clone: RequestModel = { ...source, id, name: `${source.name} (copy)`, createdAt: Date.now(), updatedAt: Date.now() }
    openTab({ id, method: clone.method, name: clone.name, url: clone.url, dirty: true })
    useRequestDrafts.getState().reset(id, clone)
  }

  const replay = async (r: HistoryRow) => {
    const draft = draftFromRow(r)
    open(r)
    const environment = environments.find((e) => e.id === activeEnvironmentId)
    try {
      await runAndRecordRequest({
        request: draft,
        tabId: draft.id,
        workspaceId,
        environmentId: activeEnvironmentId,
        globalVariables,
        environment,
        collections,
        foldersByCollection,
      })
      toast.success('Replayed', `${draft.method} ${draft.url}`)
    } catch (err) {
      toast.error('Replay failed', err instanceof Error ? err.message : String(err))
    }
  }

  const onHarSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setImporting(true)
    try {
      const drafts = parseHar(JSON.parse(await file.text()))
      for (const d of drafts) {
        await useData.getState().addHistory(workspaceId, {
          workspaceId,
          requestName: (() => {
            try {
              return new URL(d.url).pathname
            } catch {
              return d.url
            }
          })(),
          method: d.method,
          url: d.url,
          status: d.status,
          statusText: d.statusText,
          durationMs: d.durationMs,
          size: d.size,
          timestamp: d.timestamp,
        })
      }
      toast.success('HAR imported', `${drafts.length} request${drafts.length === 1 ? '' : 's'} added to history`)
    } catch (err) {
      toast.error('Import failed', err instanceof Error ? err.message : String(err))
    } finally {
      setImporting(false)
    }
  }

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
      { label: 'Replay', icon: <Zap className="h-3.5 w-3.5" />, onSelect: () => void replay(r) },
      { label: 'Duplicate', icon: <Clipboard className="h-3.5 w-3.5" />, onSelect: () => duplicate(r) },
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
        label: 'Delete',
        icon: <Trash2 className="h-3.5 w-3.5" />,
        onSelect: () => void deleteHistoryEntry(r.id),
      },
    ])
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
        <div className="relative flex min-w-0 flex-1 items-center">
          <ScanSearch className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter history..."
            className="h-7 w-full max-w-xs rounded-md border border-border bg-bg-input pr-3 pl-8 text-[12px] text-text outline-none placeholder:text-faint focus:border-accent"
          />
        </div>
        <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)} className={selectClass}>
          <option value="all">All methods</option>
          {['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectClass}>
          <option value="all">All statuses</option>
          {STATUS_BUCKETS.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <select value={envFilter} onChange={(e) => setEnvFilter(e.target.value)} className={selectClass}>
          <option value="all">All environments</option>
          {environments.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
        {availableCollections.length > 0 && (
          <select value={collectionFilter} onChange={(e) => setCollectionFilter(e.target.value)} className={selectClass}>
            <option value="all">All collections</option>
            {availableCollections.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={selectClass} />
        <span className="text-[11px] text-faint">to</span>
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={selectClass} />
        <Button size="sm" variant="ghost" onClick={refresh}>
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
        <input ref={harInputRef} type="file" accept=".har,application/json" className="hidden" onChange={(e) => void onHarSelected(e)} />
        <Button size="sm" variant="ghost" onClick={() => harInputRef.current?.click()} disabled={importing}>
          <Upload className="h-3.5 w-3.5" /> Import HAR
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirmClear(true)} disabled={history.length === 0}>
          <Trash2 className="h-3.5 w-3.5" /> Clear all
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {loading ? (
          <LoadingState rows={8} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={History}
            title={history.length === 0 ? 'No requests yet' : 'No matching history'}
            description={
              history.length === 0
                ? 'Once you send requests, they will appear here ready to reuse.'
                : 'Try different filters or a different search term.'
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

      <ConfirmDialog
        open={confirmClear}
        title="Clear all history?"
        description={`All ${history.length} recorded request${history.length === 1 ? '' : 's'} in this workspace will be permanently removed.`}
        confirmLabel="Clear all"
        tone="danger"
        onConfirm={() => {
          setConfirmClear(false)
          void clearHistory(workspaceId)
        }}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  )
}
