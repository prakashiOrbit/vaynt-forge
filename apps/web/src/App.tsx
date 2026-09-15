import { StatusBadge, MethodBadge, Button } from '@vayntforge/ui'
import { InMemoryStorage } from '@vayntforge/engine'

export function App() {
  const storage = new InMemoryStorage()
  const ws = storage.listWorkspaces()[0]
  const history = ws ? storage.listHistory(ws.id) : []

  return (
    <div className="flex min-h-full items-center justify-center bg-bg p-8">
      <div className="w-full max-w-lg rounded-lg border border-border bg-raised p-6">
        <h1 className="text-sm font-semibold text-text">Vaynt Forge</h1>
        <p className="mt-1 text-[12px] text-faint">
          Browser fallback build — shares the same engine and UI as the desktop app.
        </p>

        <div className="mt-4 flex items-center gap-2">
          <MethodBadge method="GET" />
          <StatusBadge tone="ok">200 OK · 124ms</StatusBadge>
          <StatusBadge tone="err">500 · DATABASE_TIMEOUT</StatusBadge>
        </div>

        <div className="mt-4 space-y-2">
          {history.slice(0, 4).map((h) => (
            <div key={h.id} className="flex items-center gap-2 font-mono text-[11px] text-muted">
              <span>{h.method}</span>
              <span className="truncate text-faint">{h.url}</span>
              <span className="ml-auto">{h.status}</span>
            </div>
          ))}
          <Button size="sm">Open Desktop App →</Button>
        </div>
      </div>
    </div>
  )
}