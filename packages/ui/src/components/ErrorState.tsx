import { TriangleAlert } from 'lucide-react'
import { Button } from './Button'

export interface ErrorStateProps {
  title?: string
  description?: string
  onRetry?(): void
}

export function ErrorState({
  title = 'Something went wrong',
  description,
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex h-full min-h-[260px] flex-col items-center justify-center px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-[var(--af-err)]/30 bg-[var(--af-err)]/10">
        <TriangleAlert className="h-5 w-5 text-[var(--af-err)]" />
      </div>
      <h3 className="mt-4 text-[13px] font-semibold text-[var(--af-text)]">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-[12px] leading-relaxed text-[var(--af-text-faint)]">
          {description}
        </p>
      )}
      {onRetry && (
        <div className="mt-4">
          <Button size="sm" variant="outline" onClick={onRetry}>
            Try again
          </Button>
        </div>
      )}
    </div>
  )
}