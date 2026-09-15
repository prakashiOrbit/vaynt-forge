export interface TabItem<T extends string = string> {
  id: T
  label: string
  badge?: number
}

export interface TabsProps<T extends string = string> {
  tabs: TabItem<T>[]
  active: T
  onChange(id: T): void
  className?: string
}

/** Dense horizontal segmented tab strip — used for request/response sub-tabs. */
export function Tabs<T extends string = string>({ tabs, active, onChange, className = '' }: TabsProps<T>) {
  return (
    <div
      role="tablist"
      className={`flex items-stretch gap-1 border-b border-border px-1 ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === active
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-1.5 border-b-2 px-2.5 py-2 text-[12px] font-medium transition-colors ${
              isActive
                ? 'border-accent text-text'
                : 'border-transparent text-muted hover:text-text'
            }`}
          >
            {tab.label}
            {typeof tab.badge === 'number' && tab.badge > 0 && (
              <span className="rounded-full bg-bg-active px-1.5 py-0.5 text-[10px] leading-none text-faint">
                {tab.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
