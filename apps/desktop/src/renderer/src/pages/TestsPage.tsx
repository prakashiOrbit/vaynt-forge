import { useMemo, useState } from 'react'
import { CheckCircle2, Circle, FlaskConical, MinusCircle, Play, Trash2 } from 'lucide-react'
import { Button, ConfirmDialog, EmptyState } from '@vayntforge/ui'
import type { RunStatus, TestRun } from '@vayntforge/engine'
import { useSession } from '../stores/session'
import { useActiveWorkspaceData, useData } from '../stores/data'

const STATUS_ICON: Record<RunStatus, { icon: typeof CheckCircle2; className: string }> = {
  pass: { icon: CheckCircle2, className: 'text-ok' },
  fail: { icon: MinusCircle, className: 'text-err' },
  skip: { icon: Circle, className: 'text-faint' },
}

function formatWhen(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function TestsPage() {
  const { testRuns, collections } = useActiveWorkspaceData()
  const setActiveNav = useSession((s) => s.setActiveNav)
  const deleteTestRun = useData((s) => s.deleteTestRun)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const sorted = useMemo(() => [...testRuns].sort((a, b) => b.startedAt - a.startedAt), [testRuns])
  const selected = sorted.find((r) => r.id === selectedId) ?? sorted[0] ?? null

  const collectionName = (run: TestRun): string =>
    collections.find((c) => c.id === run.collectionId)?.name ?? run.name

  if (sorted.length === 0) {
    return (
      <EmptyState
        icon={FlaskConical}
        title="No test runs yet"
        description="Run a collection to see pass/fail results here — assertions, durations, and failure details for every request."
        action={
          <Button size="sm" onClick={() => setActiveNav('collections')}>
            <Play className="h-3.5 w-3.5" /> Open Collections
          </Button>
        }
      />
    )
  }

  return (
    <div className="grid h-full grid-cols-[320px_1fr]">
      <div className="overflow-y-auto border-r border-border">
        {sorted.map((run) => {
          const active = run.id === selected?.id
          return (
            <button
              key={run.id}
              onClick={() => setSelectedId(run.id)}
              className={`flex w-full flex-col gap-1 border-b border-border px-3 py-2.5 text-left ${
                active ? 'bg-bg-active' : 'hover:bg-bg-hover'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[12px] font-medium text-text">{collectionName(run)}</span>
                <span className="shrink-0 text-[11px] text-faint">{formatWhen(run.startedAt)}</span>
              </div>
              <div className="text-[11px] font-medium">
                <span className="text-ok">{run.passed} passed</span> ·{' '}
                <span className="text-err">{run.failed} failed</span>
                {run.skipped > 0 && <span className="text-faint"> · {run.skipped} skipped</span>}
              </div>
            </button>
          )
        })}
      </div>

      <div className="min-h-0 overflow-y-auto p-4">
        {selected && (
          <>
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h1 className="text-[14px] font-semibold text-text">{collectionName(selected)}</h1>
                <p className="mt-0.5 text-[12px] text-faint">
                  {formatWhen(selected.startedAt)}
                  {selected.finishedAt && ` · ${((selected.finishedAt - selected.startedAt) / 1000).toFixed(1)}s`}
                  {selected.iterations > 1 && ` · ${selected.iterations} iterations`}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setConfirmDeleteId(selected.id)} aria-label="Delete test run">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="space-y-1">
              {selected.results.map((r, i) => {
                const meta = STATUS_ICON[r.status]
                const Icon = meta.icon
                return (
                  <div
                    key={`${r.requestId}_${i}`}
                    className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5"
                  >
                    <Icon className={`h-3.5 w-3.5 shrink-0 ${meta.className}`} />
                    <span className="min-w-0 flex-1 truncate text-[12px] text-text">{r.requestName}</span>
                    {r.error && <span className="truncate text-[11px] text-err">{r.error}</span>}
                    <span className="shrink-0 text-[11px] text-faint">
                      {r.assertionsPassed}/{r.assertionsPassed + r.assertionsFailed} assertions
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-faint">{r.durationMs}ms</span>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="Delete this test run?"
        description="This permanently removes the run and its results."
        confirmLabel="Delete"
        tone="danger"
        onConfirm={() => {
          if (confirmDeleteId) void deleteTestRun(confirmDeleteId)
          if (confirmDeleteId === selectedId) setSelectedId(null)
          setConfirmDeleteId(null)
        }}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  )
}
