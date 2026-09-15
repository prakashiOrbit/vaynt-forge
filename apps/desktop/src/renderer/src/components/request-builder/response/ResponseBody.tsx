import { useState } from 'react'
import { CodeEditor, JsonTreeView } from '@vayntforge/ui'
import type { ResponseModel } from '@vayntforge/engine'

type ViewMode = 'pretty' | 'raw' | 'preview'

function detectLanguage(contentType: string | undefined): 'json' | 'xml' | 'html' | 'text' {
  const ct = (contentType ?? '').toLowerCase()
  if (ct.includes('json')) return 'json'
  if (ct.includes('xml')) return 'xml'
  if (ct.includes('html')) return 'html'
  return 'text'
}

export function ResponseBody({ response }: { response: ResponseModel }) {
  const language = detectLanguage(response.headers['content-type'] ?? response.headers['Content-Type'])
  const isJson = language === 'json' && response.body !== undefined
  const isHtml = language === 'html'
  const [mode, setMode] = useState<ViewMode>(isJson ? 'pretty' : 'raw')

  const modes: ViewMode[] = isJson ? ['pretty', 'raw'] : isHtml ? ['raw', 'preview'] : ['raw']

  return (
    <div className="flex h-full flex-col">
      {modes.length > 1 && (
        <div className="flex shrink-0 gap-1 border-b border-border px-2 py-1.5">
          {modes.map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded px-2 py-1 text-[11px] capitalize transition-colors ${
                mode === m ? 'bg-bg-active text-text' : 'text-muted hover:text-text'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto">
        {mode === 'pretty' && isJson && <JsonTreeView data={response.body} />}
        {mode === 'preview' && isHtml && (
          <iframe title="Response preview" sandbox="" srcDoc={response.bodyText} className="h-full w-full bg-white" />
        )}
        {(mode === 'raw' || (mode === 'pretty' && !isJson)) && (
          <div className="p-2">
            <CodeEditor value={response.bodyText} onChange={() => {}} language={language} readOnly minHeight="100%" />
          </div>
        )}
      </div>
    </div>
  )
}
