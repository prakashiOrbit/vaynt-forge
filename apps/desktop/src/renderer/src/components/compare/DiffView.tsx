import type { FieldDiff } from '@vayntforge/engine'
import { Check } from 'lucide-react'

const LINE_STYLE: Record<'same' | 'added' | 'removed', string> = {
  same: 'text-muted',
  added: 'bg-ok/10 text-ok',
  removed: 'bg-err/10 text-err',
}

const LINE_PREFIX: Record<'same' | 'added' | 'removed', string> = {
  same: ' ',
  added: '+',
  removed: '-',
}

export function DiffView({ diff }: { diff: FieldDiff }) {
  if (diff.identical) {
    return (
      <div className="flex items-center gap-1.5 rounded border border-border bg-bg px-2 py-1.5 text-[11px] text-faint">
        <Check className="h-3 w-3 text-ok" /> Identical
      </div>
    )
  }
  const visible = diff.lines.filter((l) => l.text !== '')
  if (visible.length === 0) {
    return <div className="rounded border border-border bg-bg px-2 py-1.5 text-[11px] text-faint">Both empty</div>
  }
  return (
    <div className="overflow-auto rounded border border-border bg-bg font-mono text-[11px]">
      {diff.lines.map((line, i) => (
        <div key={i} className={`flex gap-2 px-2 py-0.5 whitespace-pre-wrap ${LINE_STYLE[line.type]}`}>
          <span className="w-3 shrink-0 select-none opacity-60">{LINE_PREFIX[line.type]}</span>
          <span className="min-w-0 break-all">{line.text || ' '}</span>
        </div>
      ))}
    </div>
  )
}
