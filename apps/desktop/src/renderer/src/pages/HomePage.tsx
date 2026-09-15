import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Braces,
  CheckCircle2,
  Clock,
  FileJson,
  FolderOpen,
  HeartPulse,
  Play,
  Plus,
  Radio,
  Server,
  SlidersHorizontal,
  Waves,
  XCircle,
} from 'lucide-react'
import { Button, MethodBadge, StatusCode } from '@vayntforge/ui'
import { useSession } from '../stores/session'
import { useActiveWorkspaceData, useData } from '../stores/data'

const QUICK_ACTIONS: { label: string; icon: typeof Plus; open: 'request' | 'graphql' | 'ws' | 'sse' | 'grpc' | 'nav'; nav?: string }[] = [
  { label: 'New Request', icon: Plus, open: 'request' },
  { label: 'New Collection', icon: FolderOpen, open: 'nav', nav: 'collections' },
  { label: 'Import OpenAPI', icon: FileJson, open: 'nav', nav: 'openapi' },
  { label: 'Import Collection', icon: BookOpen, open: 'nav', nav: 'collections' },
  { label: 'GraphQL', icon: Braces, open: 'graphql' },
  { label: 'New WebSocket', icon: Radio, open: 'ws' },
  { label: 'SSE Monitor', icon: Waves, open: 'sse' },
  { label: 'gRPC', icon: Server, open: 'grpc' },
  { label: 'New Environment', icon: SlidersHorizontal, open: 'nav', nav: 'environments' },
  { label: 'Create Mock Server', icon: Server, open: 'nav', nav: 'mock-servers' },
]

function formatDuration(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`
}

function isToday(timestamp: number): boolean {
  const d = new Date(timestamp)
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

export function HomePage() {
  const { history, requests, environments, collections, mockServers, testRuns } =
    useActiveWorkspaceData()

  const setActiveNav = useSession((s) => s.setActiveNav)
  const openNewRequest = useSession((s) => s.openNewRequest)
  const openNewWebSocket = useSession((s) => s.openNewWebSocket)
  const openNewSSE = useSession((s) => s.openNewSSE)
  const openNewGraphQL = useSession((s) => s.openNewGraphQL)
  const openNewGrpc = useSession((s) => s.openNewGrpc)
  const openTab = useSession((s) => s.openTab)
  const activeWorkspaceId = useSession((s) => s.activeWorkspaceId)
  const activeEnvironmentId = useSession((s) => s.activeEnvironmentId)
  const workspaces = useData((s) => s.workspaces)

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId)
  const activeEnvName =
    environments.find((e) => e.id === activeEnvironmentId)?.name ?? 'Development'

  const failed = history.filter((h) => h.status >= 400)
  const avgLatency = history.length
    ? Math.round(history.reduce((acc, h) => acc + h.durationMs, 0) / history.length)
    : 0
  const requestsToday = history.filter((h) => isToday(h.timestamp)).length
  const testsExecutedToday = testRuns
    .filter((t) => isToday(t.startedAt))
    .reduce((acc, t) => acc + t.iterations, 0)

  const recentTestRuns = [...testRuns].sort((a, b) => b.startedAt - a.startedAt).slice(0, 4)

  const recentHealthWindow = history.slice(0, 20)
  const healthFailed = recentHealthWindow.filter((h) => h.status >= 400).length
  const errorRate = recentHealthWindow.length ? healthFailed / recentHealthWindow.length : 0
  const runningMocks = mockServers.filter((m) => m.status === 'running').length
  const health =
    recentHealthWindow.length === 0
      ? { label: 'No activity yet', tone: 'text-faint', icon: HeartPulse }
      : errorRate === 0
        ? { label: 'Healthy', tone: 'text-ok', icon: CheckCircle2 }
        : errorRate < 0.2
          ? { label: 'Degraded', tone: 'text-warn', icon: AlertTriangle }
          : { label: 'Unstable', tone: 'text-err', icon: XCircle }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-text">Welcome back</h1>
          <p className="mt-1 text-[13px] text-muted">
            {activeWorkspace?.name ?? 'Acme API'} · {activeEnvName} · {collections.length}{' '}
            collections · {requests.length} requests
          </p>
        </div>
        <Button size="md" onClick={openNewRequest} className="shrink-0">
          <Plus className="h-4 w-4" /> New Request
        </Button>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: 'Requests today', value: String(requestsToday), icon: Activity, tone: 'text-accent' },
          { label: 'Tests executed', value: String(testsExecutedToday), icon: Play, tone: 'text-accent-2' },
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
                  onClick={() => openTab({ id: r.id, method: r.method, name: r.name, url: r.url })}
                  className="group flex w-full items-center gap-3 rounded-md border border-border bg-raised px-3 py-2 text-left transition-colors hover:bg-bg-hover"
                >
                  <MethodBadge method={r.method} />
                  <span className="truncate text-[13px] text-text">{r.name}</span>
                  <span className="ml-auto truncate font-mono text-[11px] text-faint">{r.url}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-[12px] font-semibold uppercase tracking-wider text-faint">
                Recent test runs
              </h2>
              <button
                onClick={() => setActiveNav('tests')}
                className="flex items-center gap-1 text-[12px] text-accent hover:underline"
              >
                Open tests <ArrowRight className="h-3 w-3" />
              </button>
            </div>
            {recentTestRuns.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-[12px] text-faint">
                No test runs yet — run a collection to see pass/fail results here.
              </div>
            ) : (
              <div className="space-y-1.5">
                {recentTestRuns.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-3 rounded-md border border-border bg-raised px-3 py-2"
                  >
                    <span className="min-w-0 flex-1 truncate text-[13px] text-text">{t.name}</span>
                    <span className="flex shrink-0 items-center gap-1 text-[12px] text-ok">
                      <CheckCircle2 className="h-3.5 w-3.5" /> {t.passed}
                    </span>
                    <span className="flex shrink-0 items-center gap-1 text-[12px] text-err">
                      <XCircle className="h-3.5 w-3.5" /> {t.failed}
                    </span>
                  </div>
                ))}
              </div>
            )}
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
                <span className="text-[13px] font-medium text-text">{activeEnvName}</span>
                <span className="rounded bg-ok/12 px-1.5 py-0.5 text-[10px] font-medium text-ok">
                  ACTIVE
                </span>
              </div>
              <div className="mt-1 text-[11px] text-faint">{environments.length} environments saved</div>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-[12px] font-semibold uppercase tracking-wider text-faint">
                API health
              </h2>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-border bg-raised p-3">
              <health.icon className={`h-4 w-4 shrink-0 ${health.tone}`} />
              <div className="min-w-0">
                <div className={`truncate text-[13px] font-medium ${health.tone}`}>{health.label}</div>
                <div className="mt-0.5 truncate text-[11px] text-faint">
                  {recentHealthWindow.length === 0
                    ? 'No recent requests to sample'
                    : `${healthFailed} failed of last ${recentHealthWindow.length} · ${runningMocks}/${mockServers.length} mocks running`}
                </div>
              </div>
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
                  onClick={() => {
                    if (a.open === 'request') return openNewRequest()
                    if (a.open === 'graphql') return openNewGraphQL()
                    if (a.open === 'ws') return openNewWebSocket()
                    if (a.open === 'sse') return openNewSSE()
                    if (a.open === 'grpc') return openNewGrpc()
                    return setActiveNav(a.nav ?? 'home')
                  }}
                  className="flex items-start gap-2 rounded-md border border-border bg-raised px-3 py-2 text-left text-[12px] text-muted transition-colors hover:border-border-strong hover:text-text"
                >
                  <a.icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-faint" />
                  <span className="leading-tight break-words">{a.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}