import { useState, type ReactNode } from 'react'
import { AlertTriangle, Bug, Copy, ExternalLink, RefreshCw, TriangleAlert } from 'lucide-react'
import { Button, EmptyState, MethodBadge, StatusCode, toast } from '@vayntforge/ui'
import { diagnoseFailure } from '@vayntforge/engine'
import { useRequestDraft } from '../../stores/requestDrafts'
import { useResponseEntry } from '../../stores/responses'
import { useSession } from '../../stores/session'
import { useActiveWorkspaceData } from '../../stores/data'
import { runAndRecordRequest } from '../../lib/runAndRecord'
import { ResponseHeaders } from '../request-builder/response/ResponseHeaders'
import { ResponseCookies } from '../request-builder/response/ResponseCookies'
import { ResponseTimeline } from '../request-builder/response/ResponseTimeline'
import { ResponseBody } from '../request-builder/response/ResponseBody'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-b border-border">
      <div className="border-b border-border bg-raised px-3 py-1.5 text-[11px] font-semibold uppercase text-faint">
        {title}
      </div>
      {children}
    </div>
  )
}

export function DebuggerPanel({ tabId }: { tabId: string }) {
  const tabs = useSession((s) => s.tabs)
  const setActiveTab = useSession((s) => s.setActiveTab)
  const activeWorkspaceId = useSession((s) => s.activeWorkspaceId)
  const activeEnvironmentId = useSession((s) => s.activeEnvironmentId)
  const { environments, globalVariables } = useActiveWorkspaceData()
  const [retrying, setRetrying] = useState(false)
  const tab = tabs.find((t) => t.id === tabId)
  const sourceTabId = tab?.sourceTabId
  const sourceTab = tabs.find((t) => t.id === sourceTabId)
  const draft = useRequestDraft(sourceTabId ?? null)
  const entry = useResponseEntry(sourceTabId ?? null)

  const handleRetry = async () => {
    if (!sourceTabId || !draft) return
    setRetrying(true)
    try {
      await runAndRecordRequest({
        request: draft,
        tabId: sourceTabId,
        workspaceId: activeWorkspaceId,
        environmentId: activeEnvironmentId,
        globalVariables,
        environment: environments.find((e) => e.id === activeEnvironmentId),
      })
    } catch (err) {
      toast.error('Retry failed', err instanceof Error ? err.message : String(err))
    } finally {
      setRetrying(false)
    }
  }

  if (!sourceTabId || !draft) {
    return (
      <EmptyState
        icon={Bug}
        title="No request to debug"
        description="Open the Debugger from a request's response panel (via “Open in Debugger” on a failure) to inspect it in full detail here."
      />
    )
  }

  if (!entry?.response) {
    return (
      <EmptyState
        icon={Bug}
        title="No response yet"
        description={`Send "${sourceTab?.name ?? draft.name}" to populate the debugger.`}
        action={
          sourceTabId ? (
            <Button onClick={() => setActiveTab(sourceTabId)}>
              <ExternalLink className="h-3.5 w-3.5" /> Open request
            </Button>
          ) : undefined
        }
      />
    )
  }

  const response = entry.response
  const diagnosis = diagnoseFailure(response, draft.url)
  const isFailure = Boolean(response.error) || response.status >= 400

  const copyAll = () => {
    const summary = [
      `${draft.method} ${draft.url}`,
      `Status: ${response.status} ${response.statusText}`,
      `Duration: ${response.timeMs}ms · Size: ${response.size}B`,
      diagnosis.causes.length > 0 ? `Possible causes:\n${diagnosis.causes.map((c) => `- ${c}`).join('\n')}` : '',
      diagnosis.warnings.length > 0 ? `Warnings:\n${diagnosis.warnings.map((w) => `- ${w}`).join('\n')}` : '',
      `Body:\n${response.bodyText}`,
    ]
      .filter(Boolean)
      .join('\n\n')
    void navigator.clipboard.writeText(summary)
    toast.success('Debug report copied')
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <MethodBadge method={draft.method} />
        <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-text">{draft.url}</span>
        <StatusCode code={response.status} />
        <span className="font-mono text-[11px] text-muted">{response.timeMs}ms</span>
        <div className="ml-auto flex items-center gap-1.5">
          <Button size="sm" onClick={handleRetry} disabled={retrying}>
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setActiveTab(sourceTabId)}>
            <ExternalLink className="h-3.5 w-3.5" /> Open request
          </Button>
          <Button size="sm" variant="ghost" onClick={copyAll}>
            <Copy className="h-3.5 w-3.5" /> Copy report
          </Button>
        </div>
      </div>

      {isFailure && (
        <div className="border-b border-border bg-err/5 px-3 py-3">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-err">
            <AlertTriangle className="h-4 w-4" /> {diagnosis.title}
          </div>
          {diagnosis.causes.length > 0 && (
            <ul className="mt-2 space-y-1 text-[12px] text-muted">
              {diagnosis.causes.map((c) => (
                <li key={c} className="flex gap-1.5">
                  <span className="text-faint">•</span> {c}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {diagnosis.warnings.length > 0 && (
        <div className="border-b border-border bg-warn/5 px-3 py-3">
          <div className="flex items-center gap-2 text-[12px] font-semibold text-warn">
            <TriangleAlert className="h-3.5 w-3.5" /> Warnings
          </div>
          <ul className="mt-2 space-y-1 text-[12px] text-muted">
            {diagnosis.warnings.map((w) => (
              <li key={w} className="flex gap-1.5">
                <span className="text-faint">•</span> {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Section title="Request headers">
        <ResponseHeaders headers={Object.fromEntries(draft.headers.filter((h) => h.enabled).map((h) => [h.key, h.value]))} />
      </Section>

      <Section title="Response">
        <div className="max-h-72 overflow-auto">
          <ResponseBody response={response} />
        </div>
      </Section>

      <Section title="Response headers">
        <ResponseHeaders headers={response.headers} />
      </Section>

      <Section title="Cookies">
        <ResponseCookies cookies={response.cookies} />
      </Section>

      <Section title="Redirects">
        {response.redirects.length === 0 ? (
          <p className="p-4 text-center text-[12px] text-faint">No redirects were followed.</p>
        ) : (
          <div className="p-2">
            {response.redirects.map((r, i) => (
              <div key={i} className="flex items-center gap-2 border-b border-border px-2 py-1.5 font-mono text-[12px] last:border-b-0">
                <span className="text-warn">{r.status}</span>
                <span className="min-w-0 flex-1 truncate text-muted">{r.url}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Timeline & connection">
        <ResponseTimeline timing={response.timing} />
      </Section>
    </div>
  )
}
