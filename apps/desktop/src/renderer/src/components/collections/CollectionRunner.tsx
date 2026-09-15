import { useRef, useState } from 'react'
import { CheckCircle2, Circle, MinusCircle, Play, Upload, X } from 'lucide-react'
import { Button, MethodBadge, Modal, Tabs, toast, type TabItem } from '@vayntforge/ui'
import { evaluateAssertions, resolvePath } from '@vayntforge/engine'
import type { ChainRule, RequestModel, RunStatus, TestRunRequestResult } from '@vayntforge/engine'
import { useSession } from '../../stores/session'
import { useActiveWorkspaceData, useData } from '../../stores/data'
import { sendRequest, type KV } from '../../lib/sendRequest'

type RunnerTab = 'config' | 'chain'

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

const STATUS_ICON: Record<RunStatus, { icon: typeof CheckCircle2; className: string }> = {
  pass: { icon: CheckCircle2, className: 'text-ok' },
  fail: { icon: MinusCircle, className: 'text-err' },
  skip: { icon: Circle, className: 'text-faint' },
}

export function CollectionRunner({
  collectionId,
  onClose,
  onOpenRequestBuilder,
}: {
  collectionId: string
  onClose(): void
  onOpenRequestBuilder(): void
}) {
  const { collections, requests, environments, globalVariables } = useActiveWorkspaceData()
  const activeWorkspaceId = useSession((s) => s.activeWorkspaceId)
  const activeEnvironmentId = useSession((s) => s.activeEnvironmentId)
  const openTab = useSession((s) => s.openTab)

  const collection = collections.find((c) => c.id === collectionId)
  const collectionRequests = requests.filter((r) => r.collectionId === collectionId)

  const [tab, setTab] = useState<RunnerTab>('config')
  const [environmentId, setEnvironmentId] = useState(activeEnvironmentId)
  const [iterations, setIterations] = useState(1)
  const [delayMs, setDelayMs] = useState(0)
  const [concurrency, setConcurrency] = useState(1)
  const [dataRows, setDataRows] = useState<Record<string, unknown>[] | null>(null)
  const [chainRules, setChainRules] = useState<ChainRule[]>(collection?.chainRules ?? [])

  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<TestRunRequestResult[]>([])
  const [finished, setFinished] = useState(false)

  const dataFileInputRef = useRef<HTMLInputElement | null>(null)
  const environment = environments.find((e) => e.id === environmentId)
  const hasEnabledChain = chainRules.some((r) => r.enabled)
  const effectiveConcurrency = hasEnabledChain ? 1 : Math.max(1, concurrency)

  const passed = results.filter((r) => r.status === 'pass').length
  const failed = results.filter((r) => r.status === 'fail').length
  const skipped = results.filter((r) => r.status === 'skip').length

  const persistChainRules = (next: ChainRule[]) => {
    setChainRules(next)
    void useData.getState().updateCollection(collectionId, { chainRules: next })
  }

  const ruleFor = (requestId: string) => chainRules.find((r) => r.requestId === requestId)

  const setRule = (requestId: string, patch: Partial<Omit<ChainRule, 'id' | 'requestId'>>) => {
    const existing = ruleFor(requestId)
    if (existing) {
      persistChainRules(chainRules.map((r) => (r.requestId === requestId ? { ...r, ...patch } : r)))
    } else {
      persistChainRules([
        ...chainRules,
        { id: `chain_${requestId}`, requestId, jsonPath: '', variableName: '', enabled: true, ...patch },
      ])
    }
  }

  const onDataFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text())
      if (!Array.isArray(parsed) || parsed.some((r) => typeof r !== 'object' || r === null)) {
        throw new Error('Expected a JSON array of objects, one per iteration')
      }
      setDataRows(parsed)
      setIterations(parsed.length)
      toast.success('Data file loaded', `${parsed.length} row${parsed.length === 1 ? '' : 's'}`)
    } catch (err) {
      toast.error('Could not read data file', err instanceof Error ? err.message : String(err))
    }
  }

  const run = async () => {
    if (collectionRequests.length === 0) {
      toast.error('Nothing to run', 'This collection has no requests yet.')
      return
    }
    setRunning(true)
    setFinished(false)
    setResults([])
    const startedAt = Date.now()
    const allResults: TestRunRequestResult[] = []
    const extractedVars: KV[] = []

    for (let iter = 0; iter < Math.max(1, iterations); iter++) {
      const row = dataRows?.[iter % dataRows.length]
      const rowVars: KV[] = row ? Object.entries(row).map(([key, value]) => ({ key, value: String(value) })) : []

      let cursor = 0
      const runOne = async (req: RequestModel) => {
        if (delayMs > 0) await sleep(delayMs)
        const { response } = await sendRequest(req, globalVariables, environment, [...extractedVars, ...rowVars])

        const rule = ruleFor(req.id)
        if (rule?.enabled && rule.jsonPath && rule.variableName) {
          const value = resolvePath(response.body, rule.jsonPath)
          if (value !== undefined) {
            const idx = extractedVars.findIndex((v) => v.key === rule.variableName)
            const entry = { key: rule.variableName, value: String(value) }
            if (idx === -1) extractedVars.push(entry)
            else extractedVars[idx] = entry
          }
        }

        const enabledAssertions = req.assertions.filter((a) => a.enabled)
        const assertionResults = evaluateAssertions(req.assertions, response)
        const status: RunStatus =
          enabledAssertions.length === 0 ? 'skip' : assertionResults.every((a) => a.passed) ? 'pass' : 'fail'

        const result: TestRunRequestResult = {
          requestId: req.id,
          requestName: req.name,
          status,
          durationMs: response.timeMs,
          assertionsPassed: assertionResults.filter((a) => a.passed).length,
          assertionsFailed: assertionResults.filter((a) => !a.passed).length,
          error: response.error?.message,
        }
        allResults.push(result)
        setResults([...allResults])
      }

      const workers = Array.from({ length: effectiveConcurrency }, async () => {
        while (cursor < collectionRequests.length) {
          const req = collectionRequests[cursor++]
          if (req) await runOne(req)
        }
      })
      await Promise.all(workers)
    }

    await useData.getState().saveTestRun({
      id: `run_${crypto.randomUUID().slice(0, 8)}`,
      name: `${collection?.name ?? 'Collection'} run`,
      collectionId,
      workspaceId: activeWorkspaceId,
      startedAt,
      finishedAt: Date.now(),
      iterations: Math.max(1, iterations),
      passed: allResults.filter((r) => r.status === 'pass').length,
      failed: allResults.filter((r) => r.status === 'fail').length,
      skipped: allResults.filter((r) => r.status === 'skip').length,
      results: allResults,
    })

    setRunning(false)
    setFinished(true)
    const p = allResults.filter((r) => r.status === 'pass').length
    const f = allResults.filter((r) => r.status === 'fail').length
    toast[f > 0 ? 'error' : 'success']('Run complete', `${p} passed · ${f} failed`)
    void useData.getState().addNotification({
      workspaceId: activeWorkspaceId,
      tone: f > 0 ? 'error' : 'success',
      title: 'Collection run complete',
      message: `${collection?.name ?? 'Collection'} · ${p} passed · ${f} failed`,
      read: false,
      dismissed: false,
    })
  }

  const openFailedRequest = (requestId: string) => {
    const req = collectionRequests.find((r) => r.id === requestId)
    if (!req) return
    openTab({ id: req.id, method: req.method, name: req.name, url: req.url })
    onOpenRequestBuilder()
    onClose()
  }

  const tabs: TabItem<RunnerTab>[] = [
    { id: 'config', label: 'Config' },
    { id: 'chain', label: 'Chain', badge: chainRules.filter((r) => r.enabled).length },
  ]

  return (
    <Modal open onClose={onClose} title={`Run “${collection?.name ?? 'Collection'}”`} width="max-w-2xl">
      <input ref={dataFileInputRef} type="file" accept=".json" className="hidden" onChange={(e) => void onDataFile(e)} />

      {!running && !finished && (
        <>
          <Tabs tabs={tabs} active={tab} onChange={(id) => setTab(id)} className="-mx-4 mb-3 px-4" />

          {tab === 'config' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-faint">Environment</label>
                  <select
                    value={environmentId}
                    onChange={(e) => setEnvironmentId(e.target.value)}
                    className="h-8 w-full rounded-md border border-border bg-bg-input px-2.5 text-[12px] text-text outline-none focus:border-accent"
                  >
                    <option value="">None</option>
                    {environments.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                        {e.isProduction ? ' (Production)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-faint">Iterations</label>
                  <input
                    type="number"
                    min={1}
                    value={iterations}
                    onChange={(e) => setIterations(Math.max(1, Number(e.target.value)))}
                    disabled={Boolean(dataRows)}
                    className="h-8 w-full rounded-md border border-border bg-bg-input px-2.5 text-[12px] text-text outline-none focus:border-accent disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-faint">Delay between requests (ms)</label>
                  <input
                    type="number"
                    min={0}
                    value={delayMs}
                    onChange={(e) => setDelayMs(Math.max(0, Number(e.target.value)))}
                    className="h-8 w-full rounded-md border border-border bg-bg-input px-2.5 text-[12px] text-text outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-faint">
                    Concurrency {hasEnabledChain && <span className="text-faint">(forced to 1 — chain enabled)</span>}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={collectionRequests.length || 1}
                    value={concurrency}
                    disabled={hasEnabledChain}
                    onChange={(e) => setConcurrency(Math.max(1, Number(e.target.value)))}
                    className="h-8 w-full rounded-md border border-border bg-bg-input px-2.5 text-[12px] text-text outline-none focus:border-accent disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-faint">Data file (JSON array, one object per iteration)</label>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => dataFileInputRef.current?.click()}>
                    <Upload className="h-3.5 w-3.5" /> Choose file
                  </Button>
                  {dataRows && (
                    <>
                      <span className="text-[12px] text-muted">{dataRows.length} rows loaded</span>
                      <button onClick={() => setDataRows(null)} className="text-[11px] text-faint hover:text-text">
                        Clear
                      </button>
                    </>
                  )}
                </div>
              </div>

              <p className="text-[12px] text-faint">
                {collectionRequests.length} request{collectionRequests.length === 1 ? '' : 's'} in this collection.
              </p>
            </div>
          )}

          {tab === 'chain' && (
            <div className="space-y-2">
              <p className="text-[11px] text-faint">
                Extract a value from a request's response into a variable the requests after it can use — real
                request chaining, propagated between requests in the same run.
              </p>
              {collectionRequests.length === 0 ? (
                <p className="py-4 text-center text-[12px] text-faint">No requests in this collection yet.</p>
              ) : (
                collectionRequests.map((r) => {
                  const rule = ruleFor(r.id)
                  return (
                    <div key={r.id} className="rounded-md border border-border p-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={Boolean(rule?.enabled)}
                          onChange={(e) => setRule(r.id, { enabled: e.target.checked })}
                          className="h-3.5 w-3.5 shrink-0 accent-[var(--af-accent)]"
                        />
                        <MethodBadge method={r.method} />
                        <span className="min-w-0 flex-1 truncate text-[12px] text-text">{r.name}</span>
                      </div>
                      {rule?.enabled && (
                        <div className="mt-2 grid grid-cols-2 gap-2 pl-5.5">
                          <input
                            defaultValue={rule.jsonPath}
                            placeholder="$.token"
                            onBlur={(e) => setRule(r.id, { jsonPath: e.target.value })}
                            className="h-7 rounded border border-border bg-bg-input px-2 font-mono text-[11px] text-text outline-none focus:border-accent"
                          />
                          <input
                            defaultValue={rule.variableName}
                            placeholder="access_token"
                            onBlur={(e) => setRule(r.id, { variableName: e.target.value })}
                            className="h-7 rounded border border-border bg-bg-input px-2 font-mono text-[11px] text-text outline-none focus:border-accent"
                          />
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          )}

          <div className="mt-4 flex justify-end gap-2 border-t border-border pt-3">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => void run()}>
              <Play className="h-3.5 w-3.5" /> Run collection
            </Button>
          </div>
        </>
      )}

      {(running || finished) && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[12px] text-muted">
              {running ? `Running ${results.length}/${collectionRequests.length * Math.max(1, iterations)}…` : 'Run complete'}
            </span>
            <span className="text-[12px] font-medium">
              <span className="text-ok">{passed} passed</span> · <span className="text-err">{failed} failed</span>
              {skipped > 0 && <span className="text-faint"> · {skipped} skipped</span>}
            </span>
          </div>
          <div className="max-h-80 space-y-1 overflow-y-auto">
            {results.map((r, i) => {
              const meta = STATUS_ICON[r.status]
              const Icon = meta.icon
              return (
                <button
                  key={`${r.requestId}_${i}`}
                  onClick={() => (r.status === 'fail' ? openFailedRequest(r.requestId) : undefined)}
                  className={`flex w-full items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-left ${
                    r.status === 'fail' ? 'cursor-pointer hover:border-border-strong' : 'cursor-default'
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 shrink-0 ${meta.className}`} />
                  <span className="min-w-0 flex-1 truncate text-[12px] text-text">{r.requestName}</span>
                  {r.error && <span className="truncate text-[11px] text-err">{r.error}</span>}
                  <span className="shrink-0 font-mono text-[11px] text-faint">{r.durationMs}ms</span>
                </button>
              )
            })}
          </div>
          <div className="mt-4 flex justify-end gap-2 border-t border-border pt-3">
            {finished && (
              <Button variant="outline" size="sm" onClick={() => setFinished(false)}>
                Run again
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onClose} disabled={running}>
              <X className="h-3.5 w-3.5" /> Close
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
