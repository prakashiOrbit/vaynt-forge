import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

export interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex h-full min-h-[260px] flex-col items-center justify-center px-6 text-center">
      {Icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-raised">
          <Icon className="h-5 w-5 text-[var(--af-text-faint)]" />
        </div>
      )}
      <h3 className="mt-4 text-[13px] font-semibold text-[var(--af-text)]">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-[12px] leading-relaxed text-[var(--af-text-faint)]">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}