import { FolderOpen } from 'lucide-react'
import { Button, CodeEditor, KeyValueEditor } from '@vayntforge/ui'
import type { BodyType, RawLanguage, RequestBody } from '@vayntforge/engine'
import { SelectField } from './fields'
import type { RequestPanelProps } from './types'

const BODY_OPTIONS: { value: BodyType; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'form-data', label: 'Form Data' },
  { value: 'x-www-form-urlencoded', label: 'x-www-form-urlencoded' },
  { value: 'raw', label: 'Raw' },
  { value: 'binary', label: 'Binary' },
  { value: 'graphql', label: 'GraphQL' },
]

const RAW_LANGUAGES: { value: RawLanguage; label: string }[] = [
  { value: 'json', label: 'JSON' },
  { value: 'xml', label: 'XML' },
  { value: 'text', label: 'Text' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'html', label: 'HTML' },
]

function defaultBodyFor(type: BodyType): RequestBody {
  switch (type) {
    case 'none':
      return { type: 'none' }
    case 'form-data':
      return { type: 'form-data', pairs: [] }
    case 'x-www-form-urlencoded':
      return { type: 'x-www-form-urlencoded', pairs: [] }
    case 'raw':
      return { type: 'raw', language: 'json', content: '' }
    case 'binary':
      return { type: 'binary', source: '' }
    case 'graphql':
      return { type: 'graphql', query: '', variables: '{}' }
  }
}

export function BodyPanel({ draft, update, suggestions }: RequestPanelProps) {
  const body = draft.body
  const setBody = (next: RequestBody) => update((d) => ({ ...d, body: next }))

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-border p-3">
        <div className="flex flex-wrap gap-1.5">
          {BODY_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => setBody(defaultBodyFor(o.value))}
              className={`rounded-md border px-2.5 py-1 text-[12px] transition-colors ${
                body.type === o.value
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border text-muted hover:border-border-strong hover:text-text'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        {body.type === 'raw' && (
          <div className="ml-auto w-36">
            <SelectField
              label=""
              value={body.language}
              onChange={(language) => setBody({ ...body, language })}
              options={RAW_LANGUAGES}
            />
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-3">
        {body.type === 'none' && (
          <p className="py-6 text-center text-[12px] text-faint">This request does not have a body.</p>
        )}

        {(body.type === 'form-data' || body.type === 'x-www-form-urlencoded') && (
          <KeyValueEditor
            rows={body.pairs}
            onChange={(pairs) => setBody({ ...body, pairs })}
            valueSuggestions={suggestions}
            newRowLabel="Add field"
          />
        )}

        {body.type === 'raw' && (
          <CodeEditor
            value={body.content}
            onChange={(content) => setBody({ ...body, content })}
            language={body.language}
            minHeight="200px"
            placeholder="Request body"
          />
        )}

        {body.type === 'binary' && (
          <div className="flex items-center gap-2">
            <input
              value={body.source}
              readOnly
              placeholder="No file selected"
              className="h-8 flex-1 rounded-md border border-border bg-bg-input px-2.5 text-[12px] text-text outline-none placeholder:text-faint"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                const path = await window.vayntforge.dialog.openFile()
                if (path) setBody({ ...body, source: path })
              }}
            >
              <FolderOpen className="h-3.5 w-3.5" /> Browse…
            </Button>
          </div>
        )}

        {body.type === 'graphql' && (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-faint">Query</label>
              <CodeEditor
                value={body.query}
                onChange={(query) => setBody({ ...body, query })}
                language="graphql"
                minHeight="160px"
                placeholder="query { ... }"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-faint">Variables</label>
              <CodeEditor
                value={body.variables}
                onChange={(variables) => setBody({ ...body, variables })}
                language="json"
                minHeight="100px"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
