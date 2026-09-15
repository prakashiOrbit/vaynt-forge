import { useRef, useState } from 'react'
import { Copy, Download, Eye, EyeOff, Layers, Plus, RotateCcw, Trash2, Upload } from 'lucide-react'
import {
  Button,
  ConfirmDialog,
  EmptyState,
  PromptDialog,
  Tabs,
  toast,
  type TabItem,
} from '@vayntforge/ui'
import { parseDotEnv, serializeEnvironment, deserializeEnvironmentFile, environmentFromFile, collectVariables, resolveVariables } from '@vayntforge/engine'
import type { Environment, EnvironmentPhase, Variable } from '@vayntforge/engine'
import { useSession } from '../stores/session'
import { useActiveWorkspaceData, useData } from '../stores/data'

const GLOBAL_ID = '__global__'
const PHASES: EnvironmentPhase[] = ['Development', 'Test', 'Staging', 'Production']

function newVariable(scope: Variable['scope']): Variable {
  return { id: crypto.randomUUID(), key: '', initialValue: '', currentValue: '', scope, secret: false }
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function EnvironmentsPage() {
  const { environments, globalVariables } = useActiveWorkspaceData()
  const activeWorkspaceId = useSession((s) => s.activeWorkspaceId)

  const [tab, setTab] = useState<'environments' | 'inspector'>('environments')
  const [selectedId, setSelectedId] = useState<string>(GLOBAL_ID)
  const [newEnvOpen, setNewEnvOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Environment | null>(null)
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const [preview, setPreview] = useState('{{api_url}}/users/{{userId}}')
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const envFileInputRef = useRef<HTMLInputElement | null>(null)

  const selectedEnv = environments.find((e) => e.id === selectedId)
  const isGlobal = selectedId === GLOBAL_ID
  const rows = isGlobal ? globalVariables : (selectedEnv?.variables ?? [])

  const toggleReveal = (id: string) =>
    setRevealed((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const saveVariable = (v: Variable) => {
    if (isGlobal) void useData.getState().saveGlobalVariable({ ...v, workspaceId: activeWorkspaceId })
    else if (selectedEnv) {
      const next = { ...selectedEnv, variables: replaceOrAppend(selectedEnv.variables, v) }
      void useData.getState().saveEnvironment(next)
    }
  }

  const deleteVariable = (id: string) => {
    if (isGlobal) void useData.getState().deleteGlobalVariable(id)
    else if (selectedEnv) {
      void useData.getState().saveEnvironment({ ...selectedEnv, variables: selectedEnv.variables.filter((v) => v.id !== id) })
    }
  }

  const addRow = () => {
    if (isGlobal) {
      void useData.getState().saveGlobalVariable({ ...newVariable('global'), workspaceId: activeWorkspaceId })
    } else if (selectedEnv) {
      void useData
        .getState()
        .saveEnvironment({ ...selectedEnv, variables: [...selectedEnv.variables, newVariable('environment')] })
    }
  }

  const createEnvironment = (name: string) => {
    const phase: EnvironmentPhase = 'Development'
    void useData
      .getState()
      .saveEnvironment({
        id: `env_${crypto.randomUUID().slice(0, 8)}`,
        name,
        phase,
        isProduction: false,
        workspaceId: activeWorkspaceId,
        variables: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as Environment)
    setNewEnvOpen(false)
  }

  const duplicateEnvironment = () => {
    if (!selectedEnv) return
    const clone: Environment = {
      ...selectedEnv,
      id: `env_${crypto.randomUUID().slice(0, 8)}`,
      name: `${selectedEnv.name} (copy)`,
      variables: selectedEnv.variables.map((v) => ({ ...v, id: crypto.randomUUID() })),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    void useData.getState().saveEnvironment(clone)
    setSelectedId(clone.id)
    toast.success('Environment duplicated', clone.name)
  }

  const exportEnvironment = () => {
    if (!selectedEnv) return
    downloadText(`${selectedEnv.name.replace(/\s+/g, '-').toLowerCase()}.environment.json`, serializeEnvironment(selectedEnv))
    toast.success('Environment exported')
  }

  const importDotEnv = () => importInputRef.current?.click()

  const importEnvironment = () => envFileInputRef.current?.click()

  const onEnvironmentFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const parsed = deserializeEnvironmentFile(await file.text())
      const created = environmentFromFile(parsed, activeWorkspaceId)
      await useData.getState().saveEnvironment(created)
      setSelectedId(created.id)
      toast.success('Environment imported', `${created.name} · ${created.variables.length} variables`)
    } catch (err) {
      toast.error('Import failed', err instanceof Error ? err.message : String(err))
    }
  }

  const onDotEnvSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || (!selectedEnv && !isGlobal)) return
    try {
      const entries = parseDotEnv(await file.text())
      if (entries.length === 0) throw new Error('No KEY=VALUE lines found')
      if (isGlobal) {
        for (const entry of entries) {
          void useData.getState().saveGlobalVariable({
            ...newVariable('global'),
            key: entry.key,
            initialValue: entry.value,
            currentValue: entry.value,
            workspaceId: activeWorkspaceId,
          })
        }
      } else if (selectedEnv) {
        let vars = selectedEnv.variables
        for (const entry of entries) {
          const existing = vars.find((v) => v.key === entry.key)
          vars = existing
            ? vars.map((v) => (v.key === entry.key ? { ...v, initialValue: entry.value, currentValue: entry.value } : v))
            : [...vars, { ...newVariable('environment'), key: entry.key, initialValue: entry.value, currentValue: entry.value }]
        }
        void useData.getState().saveEnvironment({ ...selectedEnv, variables: vars })
      }
      toast.success('.env imported', `${entries.length} variable${entries.length === 1 ? '' : 's'}`)
    } catch (err) {
      toast.error('Import failed', err instanceof Error ? err.message : String(err))
    }
  }

  const resolved = (() => {
    const activeEnv = selectedEnv
    const ctx = collectVariables({
      global: globalVariables.map((v) => ({ key: v.key, value: v.currentValue })),
      environment: (activeEnv?.variables ?? []).map((v) => ({ key: v.key, value: v.currentValue })),
    })
    return resolveVariables(preview, ctx)
  })()

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
        <h1 className="text-[13px] font-semibold text-text">Environments</h1>
        <Tabs
          tabs={[
            { id: 'environments', label: 'Environments' } as TabItem<'environments' | 'inspector'>,
            { id: 'inspector', label: 'Variable Inspector' } as TabItem<'environments' | 'inspector'>,
          ]}
          active={tab}
          onChange={(id) => setTab(id)}
          className="border-b-0 px-0"
        />
      </div>

      {tab === 'environments' ? (
        <div className="flex min-h-0 flex-1">
          <div className="flex w-56 shrink-0 flex-col border-r border-border">
            <div className="flex items-center justify-between border-b border-border px-2.5 py-2">
              <span className="text-[11px] font-semibold tracking-wide text-faint uppercase">Scopes</span>
              <Button size="sm" variant="ghost" onClick={() => setNewEnvOpen(true)} aria-label="New environment">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-1.5">
              <button
                onClick={() => setSelectedId(GLOBAL_ID)}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] ${
                  isGlobal ? 'bg-bg-active text-text' : 'text-muted hover:bg-bg-hover hover:text-text'
                }`}
              >
                <Layers className="h-3.5 w-3.5 text-faint" />
                Global
                <span className="ml-auto text-[10px] text-faint">{globalVariables.length}</span>
              </button>
              {environments.map((e) => (
                <button
                  key={e.id}
                  onClick={() => setSelectedId(e.id)}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] ${
                    selectedId === e.id ? 'bg-bg-active text-text' : 'text-muted hover:bg-bg-hover hover:text-text'
                  }`}
                >
                  <span className="truncate">{e.name}</span>
                  {e.isProduction && (
                    <span className="shrink-0 rounded bg-err/15 px-1 text-[9px] font-medium text-err">PROD</span>
                  )}
                  <span className="ml-auto text-[10px] text-faint">{e.variables.length}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
              <div className="flex items-center gap-2">
                <h2 className="text-[13px] font-medium text-text">{isGlobal ? 'Global variables' : selectedEnv?.name}</h2>
                {!isGlobal && selectedEnv && (
                  <select
                    value={selectedEnv.phase}
                    onChange={(e) => {
                      const phase = e.target.value as EnvironmentPhase
                      void useData
                        .getState()
                        .saveEnvironment({ ...selectedEnv, phase, isProduction: phase === 'Production' })
                    }}
                    className="h-6 rounded border border-border bg-bg-input px-1.5 text-[11px] text-text outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    {PHASES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <Button size="sm" variant="ghost" onClick={importDotEnv}>
                  <Upload className="h-3.5 w-3.5" /> Import .env
                </Button>
                <Button size="sm" variant="ghost" onClick={importEnvironment}>
                  <Upload className="h-3.5 w-3.5" /> Import environment
                </Button>
                {!isGlobal && selectedEnv && (
                  <>
                    <Button size="sm" variant="ghost" onClick={duplicateEnvironment}>
                      <Copy className="h-3.5 w-3.5" /> Duplicate
                    </Button>
                    <Button size="sm" variant="ghost" onClick={exportEnvironment}>
                      <Download className="h-3.5 w-3.5" /> Export
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(selectedEnv)}>
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
                  </>
                )}
              </div>
            </div>
            <input ref={importInputRef} type="file" accept=".env,text/plain" className="hidden" onChange={(e) => void onDotEnvSelected(e)} />
            <input ref={envFileInputRef} type="file" accept=".json" className="hidden" onChange={(e) => void onEnvironmentFileSelected(e)} />

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {rows.length === 0 ? (
                <p className="py-6 text-center text-[12px] text-faint">No variables yet.</p>
              ) : (
                <div className="overflow-hidden rounded-md border border-border">
                  <div className="grid grid-cols-[1fr_1fr_1fr_auto_auto] gap-2 border-b border-border bg-raised px-2 py-1.5 text-[10px] font-semibold tracking-wide text-faint uppercase">
                    <span>Key</span>
                    <span>Initial value</span>
                    <span>Current value</span>
                    <span>Secret</span>
                    <span />
                  </div>
                  {rows.map((v) => {
                    const isRevealed = revealed.has(v.id)
                    const masked = v.secret && !isRevealed
                    return (
                      <div key={v.id} className="grid grid-cols-[1fr_1fr_1fr_auto_auto] items-center gap-2 border-b border-border px-2 py-1 last:border-b-0">
                        <input
                          defaultValue={v.key}
                          onBlur={(e) => saveVariable({ ...v, key: e.target.value })}
                          className="h-7 rounded border border-transparent bg-transparent px-1.5 font-mono text-[12px] text-text outline-none focus:border-accent focus:bg-bg-input"
                        />
                        <input
                          defaultValue={v.initialValue}
                          type={masked ? 'password' : 'text'}
                          onBlur={(e) => saveVariable({ ...v, initialValue: e.target.value })}
                          className="h-7 rounded border border-transparent bg-transparent px-1.5 font-mono text-[12px] text-text outline-none focus:border-accent focus:bg-bg-input"
                        />
                        <div className="flex items-center gap-1">
                          <input
                            defaultValue={v.currentValue}
                            type={masked ? 'password' : 'text'}
                            onBlur={(e) => saveVariable({ ...v, currentValue: e.target.value })}
                            className="h-7 min-w-0 flex-1 rounded border border-transparent bg-transparent px-1.5 font-mono text-[12px] text-text outline-none focus:border-accent focus:bg-bg-input"
                          />
                          {v.currentValue !== v.initialValue && (
                            <button
                              title="Reset to initial value"
                              onClick={() => saveVariable({ ...v, currentValue: v.initialValue })}
                              className="shrink-0 rounded p-1 text-faint hover:bg-bg-hover hover:text-text"
                            >
                              <RotateCcw className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => saveVariable({ ...v, secret: !v.secret })}
                            className={`rounded p-1 ${v.secret ? 'text-accent' : 'text-faint hover:text-text'}`}
                            title={v.secret ? 'Marked secret' : 'Mark as secret'}
                          >
                            {v.secret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                          {v.secret && (
                            <button onClick={() => toggleReveal(v.id)} className="text-[10px] text-faint hover:text-text">
                              {isRevealed ? 'hide' : 'show'}
                            </button>
                          )}
                        </div>
                        <button onClick={() => deleteVariable(v.id)} className="rounded p-1 text-faint hover:bg-bg-hover hover:text-err">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
              <button onClick={addRow} className="mt-2 flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-accent hover:underline">
                <Plus className="h-3.5 w-3.5" /> Add variable
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-2xl space-y-4 p-6">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-faint">Template</label>
            <input
              value={preview}
              onChange={(e) => setPreview(e.target.value)}
              className="h-8 w-full rounded-md border border-border bg-bg-input px-2.5 font-mono text-[12px] text-text outline-none focus:border-accent"
            />
          </div>
          <div className="rounded-md border border-border bg-raised p-3">
            <div className="text-[11px] font-semibold tracking-wide text-faint uppercase">Resolved</div>
            <div className="mt-1 font-mono text-[13px] text-text">{resolved.value}</div>
            {resolved.missingKeys.size > 0 && (
              <div className="mt-2 text-[11px] text-err">Unresolved: {[...resolved.missingKeys].join(', ')}</div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <ScopeList title="Global" variables={globalVariables} />
            <ScopeList title={selectedEnv ? `Environment — ${selectedEnv.name}` : 'Environment'} variables={selectedEnv?.variables ?? []} />
            <ScopeList title="Collection" variables={[]} note="No UI creates collection-scoped variables yet." />
            <ScopeList title="Temporary" variables={[]} note="Nothing populates temporary-scoped variables yet." />
          </div>
        </div>
      )}

      <PromptDialog
        open={newEnvOpen}
        title="New environment"
        label="Name"
        placeholder="e.g. Staging"
        confirmLabel="Create"
        onCancel={() => setNewEnvOpen(false)}
        onConfirm={createEnvironment}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete environment?"
        description={`"${deleteTarget?.name}" and its variables will be permanently deleted.`}
        confirmLabel="Delete"
        tone="danger"
        onConfirm={() => {
          if (deleteTarget) {
            void useData.getState().deleteEnvironment(deleteTarget.id)
            if (selectedId === deleteTarget.id) setSelectedId(GLOBAL_ID)
          }
          setDeleteTarget(null)
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}

function replaceOrAppend(list: Variable[], v: Variable): Variable[] {
  return list.some((x) => x.id === v.id) ? list.map((x) => (x.id === v.id ? v : x)) : [...list, v]
}

function ScopeList({ title, variables, note }: { title: string; variables: Variable[]; note?: string }) {
  return (
    <div className="rounded-md border border-border p-2.5">
      <div className="mb-1.5 text-[11px] font-semibold tracking-wide text-faint uppercase">{title}</div>
      {variables.length === 0 ? (
        note ? (
          <p className="text-[11px] text-faint">{note}</p>
        ) : (
          <EmptyState title="No variables" />
        )
      ) : (
        <div className="space-y-1">
          {variables.map((v) => (
            <div key={v.id} className="flex items-center justify-between gap-2 text-[11px]">
              <span className="truncate font-mono text-muted">{v.key}</span>
              <span className="truncate font-mono text-faint">{v.secret ? '••••••' : v.currentValue}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
