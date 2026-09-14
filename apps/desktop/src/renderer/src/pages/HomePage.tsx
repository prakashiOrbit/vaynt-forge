import { useMemo } from 'react'
import {
  Activity,
  ArrowRight,
  BookOpen,
  Clock,
  FileJson,
  FolderOpen,
  Play,
  Plus,
  Server,
  SlidersHorizontal,
  XCircle,
} from 'lucide-react'
import { InMemoryStorage } from '@apiforge/engine'
import { Button, MethodBadge, StatusCode } from '@apiforge/ui'
import { useSession } from '../stores/session'

const QUICK_ACTIONS = [
  { label: 'New Request', icon: Plus },
  { label: 'New Collection', icon: FolderOpen },
  { label: 'Import OpenAPI', icon: FileJson },
  { label: 'Import Collection', icon: BookOpen },
  { label: 'New Environment', icon: SlidersHorizontal },
  { label: 'Create Mock Server', icon: Server },
]

function formatDuration(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`
}

export function HomePage() {
  const data = useMemo(() => {
    const storage = new InMemoryStorage()
    const ws = storage.listWorkspaces()[0]
    const wsId = ws?.id ?? ''
    return { storage, wsId }
  }, [])

  const { storage, wsId } = data
  const history = storage.listHistory(wsId)
  const requests = storage.listRequests(wsId)
  const environments = storage.listEnvironments(wsId)
  const mockServers = storage.listMockServers(wsId)
  const setActiveNav = useSession((s) => s.setActiveNav)

  const failed = history.filter((h) => h.status >= 400)
  const avgLatency = history.length
    ? Math.round(history.reduce((acc, h) => acc + h.durationMs, 0) / history.length)
    : 0

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <section className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-text">Welcome back</h1>
          <p className="mt-1 text-[13px] text-muted">
            Acme API · Development · 3 collections · 12 requests
          </p>
        </div>
        <Button size="md" onClick={() => setActiveNav('requests')}>
          <Plus className="h-4 w-4" /> New Request
        </Button>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: 'Requests today', value: '24', icon: Activity, tone: 'text-accent' },
          { label: 'Tests executed', value: '12', icon: Play, tone: 'text-accent-2' },
          { label: 'Avg response time', value: `${avgLatency}ms`, icon: Clock, tone: 'text-ok' },
          { label: 'Failed requests', value: String(failed.length), icon: XCircle, tone: 'text-err' },
        ].map((m) => (
          <div
            key={m.label}
            className="flex items-center gap-3 rounded-lg border border-border bg-raised px-3.5 py-3"
          >
            <m.icon className={`h-4 w-4 ${m.tone}`} />
            <div>
              <div className="text-[13px] font-semibold text-text">{m.value}</div>
              <div className="text-[11px] text-faint">{m.label}</div>
            </div>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-[12px] font-semibold uppercase tracking-wider text-faint">
                Recent requests
              </h2>
              <button
                onClick={() => setActiveNav('history')}
                className="flex items-center gap-1 text-[12px] text-accent hover:underline"
              >
                Open history <ArrowRight className="h-3 w-3" />
              </button>
            </div>
            <div className="overflow-hidden rounded-lg border border-border bg-raised">
              <table className="w-full text-[13px]">
                <tbody>
                  {history.slice(0, 5).map((h) => (
                    <tr key={h.id} className="border-b border-border last:border-b-0">
                      <td className="px-3 py-2">
                        <MethodBadge method={h.method} />
                      </td>
                      <td className="max-w-0 truncate px-3 py-2 text-muted">
                        <span className="block truncate font-mono text-[12px]">{h.url}</span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <StatusCode code={h.status} />
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-[12px] text-faint">
                        {formatDuration(h.durationMs)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-[12px] font-semibold uppercase tracking-wider text-faint">
                Continue where you left off
              </h2>
            </div>
            <div className="space-y-1.5">
              {requests.slice(0, 4).map((r) => (
                <button
                  key={r.id}
                  onClick={() => setActiveNav('requests')}
                  className="group flex w-full items-center gap-3 rounded-md border border-border bg-raised px-3 py-2 text-left transition-colors hover:bg-bg-hover"
                >
                  <MethodBadge method={r.method} />
                  <span className="truncate text-[13px] text-text">{r.name}</span>
                  <span className="ml-auto truncate font-mono text-[11px] text-faint">{r.url}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-[12px] font-semibold uppercase tracking-wider text-faint">
                Active environment
              </h2>
            </div>
            <div className="rounded-lg border border-border bg-raised p-3">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-text">Development</span>
                <span className="rounded bg-emerald-500/12 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                  ACTIVE
                </span>
              </div>
              <div className="mt-1 text-[11px] text-faint">{environments.length} environments saved</div>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-[12px] font-semibold uppercase tracking-wider text-faint">
                Mock servers
              </h2>
              <button
                onClick={() => setActiveNav('mock-servers')}
                className="flex items-center gap-1 text-[12px] text-accent hover:underline"
              >
                Manage <ArrowRight className="h-3 w-3" />
              </button>
            </div>
            <div className="space-y-1.5">
              {mockServers.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-2.5 rounded-md border border-border bg-raised px-3 py-2"
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      m.status === 'running' ? 'bg-ok' : 'bg-faint'
                    }`}
                  />
                  <span className="flex-1 truncate text-[13px] text-text">{m.name}</span>
                  <span className="font-mono text-[11px] text-faint">:{m.port}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-faint">
              Quick actions
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_ACTIONS.map((a) => (
                <button
                  key={a.label}
                  onClick={() => setActiveNav('home')}
                  className="flex items-center gap-2 rounded-md border border-border bg-raised px-3 py-2 text-[12px] text-muted transition-colors hover:border-border-strong hover:text-text"
                >
                  <a.icon className="h-3.5 w-3.5 text-faint" />
                  <span className="truncate">{a.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}