import { useSession } from '../stores/session'
import { useKeyboardShortcut } from '../lib/shortcuts'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { WorkspaceTabs } from './WorkspaceTabs'
import { StatusBar } from './StatusBar'
import { CommandPalette } from './CommandPalette'
import { Onboarding } from './Onboarding'
import { HomePage } from '../pages/HomePage'
import { PlaceholderPage } from '../pages/PlaceholderPage'

export function AppShell() {
  const activeNav = useSession((s) => s.activeNav)
  const onboardingComplete = useSession((s) => s.onboardingComplete)
  const paletteOpen = useSession((s) => s.paletteOpen)
  const setPaletteOpen = useSession((s) => s.setPaletteOpen)

  useKeyboardShortcut(['cmd'], 'k', () => setPaletteOpen(!paletteOpen))
  useKeyboardShortcut([], 'escape', () => setPaletteOpen(false), { allowInInputs: true })

  if (!onboardingComplete) return <Onboarding />

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
      <CommandPalette />
    </div>
  )
}