import { CheckCircle2, XCircle } from 'lucide-react'
import { EmptyState } from '@vayntforge/ui'
import { evaluateAssertions } from '@vayntforge/engine'
import type { Assertion, ResponseModel, ScriptResult } from '@vayntforge/engine'

export function ResponseTestResults({
  assertions,
  response,
  preScript,
  postScript,
}: {
  assertions: Assertion[]
  response: ResponseModel
  preScript?: ScriptResult
  postScript?: ScriptResult
}) {
  const enabled = assertions.filter((a) => a.enabled)
  const results = evaluateAssertions(assertions, response)
  const scriptLogs = [...(preScript?.logs ?? []), ...(postScript?.logs ?? [])]
  const scriptErrors = [preScript?.error, postScript?.error].filter(Boolean) as string[]

  return (
    <div className="space-y-4 p-3">
      {enabled.length === 0 ? (
        <EmptyState
          title="No assertions on this request"
          description="Add assertions on the Tests tab to check the response automatically."
        />
      ) : (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[11px] font-semibold tracking-wide text-faint uppercase">Assertions</h3>
            <span className="text-[11px] text-faint">
              {results.filter((r) => r.passed).length}/{results.length} passed
            </span>
          </div>
          <div className="space-y-1">
            {results.map((r) => (
              <div key={r.assertion.id} className="flex items-start gap-2 rounded-md border border-border px-2.5 py-1.5">
                {r.passed ? (
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ok" />
                ) : (
                  <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-err" />
                )}
                <span className="text-[12px] text-text">{r.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(scriptLogs.length > 0 || scriptErrors.length > 0) && (
        <div>
          <h3 className="mb-2 text-[11px] font-semibold tracking-wide text-faint uppercase">Script output</h3>
          <div className="space-y-1 rounded-md border border-border bg-bg-input p-2 font-mono text-[11px]">
            {scriptLogs.map((line, i) => (
              <div key={i} className="text-muted">
                {line}
              </div>
            ))}
            {scriptErrors.map((err, i) => (
              <div key={i} className="text-err">
                {err}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
