import { Bell, CircleHelp, Command, Search, Settings2, Zap } from 'lucide-react'
import { useSession } from '../stores/session'
import { EnvironmentSelector } from './EnvironmentSelector'
import { WorkspaceSwitcher } from './WorkspaceSwitcher'

export function TopBar() {
  const toggleSidebar = useSession((s) => s.toggleSidebar)
  const setPaletteOpen = useSession((s) => s.setPaletteOpen)

  return (
    <header className="flex h-11 shrink-0 items-center gap-3 border-b border-border bg-raised px-3">
      <div className="flex items-center gap-2">
        <button
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
          className="rounded p-1 text-muted transition-colors hover:bg-bg-hover hover:text-text"
        >
          <Zap className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2 select-none">
          <div className="flex h-5 w-5 items-center justify-center rounded bg-gradient-to-br from-accent to-accent-2">
            <Command className="h-3 w-3 text-white" />
          </div>
          <span className="text-[13px] font-bold tracking-[0.22em] text-text">APIFORGE</span>
        </div>
        <WorkspaceSwitcher />
      </div>

      <div className="mx-auto flex min-w-0 max-w-xl flex-1">
        <button
          onClick={() => setPaletteOpen(true)}
          className="group flex h-8 w-full items-center gap-2.5 rounded-md border border-border bg-bg-input px-3 text-[13px] text-faint transition-colors hover:border-border-strong focus-visible:border-accent focus-visible:outline-none"
          aria-label="Open command palette"
        >
          <Search className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Search requests, collections, environments...</span>
          <span className="ml-auto hidden items-center gap-0.5 rounded border border-border bg-raised px-1.5 py-0.5 text-[10px] text-faint md:flex">
            <Command className="h-2.5 w-2.5" />K
          </span>
        </button>
      </div>

      <div className="flex items-center gap-1">
        <EnvironmentSelector />
        <button
          aria-label="Notifications"
          className="relative rounded p-1.5 text-muted transition-colors hover:bg-bg-hover hover:text-text"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-accent" />
        </button>
        <button
          aria-label="Help"
          className="rounded p-1.5 text-muted transition-colors hover:bg-bg-hover hover:text-text"
        >
          <CircleHelp className="h-4 w-4" />
        </button>
        <button
          aria-label="Settings"
          className="rounded p-1.5 text-muted transition-colors hover:bg-bg-hover hover:text-text"
        >
          <Settings2 className="h-4 w-4" />
        </button>
        <div
          className="ml-1 flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-2 text-[10px] font-semibold text-white select-none"
          aria-hidden
        >
          PK
        </div>
      </div>
    </header>
  )
}