export interface LoadingStateProps {
  rows?: number
}

export function LoadingState({ rows = 5 }: LoadingStateProps) {
  return (
    <div className="flex h-full min-h-[260px] flex-col justify-center">
      <div className="space-y-1.5 animate-pulse">
        <div className="h-8" />
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-md border border-transparent px-3 py-2">
            <div className="h-3.5 w-10 rounded bg-[var(--af-bg-active)]" />
            <div className="h-3.5 flex-1 rounded bg-[var(--af-bg-active)]" />
            <div className="h-3.5 w-16 rounded bg-[var(--af-bg-active)]" />
          </div>
        ))}
      </div>
    </div>
  )
}