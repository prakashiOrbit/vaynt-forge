import { useState } from 'react'
import { generateId } from '@vayntforge/engine'
import type { MockEndpoint } from '@vayntforge/engine'
import { Button, CodeEditor, KeyValueEditor, MethodSelect } from '@vayntforge/ui'
import type { KeyValueRow } from '@vayntforge/ui'

const STATUS_PRESETS = [200, 201, 400, 401, 404, 500] as const
const LATENCY_PRESETS = [0, 100, 500, 1000] as const

interface ResponseTemplate {
  label: string
  status: number
  body: string
}

/** Sprint 10 — canned response templates so a common shape is one click away
 * instead of hand-typing JSON every time. */
const RESPONSE_TEMPLATES: ResponseTemplate[] = [
  { label: 'Success object', status: 200, body: '{\n  "id": "obj_1",\n  "name": "Example"\n}' },
  { label: 'List of items', status: 200, body: '[\n  { "id": "obj_1", "name": "Example" }\n]' },
  { label: 'Created', status: 201, body: '{\n  "id": "obj_1",\n  "created": true\n}' },
  { label: 'No content', status: 204, body: '' },
  { label: 'Validation error', status: 400, body: '{\n  "error": "Validation failed",\n  "fields": { "name": "is required" }\n}' },
  { label: 'Unauthorized', status: 401, body: '{\n  "error": "Missing or invalid credentials"\n}' },
  { label: 'Not found', status: 404, body: '{\n  "error": "Resource not found"\n}' },
  { label: 'Server error', status: 500, body: '{\n  "error": "Internal server error"\n}' },
]

const headersToRows = (headers: Record<string, string>): KeyValueRow[] =>
  Object.entries(headers).map(([key, value]) => ({ id: crypto.randomUUID(), key, value, enabled: true }))

const rowsToHeaders = (rows: KeyValueRow[]): Record<string, string> =>
  Object.fromEntries(rows.filter((r) => r.enabled && r.key.trim()).map((r) => [r.key, r.value]))

export interface MockResponseDesignerProps {
  endpoint?: MockEndpoint
  onSave(endpoint: MockEndpoint): void
  onCancel(): void
}

/** Sprint 10 — the per-endpoint response editor: method/path, status, headers,
 * a JSON body editor, simulated latency, and an error-rate simulation toggle. */
export function MockResponseDesigner({ endpoint, onSave, onCancel }: MockResponseDesignerProps) {
  const [method, setMethod] = useState(endpoint?.method ?? 'GET')
  const [path, setPath] = useState(endpoint?.path ?? '/')
  const initialStatus = endpoint?.status ?? 200
  const initialDelay = endpoint?.delayMs ?? 100
  const [status, setStatus] = useState(initialStatus)
  const [customStatus, setCustomStatus] = useState(!STATUS_PRESETS.some((s) => s === initialStatus))
  const [headers, setHeaders] = useState<KeyValueRow[]>(headersToRows(endpoint?.headers ?? { 'content-type': 'application/json' }))
  const [body, setBody] = useState(endpoint?.body ?? '{\n  \n}')
  const [delayMs, setDelayMs] = useState(initialDelay)
  const [customLatency, setCustomLatency] = useState(!LATENCY_PRESETS.some((ms) => ms === initialDelay))
  const [simulateErrors, setSimulateErrors] = useState((endpoint?.errorRate ?? 0) > 0)
  const [errorPct, setErrorPct] = useState(Math.round((endpoint?.errorRate ?? 0.05) * 100))

  const applyTemplate = (template: ResponseTemplate) => {
    setStatus(template.status)
    setCustomStatus(!STATUS_PRESETS.some((s) => s === template.status))
    setBody(template.body)
  }

  const handleSave = () => {
    onSave({
      id: endpoint?.id ?? generateId('ep'),
      method,
      path: path.startsWith('/') ? path : `/${path}`,
      status,
      headers: rowsToHeaders(headers),
      body,
      delayMs,
      errorRate: simulateErrors ? errorPct / 100 : 0,
    })
  }

  return (
    <div className="flex max-h-[75vh] flex-col gap-4 overflow-y-auto p-4">
      <div className="flex gap-2">
        <MethodSelect value={method} onChange={setMethod} />
        <input
          value={path}
          onChange={(e) => setPath(e.target.value)}
          placeholder="/users/:id"
          className="h-8 flex-1 rounded border border-border bg-bg-input px-2 font-mono text-[12px] text-text"
        />
      </div>

      <div>
        <div className="mb-1.5 text-[11px] font-semibold uppercase text-faint">Status</div>
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_PRESETS.map((s) => (
            <button
              key={s}
              onClick={() => {
                setStatus(s)
                setCustomStatus(false)
              }}
              className={`rounded px-2 py-1 font-mono text-[12px] ${
                !customStatus && status === s
                  ? 'bg-accent/20 text-accent'
                  : 'text-muted hover:bg-bg-hover hover:text-text'
              }`}
            >
              {s}
            </button>
          ))}
          <button
            onClick={() => setCustomStatus(true)}
            className={`rounded px-2 py-1 text-[12px] ${customStatus ? 'bg-accent/20 text-accent' : 'text-muted hover:bg-bg-hover hover:text-text'}`}
          >
            Custom
          </button>
          {customStatus && (
            <input
              type="number"
              value={status}
              onChange={(e) => setStatus(Number(e.target.value) || 0)}
              className="h-7 w-20 rounded border border-border bg-bg-input px-2 font-mono text-[12px] text-text"
            />
          )}
        </div>
      </div>

      <div>
        <div className="mb-1.5 text-[11px] font-semibold uppercase text-faint">Headers</div>
        <KeyValueEditor rows={headers} onChange={setHeaders} keyPlaceholder="Header" valuePlaceholder="Value" />
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase text-faint">Body</span>
          <div className="flex flex-wrap justify-end gap-1">
            {RESPONSE_TEMPLATES.map((t) => (
              <button
                key={t.label}
                onClick={() => applyTemplate(t)}
                className="rounded px-1.5 py-0.5 text-[10px] text-faint hover:bg-bg-hover hover:text-text"
                title={`Fill with a ${t.status} ${t.label.toLowerCase()} example`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <CodeEditor value={body} onChange={setBody} language="json" minHeight="120px" maxHeight="240px" />
      </div>

      <div>
        <div className="mb-1.5 text-[11px] font-semibold uppercase text-faint">Simulated latency</div>
        <div className="flex flex-wrap items-center gap-1.5">
          {LATENCY_PRESETS.map((ms) => (
            <button
              key={ms}
              onClick={() => {
                setDelayMs(ms)
                setCustomLatency(false)
              }}
              className={`rounded px-2 py-1 font-mono text-[12px] ${
                !customLatency && delayMs === ms
                  ? 'bg-accent/20 text-accent'
                  : 'text-muted hover:bg-bg-hover hover:text-text'
              }`}
            >
              {ms}ms
            </button>
          ))}
          <button
            onClick={() => setCustomLatency(true)}
            className={`rounded px-2 py-1 text-[12px] ${customLatency ? 'bg-accent/20 text-accent' : 'text-muted hover:bg-bg-hover hover:text-text'}`}
          >
            Custom
          </button>
          {customLatency && (
            <input
              type="number"
              value={delayMs}
              onChange={(e) => setDelayMs(Math.max(0, Number(e.target.value) || 0))}
              className="h-7 w-20 rounded border border-border bg-bg-input px-2 font-mono text-[12px] text-text"
            />
          )}
        </div>
      </div>

      <div>
        <label className="flex items-center gap-2 text-[12px] text-text">
          <input type="checkbox" checked={simulateErrors} onChange={(e) => setSimulateErrors(e.target.checked)} />
          Simulate errors (occasionally return 500 instead of the response above)
        </label>
        {simulateErrors && (
          <div className="mt-1.5 flex items-center gap-2 pl-6">
            <input
              type="number"
              min={0}
              max={100}
              value={errorPct}
              onChange={(e) => setErrorPct(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
              className="h-7 w-16 rounded border border-border bg-bg-input px-2 font-mono text-[12px] text-text"
            />
            <span className="text-[11px] text-faint">% of requests fail</span>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 border-t border-border pt-3">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={!path.trim()}>
          Save endpoint
        </Button>
      </div>
    </div>
  )
}
