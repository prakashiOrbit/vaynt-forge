import { ChevronsLeft, ChevronsRight } from 'lucide-react'
import { NAV_ITEMS } from '../navigation'
import { useSession } from '../stores/session'
import { useDragResize } from '../lib/useDragResize'

const MIN_WIDTH = 52
const MAX_WIDTH = 320

export function Sidebar() {
  const collapsed = useSession((s) => s.sidebarCollapsed)
  const toggleSidebar = useSession((s) => s.toggleSidebar)
  const sidebarWidth = useSession((s) => s.sidebarWidth)
  const setSidebarWidth = useSession((s) => s.setSidebarWidth)
  const activeNav = useSession((s) => s.activeNav)
  const setActiveNav = useSession((s) => s.setActiveNav)

  const { resizing, onPointerDown } = useDragResize({
    axis: 'x',
    min: MIN_WIDTH,
    max: MAX_WIDTH,
    onChange: setSidebarWidth,
  })

  const main = NAV_ITEMS.filter((n) => n.section === 'main')
  const bottom = NAV_ITEMS.filter((n) => n.section === 'bottom')

  const renderItem = (id: string, label: string, Icon: (typeof NAV_ITEMS)[number]['icon']) => {
    const active = activeNav === id
    return (
      <button
        key={id}
        onClick={() => setActiveNav(id)}
        title={label}
        aria-label={label}
        aria-current={active ? 'page' : undefined}
        className={`group flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent ${
          active
            ? 'bg-bg-active text-text'
            : 'text-muted hover:bg-bg-hover hover:text-text'
        } ${collapsed ? 'justify-center px-0' : ''}`}
      >
        <Icon
          className={`h-4 w-4 shrink-0 ${active ? 'text-accent' : 'text-faint group-hover:text-muted'}`}
        />
        {!collapsed && <span className="truncate">{label}</span>}
      </button>
    )
  }

  return (
    <aside
      className={`relative flex shrink-0 flex-col border-r border-border bg-raised transition-[width] ${
        resizing ? 'duration-0' : 'duration-150'
      } ${resizing ? 'select-none touch-none' : ''}`}
      style={collapsed ? { width: 48 } : { width: sidebarWidth }}
    >
      <div
        onPointerDown={onPointerDown}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        className="absolute inset-y-0 right-0 z-10 w-1 cursor-col-resize bg-transparent transition-colors hover:bg-accent/40 active:bg-accent"
      />
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2" aria-label="Primary">
        {main.map((n) => renderItem(n.id, n.label, n.icon))}
      </nav>
      <div className="space-y-0.5 border-t border-border p-2">
        {bottom.map((n) => renderItem(n.id, n.label, n.icon))}
        <button
          onClick={toggleSidebar}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-muted transition-colors hover:bg-bg-hover hover:text-text ${
            collapsed ? 'justify-center px-0' : ''
          }`}
        >
          {collapsed ? (
            <ChevronsRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronsLeft className="h-4 w-4" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  )
}