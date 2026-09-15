import { Plus, Trash2 } from 'lucide-react'
import type { Assertion, AssertionType } from '@vayntforge/engine'
import type { RequestPanelProps } from './types'

const ASSERTION_OPTIONS: { value: AssertionType; label: string }[] = [
  { value: 'statusCodeEquals', label: 'Status code equals' },
  { value: 'responseTimeLessThan', label: 'Response time less than' },
  { value: 'jsonPathExists', label: 'JSON path exists' },
  { value: 'jsonPathEquals', label: 'JSON path equals' },
  { value: 'headerExists', label: 'Header exists' },
  { value: 'schemaMatches', label: 'Schema matches' },
]

const TARGET_PLACEHOLDER: Record<AssertionType, string> = {
  statusCodeEquals: 'status',
  responseTimeLessThan: 'responseTime (ms)',
  jsonPathExists: '$.data.id',
  jsonPathEquals: '$.data.status',
  headerExists: 'Content-Type',
  schemaMatches: 'schema name / $ref',
}

const HAS_EXPECTED: Record<AssertionType, boolean> = {
  statusCodeEquals: true,
  responseTimeLessThan: true,
  jsonPathExists: false,
  jsonPathEquals: true,
  headerExists: false,
  schemaMatches: true,
}

function newAssertion(): Assertion {
  return { id: crypto.randomUUID(), type: 'statusCodeEquals', target: 'status', expected: '200', enabled: true }
}

const cellClass =
  'h-7 min-w-0 flex-1 rounded border border-transparent bg-transparent px-2 text-[12px] text-text outline-none placeholder:text-faint focus:border-accent focus:bg-bg-input'

export function TestsPanel({ draft, update }: RequestPanelProps) {
  const assertions = draft.assertions
  const setAssertions = (next: Assertion[]) => update((d) => ({ ...d, assertions: next }))
  const patch = (id: string, p: Partial<Assertion>) =>
    setAssertions(assertions.map((a) => (a.id === id ? { ...a, ...p } : a)))

  return (
    <div className="p-3">
      {assertions.length === 0 ? (
        <p className="py-6 text-center text-[12px] text-faint">
          No assertions yet — add one to check the response automatically.
        </p>
      ) : (
        <div className="mb-2 space-y-1.5">
          {assertions.map((a) => (
            <div key={a.id} className="flex items-center gap-1 rounded-md border border-border px-1.5 py-1.5">
              <input
                type="checkbox"
                checked={a.enabled}
                onChange={(e) => patch(a.id, { enabled: e.target.checked })}
                aria-label="Toggle assertion"
                className="h-3.5 w-3.5 shrink-0 accent-[var(--af-accent)]"
              />
              <select
                value={a.type}
                onChange={(e) => {
                  const type = e.target.value as AssertionType
                  patch(a.id, { type, target: TARGET_PLACEHOLDER[type].startsWith('$') ? '' : a.target })
                }}
                className="h-7 shrink-0 rounded border border-transparent bg-transparent px-1 text-[12px] text-text outline-none focus:border-accent focus:bg-bg-input"
              >
                {ASSERTION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <input
                value={a.target}
                onChange={(e) => patch(a.id, { target: e.target.value })}
                placeholder={TARGET_PLACEHOLDER[a.type]}
                className={`${cellClass} font-mono`}
              />
              {HAS_EXPECTED[a.type] && (
                <input
                  value={a.expected}
                  onChange={(e) => patch(a.id, { expected: e.target.value })}
                  placeholder="Expected"
                  className={`${cellClass} max-w-[30%] font-mono`}
                />
              )}
              <button
                onClick={() => setAssertions(assertions.filter((x) => x.id !== a.id))}
                aria-label="Remove assertion"
                className="shrink-0 rounded p-1 text-faint hover:bg-bg-hover hover:text-err"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        onClick={() => setAssertions([...assertions, newAssertion()])}
        className="flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-accent hover:underline"
      >
        <Plus className="h-3.5 w-3.5" /> Add Assertion
      </button>
    </div>
  )
}
