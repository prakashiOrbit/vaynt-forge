import { MethodBadge } from '@vayntforge/ui'
import type { ChainRule, RequestModel } from '@vayntforge/engine'

/**
 * A read-only node-and-arrow visualization of a collection's request order
 * and chain rules — hand-rolled SVG for the connectors (matching this
 * codebase's existing pattern of a hand-rolled LCS diff instead of a
 * Monaco/CodeMirror diff-editor dependency, and a hand-rolled Handlebars
 * subset instead of the real package): a linear row of boxes and arrows
 * doesn't need a graph-editing library. The Chain tab's list stays the
 * actual editor — this only visualizes what's already configured there and
 * jumps back to it on click, it never edits anything itself.
 */
function Connector({ label }: { label?: string }) {
  return (
    <div className="flex shrink-0 flex-col items-center justify-center px-1">
      <span className="mb-0.5 h-[14px] max-w-24 truncate rounded bg-accent/10 px-1 font-mono text-[10px] text-accent">
        {label}
      </span>
      <svg width="32" height="14" viewBox="0 0 32 14" className={label ? 'text-accent' : 'text-faint'}>
        <line x1="0" y1="7" x2="24" y2="7" stroke="currentColor" strokeWidth="1.5" />
        <polygon points="24,2 32,7 24,12" fill="currentColor" />
      </svg>
    </div>
  )
}

export function ChainDiagram({
  requests,
  chainRules,
  onSelectRequest,
}: {
  requests: RequestModel[]
  chainRules: ChainRule[]
  onSelectRequest(requestId: string): void
}) {
  if (requests.length === 0) {
    return <p className="py-8 text-center text-[12px] text-faint">No requests in this collection yet.</p>
  }

  const ruleFor = (id: string) => chainRules.find((r) => r.requestId === id)

  return (
    <div>
      <p className="mb-2 text-[11px] text-faint">
        The collection's request order, left to right. A labeled arrow is a real chain extraction — click any request
        to edit its rule on the Chain tab.
      </p>
      <div className="overflow-x-auto pb-2">
        <div className="flex items-center">
          {requests.map((r, i) => {
            const rule = ruleFor(r.id)
            const label = rule?.enabled && rule.jsonPath && rule.variableName ? `{{${rule.variableName}}}` : undefined
            return (
              <div key={r.id} className="flex items-center">
                <button
                  onClick={() => onSelectRequest(r.id)}
                  title={`Edit "${r.name}"'s chain rule`}
                  className="flex w-36 shrink-0 flex-col items-start gap-1 rounded-md border border-border bg-raised p-2 text-left transition-colors hover:border-border-strong hover:bg-bg-hover"
                >
                  <MethodBadge method={r.method} />
                  <span className="w-full truncate text-[12px] text-text">{r.name}</span>
                </button>
                {i < requests.length - 1 && <Connector label={label} />}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
