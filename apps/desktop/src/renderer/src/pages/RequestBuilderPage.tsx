import { useEffect, useMemo, useState } from 'react'
import { ConfirmDialog, EmptyState, Tabs, toast, type TabItem } from '@vayntforge/ui'
import { FileQuestion } from 'lucide-react'
import { createDraftRequest, type RequestModel } from '@vayntforge/engine'
import { useSession } from '../stores/session'
import { useActiveWorkspaceData, useData } from '../stores/data'
import { useRequestDraft, useRequestDrafts } from '../stores/requestDrafts'
import { useResponseEntry, useResponses } from '../stores/responses'
import { useDragResize } from '../lib/useDragResize'
import { runAndRecordRequest } from '../lib/runAndRecord'
import { RequestExplorer } from '../components/request-builder/RequestExplorer'
import { RequestHeader } from '../components/request-builder/RequestHeader'
import { ParamsPanel } from '../components/request-builder/ParamsPanel'
import { AuthorizationPanel } from '../components/request-builder/AuthorizationPanel'
import { HeadersPanel } from '../components/request-builder/HeadersPanel'
import { BodyPanel } from '../components/request-builder/BodyPanel'
import { ScriptsPanel } from '../components/request-builder/ScriptsPanel'
import { TestsPanel } from '../components/request-builder/TestsPanel'
import { SettingsPanel } from '../components/request-builder/SettingsPanel'
import { ResponsePanel } from '../components/request-builder/ResponsePanel'
import type { RequestPanelProps } from '../components/request-builder/types'

type SubTab = 'params' | 'auth' | 'headers' | 'body' | 'scripts' | 'tests' | 'settings'

const SUB_TABS: TabItem<SubTab>[] = [
  { id: 'params', label: 'Params' },
  { id: 'auth', label: 'Authorization' },
  { id: 'headers', label: 'Headers' },
  { id: 'body', label: 'Body' },
  { id: 'scripts', label: 'Scripts' },
  { id: 'tests', label: 'Tests' },
  { id: 'settings', label: 'Settings' },
]

const EXPLORER_MIN = 180
const EXPLORER_MAX = 420
const RESPONSE_MIN = 120
const RESPONSE_MAX = 640

export function RequestBuilderPage() {
  const activeTabId = useSession((s) => s.activeTabId)
  const tabs = useSession((s) => s.tabs)
  const updateTab = useSession((s) => s.updateTab)
  const closeTab = useSession((s) => s.closeTab)
  const openTab = useSession((s) => s.openTab)
  const activeWorkspaceId = useSession((s) => s.activeWorkspaceId)
  const activeEnvironmentId = useSession((s) => s.activeEnvironmentId)
  const explorerWidth = useSession((s) => s.explorerWidth)
  const setExplorerWidth = useSession((s) => s.setExplorerWidth)
  const responseHeight = useSession((s) => s.responseHeight)
  const setResponseHeight = useSession((s) => s.setResponseHeight)

  const { requests, environments, globalVariables } = useActiveWorkspaceData()
  const draft = useRequestDraft(activeTabId)
  const [subTab, setSubTab] = useState<SubTab>('params')
  const [confirmDestructiveSend, setConfirmDestructiveSend] = useState(false)
  const responseEntry = useResponseEntry(activeTabId)
  const sending = Boolean(responseEntry?.sending)

  const tab = tabs.find((t) => t.id === activeTabId)
  const savedRequest = requests.find((r) => r.id === activeTabId)
  const activeEnv = environments.find((e) => e.id === activeEnvironmentId)

  useEffect(() => {
    if (!activeTabId) return
    const base =
      savedRequest ??
      createDraftRequest({
        id: activeTabId,
        workspaceId: activeWorkspaceId,
        method: tab?.method,
        name: tab?.name,
        url: tab?.url,
      })
    useRequestDrafts.getState().ensure(activeTabId, base)
  }, [activeTabId, savedRequest, activeWorkspaceId])

  const explorerResize = useDragResize({
    axis: 'x',
    min: EXPLORER_MIN,
    max: EXPLORER_MAX,
    onChange: setExplorerWidth,
  })
  const responseResize = useDragResize({
    axis: 'y',
    min: RESPONSE_MIN,
    max: RESPONSE_MAX,
    onChange: setResponseHeight,
  })

  const suggestions = useMemo(() => {
    const names = new Set<string>([
      ...globalVariables.map((v) => v.key),
      ...(activeEnv?.variables.map((v) => v.key) ?? []),
      ...(draft?.variables.map((v) => v.key) ?? []),
      '$guid',
      '$timestamp',
      '$randomInt',
    ])
    return [...names]
  }, [activeEnv, globalVariables, draft?.variables])

  if (!activeTabId || !tab || !draft) {
    return (
      <EmptyState
        icon={FileQuestion}
        title="No request open"
        description="Open a request from the explorer or start a new one."
      />
    )
  }

  const update: RequestPanelProps['update'] = (updater) => {
    const next = updater(draft)
    useRequestDrafts.getState().update(activeTabId, () => next)
    updateTab(activeTabId, { name: next.name, method: next.method, url: next.url, dirty: true })
  }

  const handleSave = () => {
    void useData.getState().saveRequest(draft)
    updateTab(activeTabId, { dirty: false })
    toast.success('Request saved', draft.name)
  }

  const executeSend = () => {
    runAndRecordRequest({
      request: draft,
      tabId: activeTabId,
      workspaceId: activeWorkspaceId,
      environmentId: activeEnvironmentId,
      globalVariables,
      environment: activeEnv,
    })
      .then(({ preScript, postScript }) => {
        if (preScript?.error) toast.error('Pre-request script error', preScript.error)
        if (postScript?.error) toast.error('Post-response script error', postScript.error)
      })
      .catch((err) => {
        useResponses.getState().setSending(activeTabId, false)
        toast.error('Send failed', err instanceof Error ? err.message : String(err))
      })
  }

  const isDestructive = draft.method === 'DELETE'
  const needsProductionConfirm = isDestructive && Boolean(activeEnv?.isProduction)

  const handleSend = () => {
    if (needsProductionConfirm) setConfirmDestructiveSend(true)
    else executeSend()
  }

  const handleDuplicate = () => {
    const id = `req_${crypto.randomUUID().slice(0, 8)}`
    const clone: RequestModel = { ...draft, id, name: `${draft.name} (copy)`, createdAt: Date.now(), updatedAt: Date.now() }
    openTab({ id, method: clone.method, name: clone.name, url: clone.url, dirty: true })
    useRequestDrafts.getState().reset(id, clone)
  }

  const handleDelete = () => {
    if (savedRequest) void useData.getState().deleteRequest(draft.id)
    useRequestDrafts.getState().remove(activeTabId)
    useResponses.getState().remove(activeTabId)
    closeTab(activeTabId)
    toast.success('Request deleted', draft.name)
  }

  const panelProps: RequestPanelProps = { draft, update, suggestions }

  return (
    <div className="flex h-full">
      <div className="relative shrink-0 border-r border-border" style={{ width: explorerWidth }}>
        <RequestExplorer />
        <div
          onPointerDown={explorerResize.onPointerDown}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize explorer"
          className="absolute inset-y-0 right-0 z-10 w-1 cursor-col-resize bg-transparent hover:bg-accent/40 active:bg-accent"
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <RequestHeader
          {...panelProps}
          sending={sending}
          onSend={handleSend}
          onSave={handleSave}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
          isSaved={Boolean(savedRequest)}
          dirty={Boolean(tab.dirty)}
        />
        <Tabs tabs={SUB_TABS} active={subTab} onChange={(id) => setSubTab(id)} />
        <div className="min-h-0 flex-1 overflow-auto">
          {subTab === 'params' && <ParamsPanel {...panelProps} />}
          {subTab === 'auth' && <AuthorizationPanel {...panelProps} />}
          {subTab === 'headers' && <HeadersPanel {...panelProps} />}
          {subTab === 'body' && <BodyPanel {...panelProps} />}
          {subTab === 'scripts' && <ScriptsPanel {...panelProps} />}
          {subTab === 'tests' && <TestsPanel {...panelProps} />}
          {subTab === 'settings' && <SettingsPanel {...panelProps} />}
        </div>

        <div className="relative shrink-0 border-t border-border" style={{ height: responseHeight }}>
          <div
            onPointerDown={responseResize.onPointerDown}
            role="separator"
            aria-orientation="horizontal"
            aria-label="Resize response panel"
            className="absolute inset-x-0 top-0 z-10 h-1 cursor-row-resize bg-transparent hover:bg-accent/40 active:bg-accent"
          />
          <ResponsePanel draft={draft} entry={responseEntry} onSend={handleSend} />
        </div>
      </div>

      <ConfirmDialog
        open={confirmDestructiveSend}
        title="Send a destructive request to Production?"
        description={`${draft.method} ${draft.url} — this runs against a Production environment. Make sure that's intentional.`}
        confirmLabel="Execute anyway"
        tone="danger"
        onConfirm={() => {
          setConfirmDestructiveSend(false)
          executeSend()
        }}
        onCancel={() => setConfirmDestructiveSend(false)}
      />
    </div>
  )
}
