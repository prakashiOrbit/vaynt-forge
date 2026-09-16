import { useMemo, useRef, useState } from 'react'
import { BookOpen, ChevronRight, FileJson, FolderPlus, Globe, Play, Server, Trash2, Upload } from 'lucide-react'
import { Button, ConfirmDialog, EmptyState, MethodBadge, PromptDialog, StatusBadge, Tabs, toast, type TabItem } from '@vayntforge/ui'
import {
  createDraftRequest,
  parseOpenApiSpec,
  parseOpenApiText,
  planCollectionFromSpec,
  planMockEndpointsFromSpec,
  planRequestFromOperation,
} from '@vayntforge/engine'
import type { MockServer, OpenApiOperation, OpenApiSpec } from '@vayntforge/engine'
import { useSession } from '../stores/session'
import { useActiveWorkspaceData, useData } from '../stores/data'
import { useRequestDrafts } from '../stores/requestDrafts'
import { useOpenApiUi } from '../stores/openApiUi'
import { CodeSamplePanel, ParametersTable, RequestBodySection, ResponsesSection } from '../components/openapi/EndpointSections'

function detectFormat(text: string): 'json' | 'yaml' {
  return text.trim().startsWith('{') ? 'json' : 'yaml'
}

function nameFromUrl(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return 'Imported spec'
  }
}

export function OpenApiPage() {
  const { openApiSpecs, mockServers } = useActiveWorkspaceData()
  const activeWorkspaceId = useSession((s) => s.activeWorkspaceId)
  const openTab = useSession((s) => s.openTab)
  const setActiveNav = useSession((s) => s.setActiveNav)
  const selectedSpecId = useOpenApiUi((s) => s.selectedSpecId)
  const setSelectedSpec = useOpenApiUi((s) => s.setSelectedSpec)
  const openDocs = useOpenApiUi((s) => s.openDocs)

  const [urlDialogOpen, setUrlDialogOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<OpenApiSpec | null>(null)
  const [selectedOpId, setSelectedOpId] = useState<string | null>(null)
  const [detailTab, setDetailTab] = useState<'overview' | 'code'>('overview')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const selectedSpec = openApiSpecs.find((s) => s.id === selectedSpecId) ?? openApiSpecs[0]

  const parsed = useMemo(() => {
    if (!selectedSpec) return null
    try {
      return parseOpenApiSpec(parseOpenApiText(selectedSpec.raw))
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) } as const
    }
  }, [selectedSpec])

  const spec = parsed && !('error' in parsed) ? parsed : null
  const baseUrl = spec?.servers[0]?.url ?? ''
  const opKey = (op: OpenApiOperation) => `${op.method} ${op.path}`
  const selectedOp = spec?.operations.find((op) => opKey(op) === selectedOpId) ?? null

  const importText = async (raw: string, name: string, sourceUrl?: string) => {
    let doc: ReturnType<typeof parseOpenApiText> | undefined
    try {
      doc = parseOpenApiText(raw)
      parseOpenApiSpec(doc)
    } catch (err) {
      toast.error('Import failed', err instanceof Error ? err.message : String(err))
      return
    }
    const info = (doc as { info?: { title?: string } }).info
    const created = await useData.getState().createOpenApiSpec({
      workspaceId: activeWorkspaceId,
      name: info?.title ?? name,
      format: detectFormat(raw),
      raw,
      sourceUrl,
    })
    setSelectedSpec(created.id)
    toast.success('OpenAPI spec imported', created.name)
    void useData.getState().addNotification({
      workspaceId: activeWorkspaceId,
      tone: 'success',
      title: 'OpenAPI spec imported',
      message: created.name,
      read: false,
      dismissed: false,
    })
  }

  const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    await importText(await file.text(), file.name.replace(/\.(json|ya?ml)$/i, ''))
  }

  const importFromUrl = async (url: string) => {
    setUrlDialogOpen(false)
    setImporting(true)
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      await importText(await res.text(), nameFromUrl(url), url)
    } catch (err) {
      toast.error('Could not fetch URL', err instanceof Error ? err.message : String(err))
    } finally {
      setImporting(false)
    }
  }

  const generateCollection = async () => {
    if (!spec) return
    const plan = planCollectionFromSpec(spec, baseUrl)
    const collection = await useData.getState().createCollection({ workspaceId: activeWorkspaceId, name: plan.name })
    let count = 0
    for (const group of plan.groups) {
      const folder = await useData.getState().createFolder({ collectionId: collection.id, name: group.tag, requestIds: [] })
      for (const req of group.requests) {
        const id = `req_${crypto.randomUUID().slice(0, 8)}`
        const draft = createDraftRequest({
          id,
          workspaceId: activeWorkspaceId,
          collectionId: collection.id,
          method: req.method,
          name: req.name,
          url: req.url,
        })
        draft.folderId = folder.id
        draft.params = req.params
        draft.headers = req.headers
        draft.auth = req.auth
        draft.body = req.body
        draft.assertions = req.assertions
        draft.variables = req.variables
        await useData.getState().saveRequest(draft)
        count++
      }
    }
    toast.success('Collection generated', `${plan.name} · ${count} requests`)
    setActiveNav('collections')
  }

  const generateMockServer = async () => {
    if (!spec) return
    const endpoints = planMockEndpointsFromSpec(spec)
    const server: MockServer = {
      id: `mock_${crypto.randomUUID().slice(0, 8)}`,
      name: `${spec.info.title} Mock`,
      workspaceId: activeWorkspaceId,
      port: 4100 + mockServers.length,
      status: 'stopped',
      latencyMs: 100,
      endpoints,
      log: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    await useData.getState().saveMockServer(server)
    toast.success('Mock server generated', `${server.name} · ${endpoints.length} endpoints on :${server.port}`)
    setActiveNav('mock-servers')
  }

  const sendRequest = (op: OpenApiOperation) => {
    const planned = planRequestFromOperation(op, baseUrl)
    const id = `req_${crypto.randomUUID().slice(0, 8)}`
    const draft = createDraftRequest({ id, workspaceId: activeWorkspaceId, method: planned.method, name: planned.name, url: planned.url })
    draft.params = planned.params
    draft.headers = planned.headers
    draft.auth = planned.auth
    draft.body = planned.body
    draft.assertions = planned.assertions
    useRequestDrafts.getState().reset(id, draft)
    openTab({ id, method: draft.method, name: draft.name, url: draft.url })
  }

  const importControls = (
    <>
      <input ref={fileInputRef} type="file" accept=".json,.yaml,.yml" className="hidden" onChange={(e) => void onFileSelected(e)} />
      <PromptDialog
        open={urlDialogOpen}
        title="Import OpenAPI from URL"
        label="Spec URL"
        placeholder="https://petstore3.swagger.io/api/v3/openapi.json"
        confirmLabel={importing ? 'Importing…' : 'Import'}
        onCancel={() => setUrlDialogOpen(false)}
        onConfirm={(url) => void importFromUrl(url)}
      />
    </>
  )

  if (openApiSpecs.length === 0) {
    return (
      <div className="flex h-full flex-col">
        {importControls}
        <EmptyState
          icon={FileJson}
          title="No OpenAPI specs yet"
          description="Import a spec (JSON, YAML, or a URL) to explore its endpoints, generate a collection or mock server, and produce full documentation."
          action={
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-3.5 w-3.5" /> Import file
              </Button>
              <Button size="sm" variant="outline" onClick={() => setUrlDialogOpen(true)}>
                <Globe className="h-3.5 w-3.5" /> Import from URL
              </Button>
            </div>
          }
        />
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {importControls}

      <div className="flex w-56 shrink-0 flex-col border-r border-border">
        <div className="flex items-center justify-between border-b border-border px-2.5 py-2">
          <span className="text-[11px] font-semibold tracking-wide text-faint uppercase">Specs</span>
          <div className="flex items-center gap-0.5">
            <Button size="sm" variant="ghost" onClick={() => fileInputRef.current?.click()} aria-label="Import file">
              <Upload className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setUrlDialogOpen(true)} aria-label="Import from URL">
              <Globe className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-1.5">
          {openApiSpecs.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setSelectedSpec(s.id)
                setSelectedOpId(null)
              }}
              className={`group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] ${
                selectedSpec?.id === s.id ? 'bg-bg-active text-text' : 'text-muted hover:bg-bg-hover hover:text-text'
              }`}
            >
              <FileJson className="h-3.5 w-3.5 shrink-0 text-faint" />
              <span className="min-w-0 flex-1 truncate">{s.name}</span>
              <Trash2
                className="h-3 w-3 shrink-0 text-faint opacity-0 hover:text-err group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation()
                  setDeleteTarget(s)
                }}
              />
            </button>
          ))}
        </div>
      </div>

      {!selectedSpec ? (
        <EmptyState icon={FileJson} title="Select a spec" />
      ) : !spec ? (
        <EmptyState icon={FileJson} title="Couldn’t parse this spec" description={parsed && 'error' in parsed ? parsed.error : 'Unknown parsing error.'} />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 border-b border-border p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-[14px] font-semibold text-text">{spec.info.title}</h1>
                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-faint">
                  <span>v{spec.info.version}</span>
                  {baseUrl && <span className="font-mono">{baseUrl}</span>}
                  {spec.sourceDialect === 'swagger2' && (
                    <StatusBadge tone="neutral" title="This spec was written in Swagger 2.0 and normalized into OpenAPI 3.0 on import">
                      Swagger 2.0 → converted
                    </StatusBadge>
                  )}
                </div>
                {spec.info.description && <p className="mt-1.5 max-w-xl text-[12px] leading-relaxed text-muted">{spec.info.description}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button size="sm" variant="outline" onClick={() => void generateCollection()}>
                  <FolderPlus className="h-3.5 w-3.5" /> Generate Collection
                </Button>
                <Button size="sm" variant="outline" onClick={() => void generateMockServer()}>
                  <Server className="h-3.5 w-3.5" /> Generate Mock Server
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    openDocs(selectedSpec.id)
                    setActiveNav('documentation')
                  }}
                >
                  <BookOpen className="h-3.5 w-3.5" /> Documentation
                </Button>
              </div>
            </div>
            {(spec.securitySchemes.length > 0 || spec.tags.length > 0) && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {spec.securitySchemes.map((sec) => (
                  <StatusBadge key={sec.name} tone="info">
                    {sec.name} · {sec.type}
                    {sec.scheme ? ` (${sec.scheme})` : ''}
                  </StatusBadge>
                ))}
                {spec.tags.map((t) => (
                  <StatusBadge key={t.name} tone="neutral">
                    {t.name}
                  </StatusBadge>
                ))}
              </div>
            )}
          </div>

          <div className="flex min-h-0 flex-1">
            <div className="w-64 shrink-0 overflow-y-auto border-r border-border p-1.5">
              {spec.tags.map((tag) => {
                const ops = spec.operations.filter((op) => (op.tags[0] ?? 'General') === tag.name)
                if (ops.length === 0) return null
                return (
                  <div key={tag.name} className="mb-2">
                    <div className="px-1.5 py-1 text-[10px] font-semibold tracking-wide text-faint uppercase">{tag.name}</div>
                    {ops.map((op) => {
                      const key = opKey(op)
                      return (
                        <button
                          key={key}
                          onClick={() => setSelectedOpId(key)}
                          className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left ${
                            selectedOpId === key ? 'bg-bg-active text-text' : 'hover:bg-bg-hover'
                          }`}
                        >
                          <span className="w-10 shrink-0">
                            <MethodBadge method={op.method} />
                          </span>
                          <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted">{op.path}</span>
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {!selectedOp ? (
                <EmptyState icon={ChevronRight} title="Select an endpoint" description={`${spec.operations.length} operation${spec.operations.length === 1 ? '' : 's'} in this spec.`} />
              ) : (
                <div className="max-w-3xl space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <MethodBadge method={selectedOp.method} />
                        <span className="font-mono text-[13px] text-text">{selectedOp.path}</span>
                      </div>
                      {selectedOp.summary && <h2 className="mt-1 text-[13px] font-semibold text-text">{selectedOp.summary}</h2>}
                      {selectedOp.description && selectedOp.description !== selectedOp.summary && (
                        <p className="mt-0.5 text-[12px] text-muted">{selectedOp.description}</p>
                      )}
                    </div>
                    <Button size="sm" onClick={() => sendRequest(selectedOp)}>
                      <Play className="h-3.5 w-3.5" /> Send Request
                    </Button>
                  </div>

                  <Tabs
                    tabs={[
                      { id: 'overview', label: 'Overview' } as TabItem<'overview' | 'code'>,
                      { id: 'code', label: 'Code Samples' } as TabItem<'overview' | 'code'>,
                    ]}
                    active={detailTab}
                    onChange={(id) => setDetailTab(id)}
                    className="border-b-0 px-0"
                  />

                  {detailTab === 'overview' ? (
                    <div className="space-y-4">
                      <ParametersTable op={selectedOp} />
                      <RequestBodySection op={selectedOp} />
                      <ResponsesSection op={selectedOp} />
                    </div>
                  ) : (
                    <CodeSamplePanel op={selectedOp} baseUrl={baseUrl} />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete OpenAPI spec?"
        description={`"${deleteTarget?.name}" will be permanently deleted. Collections/mock servers already generated from it are unaffected.`}
        confirmLabel="Delete"
        tone="danger"
        onConfirm={() => {
          if (deleteTarget) {
            void useData.getState().deleteOpenApiSpec(deleteTarget.id)
            if (selectedSpec?.id === deleteTarget.id) setSelectedSpec(null)
          }
          setDeleteTarget(null)
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
