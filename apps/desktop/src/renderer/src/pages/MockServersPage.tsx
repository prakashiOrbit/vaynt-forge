import { useEffect, useMemo, useState } from 'react'
import { Play, Plus, RotateCcw, Server, Square, Trash2, X } from 'lucide-react'
import { Button, DataTable, EmptyState, Modal, MethodBadge } from '@vayntforge/ui'
import type { MockEndpoint, MockLogEntry, MockServer } from '@vayntforge/engine'
import { useSession } from '../stores/session'
import { useActiveWorkspaceData } from '../stores/data'
import { useData } from '../stores/data'
import { useMockRuntime } from '../stores/mockRuntime'
import { CreateMockServerWizard } from '../components/mock/CreateMockServerWizard'
import { MockResponseDesigner } from '../components/mock/MockResponseDesigner'

function StatusDot({ running }: { running: boolean }) {
  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${running ? 'bg-ok' : 'bg-faint'}`}
      title={running ? 'Running' : 'Stopped'}
    />
  )
}

export function MockServersPage() {
  const { mockServers } = useActiveWorkspaceData()
  const activeWorkspaceId = useSession((s) => s.activeWorkspaceId)
  const saveMockServer = useData((s) => s.saveMockServer)
  const deleteMockServer = useData((s) => s.deleteMockServer)
  const { liveLogs, pending, bind, start, stop, restart, clearLog } = useMockRuntime()

  const [selectedId, setSelectedId] = useState<string | undefined>(mockServers[0]?.id)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [designerFor, setDesignerFor] = useState<MockEndpoint | 'new' | undefined>(undefined)

  useEffect(() => {
    bind()
  }, [bind])

  useEffect(() => {
    if (!selectedId && mockServers.length > 0) setSelectedId(mockServers[0]?.id)
  }, [mockServers, selectedId])

  const selected = mockServers.find((m) => m.id === selectedId)
  const suggestedPort = useMemo(() => 4100 + mockServers.length, [mockServers.length])

  const rows: MockLogEntry[] = selected
    ? selected.status === 'running'
      ? liveLogs[selected.id] ?? []
      : selected.log
    : []

  const saveEndpoint = async (endpoint: MockEndpoint) => {
    if (!selected) return
    const exists = selected.endpoints.some((e) => e.id === endpoint.id)
    const endpoints = exists
      ? selected.endpoints.map((e) => (e.id === endpoint.id ? endpoint : e))
      : [...selected.endpoints, endpoint]
    await saveMockServer({ ...selected, endpoints })
    setDesignerFor(undefined)
  }

  const removeEndpoint = async (id: string) => {
    if (!selected) return
    await saveMockServer({ ...selected, endpoints: selected.endpoints.filter((e) => e.id !== id) })
  }

  if (mockServers.length === 0) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader onCreate={() => setWizardOpen(true)} />
        <EmptyState
          icon={Server}
          title="No mock servers yet"
          description="Design endpoints with real status codes, headers, and bodies, then start a real local HTTP server to serve them."
          action={<Button onClick={() => setWizardOpen(true)}>Create Mock Server</Button>}
        />
        <CreateWizardModal
          open={wizardOpen}
          workspaceId={activeWorkspaceId}
          suggestedPort={suggestedPort}
          onCreate={async (server) => {
            await saveMockServer(server)
            setSelectedId(server.id)
            setWizardOpen(false)
          }}
          onCancel={() => setWizardOpen(false)}
        />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader onCreate={() => setWizardOpen(true)} />
      <div className="grid min-h-0 flex-1 grid-cols-[260px_1fr]">
        <div className="min-h-0 overflow-y-auto border-r border-border">
          {mockServers.map((server) => {
            const running = server.status === 'running'
            return (
              <button
                key={server.id}
                onClick={() => setSelectedId(server.id)}
                className={`flex w-full items-center gap-2 border-b border-border px-3 py-2.5 text-left ${
                  server.id === selectedId ? 'bg-bg-active' : 'hover:bg-bg-hover'
                }`}
              >
                <StatusDot running={running} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-medium text-text">{server.name}</div>
                  <div className="truncate font-mono text-[11px] text-faint">
                    :{server.port} · {server.endpoints.length} endpoint{server.endpoints.length === 1 ? '' : 's'}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {selected && (
          <div className="flex min-h-0 flex-col overflow-y-auto p-4">
            <div className="flex items-center gap-3 border-b border-border pb-3">
              <StatusDot running={selected.status === 'running'} />
              <div>
                <div className="text-[14px] font-semibold text-text">{selected.name}</div>
                <a
                  href={`http://localhost:${selected.port}`}
                  onClick={(e) => e.preventDefault()}
                  className="font-mono text-[11px] text-faint"
                >
                  http://localhost:{selected.port}
                </a>
              </div>
              <div className="ml-auto flex items-center gap-1.5">
                {selected.status === 'running' ? (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => restart(selected)} disabled={pending[selected.id]}>
                      <RotateCcw className="h-3 w-3" /> Restart
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => stop(selected)} disabled={pending[selected.id]}>
                      <Square className="h-3 w-3" /> Stop
                    </Button>
                  </>
                ) : (
                  <Button size="sm" onClick={() => start(selected)} disabled={pending[selected.id]}>
                    <Play className="h-3 w-3" /> Start
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    if (selected.status === 'running') await stop(selected)
                    await deleteMockServer(selected.id)
                    setSelectedId(undefined)
                  }}
                  title="Delete mock server"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase text-faint">Endpoints</div>
              <Button size="sm" variant="ghost" onClick={() => setDesignerFor('new')}>
                <Plus className="h-3 w-3" /> Add endpoint
              </Button>
            </div>
            <div className="mt-2 divide-y divide-border rounded border border-border">
              {selected.endpoints.length === 0 ? (
                <div className="px-3 py-4 text-center text-[12px] text-faint">
                  No endpoints designed yet — add one to start serving responses.
                </div>
              ) : (
                selected.endpoints.map((ep) => (
                  <div key={ep.id} className="flex items-center gap-2 px-3 py-2">
                    <MethodBadge method={ep.method} />
                    <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-text">{ep.path}</span>
                    <span className="font-mono text-[11px] text-faint">{ep.status}</span>
                    {ep.delayMs > 0 && <span className="text-[11px] text-faint">{ep.delayMs}ms</span>}
                    {ep.errorRate > 0 && (
                      <span className="text-[11px] text-warn">{Math.round(ep.errorRate * 100)}% errors</span>
                    )}
                    <button
                      onClick={() => setDesignerFor(ep)}
                      className="rounded px-1.5 py-0.5 text-[11px] text-muted hover:bg-bg-hover hover:text-text"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => removeEndpoint(ep.id)}
                      className="rounded p-1 text-muted hover:bg-bg-hover hover:text-err"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="mt-6 flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase text-faint">Request log</div>
              <Button size="sm" variant="ghost" onClick={() => clearLog(selected.id)}>
                Clear
              </Button>
            </div>
            <div className="mt-2 min-h-0 flex-1">
              <DataTable
                rows={[...rows].reverse()}
                rowKey={(r) => r.id}
                emptyLabel={selected.status === 'running' ? 'Waiting for requests…' : 'No requests logged yet'}
                columns={[
                  {
                    id: 'time',
                    header: 'Time',
                    width: 90,
                    render: (r) => <span className="font-mono text-[11px] text-faint">{new Date(r.timestamp).toLocaleTimeString()}</span>,
                  },
                  { id: 'method', header: 'Method', width: 70, render: (r) => <MethodBadge method={r.method} /> },
                  { id: 'path', header: 'Path', render: (r) => <span className="font-mono text-[12px] text-text">{r.path}</span> },
                  {
                    id: 'status',
                    header: 'Status',
                    width: 70,
                    render: (r) => (
                      <span className={`font-mono text-[12px] ${r.status >= 500 ? 'text-err' : r.status >= 400 ? 'text-warn' : 'text-ok'}`}>
                        {r.status}
                      </span>
                    ),
                  },
                  {
                    id: 'duration',
                    header: 'Duration',
                    width: 80,
                    align: 'right',
                    render: (r) => <span className="font-mono text-[11px] text-faint">{r.durationMs}ms</span>,
                  },
                ]}
              />
            </div>
          </div>
        )}
      </div>

      <CreateWizardModal
        open={wizardOpen}
        workspaceId={activeWorkspaceId}
        suggestedPort={suggestedPort}
        onCreate={async (server) => {
          await saveMockServer(server)
          setSelectedId(server.id)
          setWizardOpen(false)
        }}
        onCancel={() => setWizardOpen(false)}
      />

      <Modal open={designerFor !== undefined} onClose={() => setDesignerFor(undefined)} title={designerFor === 'new' ? 'Add endpoint' : 'Edit endpoint'} width="max-w-2xl">
        <MockResponseDesigner
          endpoint={designerFor === 'new' ? undefined : designerFor}
          onSave={saveEndpoint}
          onCancel={() => setDesignerFor(undefined)}
        />
      </Modal>
    </div>
  )
}

function PageHeader({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
      <div>
        <div className="text-[13px] font-semibold text-text">Mock Servers</div>
        <div className="text-[11px] text-faint">In-app HTTP mocking — real ports, designed responses</div>
      </div>
      <Button size="sm" onClick={onCreate}>
        <Plus className="h-3.5 w-3.5" /> Create Mock Server
      </Button>
    </div>
  )
}

function CreateWizardModal({
  open,
  workspaceId,
  suggestedPort,
  onCreate,
  onCancel,
}: {
  open: boolean
  workspaceId: string
  suggestedPort: number
  onCreate: (server: MockServer) => void
  onCancel: () => void
}) {
  return (
    <Modal open={open} onClose={onCancel} title="Create Mock Server">
      <CreateMockServerWizard workspaceId={workspaceId} suggestedPort={suggestedPort} onCreate={onCreate} onCancel={onCancel} />
    </Modal>
  )
}
