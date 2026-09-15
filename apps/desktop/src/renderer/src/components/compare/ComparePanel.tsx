import { useState } from 'react'
import { GitCompare, Send } from 'lucide-react'
import { Button, EmptyState, toast } from '@vayntforge/ui'
import { compareRequests, compareResponses } from '@vayntforge/engine'
import { useSession } from '../../stores/session'
import { useActiveWorkspaceData } from '../../stores/data'
import { useResponseEntry } from '../../stores/responses'
import { runAndRecordRequest } from '../../lib/runAndRecord'
import { DiffView } from './DiffView'

function RequestPicker({
  label,
  value,
  onChange,
  requests,
}: {
  label: string
  value: string
  onChange(id: string): void
  requests: { id: string; name: string; method: string; url: string }[]
}) {
  return (
    <div className="flex-1">
      <div className="mb-1 text-[11px] font-semibold uppercase text-faint">{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-full rounded border border-border bg-bg-input px-2 text-[12px] text-text"
      >
        <option value="">Select a request…</option>
        {requests.map((r) => (
          <option key={r.id} value={r.id}>
            {r.method} {r.name}
          </option>
        ))}
      </select>
    </div>
  )
}

export function ComparePanel({ tabId: _tabId }: { tabId: string }) {
  const { requests, environments, globalVariables } = useActiveWorkspaceData()
  const activeWorkspaceId = useSession((s) => s.activeWorkspaceId)
  const activeEnvironmentId = useSession((s) => s.activeEnvironmentId)
  const [idA, setIdA] = useState('')
  const [idB, setIdB] = useState('')
  const [sending, setSending] = useState<'a' | 'b' | null>(null)

  const entryA = useResponseEntry(idA || null)
  const entryB = useResponseEntry(idB || null)
  const requestA = requests.find((r) => r.id === idA)
  const requestB = requests.find((r) => r.id === idB)

  if (requests.length < 2) {
    return (
      <EmptyState
        icon={GitCompare}
        title="Not enough saved requests to compare"
        description="Save at least two requests in this workspace, then come back here to diff them side by side."
      />
    )
  }

  const send = async (which: 'a' | 'b') => {
    const request = which === 'a' ? requestA : requestB
    if (!request) return
    setSending(which)
    try {
      await runAndRecordRequest({
        request,
        tabId: request.id,
        workspaceId: activeWorkspaceId,
        environmentId: activeEnvironmentId,
        globalVariables,
        environment: environments.find((e) => e.id === activeEnvironmentId),
      })
    } catch (err) {
      toast.error('Send failed', err instanceof Error ? err.message : String(err))
    } finally {
      setSending(null)
    }
  }

  const diff = requestA && requestB ? compareRequests(requestA, requestB) : undefined
  const responseDiff =
    requestA && requestB && entryA?.response && entryB?.response
      ? compareResponses(entryA.response, entryB.response)
      : undefined

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex items-center gap-3 border-b border-border px-3 py-2">
        <GitCompare className="h-3.5 w-3.5 text-faint" />
        <span className="text-[12px] font-medium text-text">Compare Requests</span>
      </div>
      <div className="flex gap-4 border-b border-border p-3">
        <RequestPicker label="Request A" value={idA} onChange={setIdA} requests={requests} />
        <RequestPicker label="Request B" value={idB} onChange={setIdB} requests={requests} />
      </div>

      {!diff ? (
        <div className="flex-1">
          <EmptyState
            icon={GitCompare}
            title="Pick two requests"
            description="Choose Request A and Request B above to see their differences."
          />
        </div>
      ) : (
        <div className="flex-1 space-y-4 p-3">
          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase text-faint">{diff.url.label}</div>
            <DiffView diff={diff.url} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="mb-1 text-[11px] font-semibold uppercase text-faint">{diff.method.label}</div>
              <DiffView diff={diff.method} />
            </div>
          </div>
          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase text-faint">{diff.headers.label}</div>
            <DiffView diff={diff.headers} />
          </div>
          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase text-faint">{diff.params.label}</div>
            <DiffView diff={diff.params} />
          </div>
          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase text-faint">{diff.body.label}</div>
            <DiffView diff={diff.body} />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase text-faint">Response</span>
              <div className="flex gap-1.5">
                <Button size="sm" variant="ghost" onClick={() => send('a')} disabled={sending === 'a'}>
                  <Send className="h-3 w-3" /> Send A
                </Button>
                <Button size="sm" variant="ghost" onClick={() => send('b')} disabled={sending === 'b'}>
                  <Send className="h-3 w-3" /> Send B
                </Button>
              </div>
            </div>
            {responseDiff ? (
              <DiffView diff={responseDiff} />
            ) : (
              <div className="rounded border border-border bg-bg px-2 py-3 text-center text-[11px] text-faint">
                Send both requests to compare their responses.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
