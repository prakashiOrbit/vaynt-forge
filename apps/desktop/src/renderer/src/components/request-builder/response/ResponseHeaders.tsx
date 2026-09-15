export function ResponseHeaders({ headers }: { headers: Record<string, string> }) {
  const entries = Object.entries(headers)
  if (entries.length === 0) {
    return <p className="p-4 text-center text-[12px] text-faint">No response headers.</p>
  }
  return (
    <div className="p-2">
      {entries.map(([key, value]) => (
        <div key={key} className="flex gap-3 border-b border-border px-2 py-1.5 last:border-b-0">
          <span className="w-1/3 shrink-0 truncate font-mono text-[12px] text-accent">{key}</span>
          <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-muted">{value}</span>
        </div>
      ))}
    </div>
  )
}
