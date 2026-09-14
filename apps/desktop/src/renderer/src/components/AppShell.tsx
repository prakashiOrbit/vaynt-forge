import { useSession } from '../stores/session'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { WorkspaceTabs } from './WorkspaceTabs'
import { StatusBar } from './StatusBar'
import { HomePage } from '../pages/HomePage'
import { PlaceholderPage } from '../pages/PlaceholderPage'

export function AppShell() {
  const activeNav = useSession((s) => s.activeNav)

  return (
    <div className="flex h-full flex-col bg-bg text-text">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="flex min-w-0 flex-1 flex-col">
          <WorkspaceTabs />
          <div className="min-h-0 flex-1 overflow-auto">
            {activeNav === 'home' ? <HomePage /> : <PlaceholderPage navId={activeNav} />}
          </div>
        </main>
      </div>
      <StatusBar />
    </div>
  )
}