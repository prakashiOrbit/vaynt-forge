import { useEffect, useState } from 'react'
import { Activity, Trash2 } from 'lucide-react'
import { EmptyState, toast } from '@vayntforge/ui'
import type { PerfTestConfig, PerformanceRun } from '@vayntforge/engine'
import { generateId } from '@vayntforge/engine'
import { useSession } from '../stores/session'
import { useActiveWorkspaceData, useData } from '../stores/data'
import { usePerfRuntime } from '../stores/perfRuntime'
import type { VariableScopes } from '../../../shared/types'
import { PerfConfigForm } from '../components/performance/PerfConfigForm'
import { PerfResultsView } from '../components/performance/PerfResultsView'

function statusDotClass(status: PerformanceRun['status']): string {
  if (status === 'running') return 'bg-warn animate-pulse'
  if (status === 'cancelled') return 'bg-faint'
  return 'bg-ok'
}

export function PerformancePage() {
  const activeWorkspaceId = useSession((s) => s.activeWorkspaceId)
  const { requests, environments, globalVariables, performanceRuns } = useActiveWorkspaceData()
  const deletePerformanceRun = useData((s) => s.deletePerformanceRun)
  const { liveSamples, running, cancelling, bind, start, cancel } = usePerfRuntime()

  const [selectedId, setSelectedId] = useState<string | undefined>(undefined)

  useEffect(() => {
    bind()
  }, [bind])

  const selected = performanceRuns.find((r) => r.id === selectedId)

  const handleStart = async (config: PerfTestConfig) => {
    const request = requests.find((r) => r.id === config.requestId)
    if (!request) return
    const environment = environments.find((e) => e.id === config.environmentId)
    const scopes: VariableScopes = {
      global: globalVariables.map((v) => ({ key: v.key, value: v.currentValue })),
      environment: (environment?.variables ?? []).map((v) => ({ key: v.key, value: v.currentValue })),
      request: request.variables.filter((v) => v.enabled).map((v) => ({ key: v.key, value: v.value })),
    }
    const now = Date.now()
    const run: PerformanceRun = {
      id: generateId('perf'),
      workspaceId: activeWorkspaceId,
      name: `${request.method} ${request.name}`,
      config,
      status: 'running',
      samples: [],
      createdAt: now,
      updatedAt: now,
    }
    setSelectedId(run.id)
    try {
      await start(run, request, scopes)
    } catch (err) {
      toast.error('Failed to start performance run', err instanceof Error ? err.message : String(err))
    }
  }

  const handleDelete = async (id: string) => {
    await deletePerformanceRun(id)
    if (selectedId === id) setSelectedId(undefined)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-2.5">
        <div className="text-[13px] font-semibold text-text">Performance</div>
        <div className="text-[11px] text-faint">Real concurrent load testing against a saved request</div>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[280px_1fr]">
        <div className="flex min-h-0 flex-col border-r border-border">
          <div className="min-h-0 flex-1 overflow-y-auto">
            {performanceRuns.length === 0 ? (
              <div className="p-3 text-center text-[11px] text-faint">No runs yet — configure one on the right.</div>
            ) : (
              performanceRuns.map((run) => (
                // A row-select control containing its own delete button can't be a
                // single <button> — nested buttons are invalid HTML and make the
                // inner one unreachable/ambiguous for assistive tech and keyboard
                // nav. Using a keyboard-operable div + a real nested button instead.
                <div
                  key={run.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedId(run.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setSelectedId(run.id)
                    }
                  }}
                  className={`flex w-full cursor-default items-center gap-2 border-b border-border px-3 py-2.5 text-left outline-none focus-visible:ring-1 focus-visible:ring-accent ${
                    run.id === selectedId ? 'bg-bg-active' : 'hover:bg-bg-hover'
                  }`}
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${statusDotClass(running[run.id] ? 'running' : run.status)}`} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] font-medium text-text">{run.name}</div>
                    <div className="truncate font-mono text-[11px] text-faint">
                      {run.result
                        ? `${run.result.requestsPerSec.toFixed(1)} req/s · ${(run.result.errorRate * 100).toFixed(0)}% err`
                        : running[run.id]
                          ? 'Running…'
                          : run.status}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      void handleDelete(run.id)
                    }}
                    aria-label={`Delete run ${run.name}`}
                    className="rounded p-1 text-faint hover:bg-bg-hover hover:text-err"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="border-t border-border">
            <button
              onClick={() => setSelectedId(undefined)}
              className="w-full px-3 py-2.5 text-center text-[12px] font-medium text-accent hover:bg-bg-hover"
            >
              + New run
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1">
          {selected ? (
            <PerfResultsView
              run={selected}
              liveSamples={liveSamples[selected.id]}
              isRunning={Boolean(running[selected.id])}
              cancelling={Boolean(cancelling[selected.id])}
              onCancel={() => cancel(selected.id)}
            />
          ) : requests.length === 0 ? (
            <EmptyState
              icon={Activity}
              title="No saved requests yet"
              description="Save a request in the workspace first, then come back here to load-test it."
            />
          ) : (
            <PerfConfigForm
              requests={requests}
              environments={environments}
              starting={false}
              onStart={handleStart}
            />
          )}
        </div>
      </div>
    </div>
  )
}
