import { useState } from 'react'
import { Radio } from 'lucide-react'
import { EmptyState, LoadingState, StatusCode, Tabs, type TabItem } from '@vayntforge/ui'
import type { RequestModel } from '@vayntforge/engine'
import type { ResponseEntry } from '../../stores/responses'
import { ResponseBody } from './response/ResponseBody'
import { ResponseHeaders } from './response/ResponseHeaders'
import { ResponseCookies } from './response/ResponseCookies'
import { ResponseTimeline } from './response/ResponseTimeline'
import { ResponseTestResults } from './response/ResponseTestResults'
import { ResponseError } from './response/ResponseError'

type ResponseTab = 'body' | 'headers' | 'cookies' | 'timeline' | 'tests'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}

export function ResponsePanel({
  draft,
  entry,
  onSend,
}: {
  draft: RequestModel
  entry: ResponseEntry | undefined
  onSend(): void
}) {
  const [subTab, setSubTab] = useState<ResponseTab>('body')

  if (entry?.sending) return <LoadingState rows={5} />

  if (!entry?.response) {
    return (
      <EmptyState
        icon={Radio}
        title="No response yet"
        description="Send this request to see the response here."
      />
    )
  }

  const response = entry.response
  const isFailure = Boolean(response.error) || response.status >= 500

  if (isFailure) {
    return (
      <ResponseError
        response={response}
        url={draft.url}
        onRetry={onSend}
        onOpenRequest={() => document.getElementById('request-header')?.scrollIntoView({ block: 'start' })}
      />
    )
  }

  const tabs: TabItem<ResponseTab>[] = [
    { id: 'body', label: 'Body' },
    { id: 'headers', label: 'Headers', badge: Object.keys(response.headers).length },
    { id: 'cookies', label: 'Cookies', badge: response.cookies.length },
    { id: 'timeline', label: 'Timeline' },
    { id: 'tests', label: 'Test Results', badge: draft.assertions.filter((a) => a.enabled).length },
  ]

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-3 py-2 text-[12px]">
        <StatusCode code={response.status} />
        <span className="text-text">{response.statusText}</span>
        <span className="text-faint">·</span>
        <span className="font-mono text-muted">{response.timeMs} ms</span>
        <span className="text-faint">·</span>
        <span className="font-mono text-muted">{formatSize(response.size)}</span>
        {response.redirects.length > 0 && (
          <>
            <span className="text-faint">·</span>
            <span className="text-warn">{response.redirects.length} redirect{response.redirects.length > 1 ? 's' : ''}</span>
          </>
        )}
        {response.handledByMock && <span className="ml-auto text-[10px] text-faint">Simulated response</span>}
      </div>
      <Tabs tabs={tabs} active={subTab} onChange={(id) => setSubTab(id)} />
      <div className="min-h-0 flex-1 overflow-auto">
        {subTab === 'body' && <ResponseBody response={response} />}
        {subTab === 'headers' && <ResponseHeaders headers={response.headers} />}
        {subTab === 'cookies' && <ResponseCookies cookies={response.cookies} />}
        {subTab === 'timeline' && <ResponseTimeline timing={response.timing} />}
        {subTab === 'tests' && (
          <ResponseTestResults
            assertions={draft.assertions}
            response={response}
            preScript={entry.preScript}
            postScript={entry.postScript}
          />
        )}
      </div>
    </div>
  )
}
