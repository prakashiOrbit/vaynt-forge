import { Keyboard } from 'lucide-react'

interface ShortcutEntry {
  keys: string[]
  description: string
}

interface ShortcutGroup {
  title: string
  shortcuts: ShortcutEntry[]
}

const GROUPS: ShortcutGroup[] = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['⌘', 'K'], description: 'Open the command palette' },
      { keys: ['⌘', 'P'], description: 'Quick open a request, collection, or environment' },
      { keys: ['Esc'], description: 'Close the command palette' },
      { keys: ['⌘', 'W'], description: 'Close the active workspace tab' },
    ],
  },
  {
    title: 'Requests',
    shortcuts: [
      { keys: ['⌘', 'Enter'], description: 'Send the active request' },
      { keys: ['⌘', 'S'], description: 'Save the active request' },
    ],
  },
  {
    title: 'Collections & environments',
    shortcuts: [
      { keys: ['⌘', '⇧', 'R'], description: 'Run a collection (the first one in the list, or the selected one)' },
      { keys: ['⌘', '⇧', 'E'], description: 'Switch to the next environment' },
    ],
  },
]

function KeyCap({ label }: { label: string }) {
  return (
    <kbd className="flex h-6 min-w-[1.5rem] items-center justify-center rounded border border-border bg-raised px-1.5 font-mono text-[11px] text-text">
      {label}
    </kbd>
  )
}

export function ShortcutsPage() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <Keyboard className="h-4 w-4 text-faint" />
        <div>
          <div className="text-[13px] font-semibold text-text">Keyboard Shortcuts</div>
          <div className="text-[11px] text-faint">Every shortcut below is live — try it right now</div>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-xl space-y-6">
          {GROUPS.map((group) => (
            <div key={group.title}>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-faint">{group.title}</div>
              <div className="overflow-hidden rounded-md border border-border">
                {group.shortcuts.map((s, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-4 border-b border-border px-3 py-2.5 last:border-b-0"
                  >
                    <span className="text-[12px] text-muted">{s.description}</span>
                    <div className="flex shrink-0 items-center gap-1">
                      {s.keys.map((k, j) => (
                        <KeyCap key={j} label={k} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
