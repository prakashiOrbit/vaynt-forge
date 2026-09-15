import type { ComponentType } from 'react'
import { useSession } from '../stores/session'
import { useKeyboardShortcut } from '../lib/shortcuts'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { WorkspaceTabs } from './WorkspaceTabs'
import { StatusBar } from './StatusBar'
import { CommandPalette } from './CommandPalette'
import { Onboarding } from './Onboarding'
import { HomePage } from '../pages/HomePage'
import { RequestBuilderPage } from '../pages/RequestBuilderPage'
import { RequestsPage } from '../pages/RequestsPage'
import { CollectionsPage } from '../pages/CollectionsPage'
import { EnvironmentsPage } from '../pages/EnvironmentsPage'
import { HistoryPage } from '../pages/HistoryPage'
import { WebSocketsPage } from '../pages/WebSocketsPage'
import { PerformancePage } from '../pages/PerformancePage'
import { DocumentationPage } from '../pages/DocumentationPage'
import { OpenApiPage } from '../pages/OpenApiPage'
import { MockServersPage } from '../pages/MockServersPage'
import { ShortcutsPage } from '../pages/ShortcutsPage'
import { SettingsPage } from '../pages/SettingsPage'
import { PlaceholderPage } from '../pages/PlaceholderPage'

const SCREENS: Record<string, ComponentType> = {
  home: HomePage,
  'request-builder': RequestBuilderPage,
  requests: RequestsPage,
  collections: CollectionsPage,
  environments: EnvironmentsPage,
  history: HistoryPage,
  websockets: WebSocketsPage,
  performance: PerformancePage,
  openapi: OpenApiPage,
  documentation: DocumentationPage,
  'mock-servers': MockServersPage,
  shortcuts: ShortcutsPage,
  settings: SettingsPage,
}

export function AppShell() {
  const activeNav = useSession((s) => s.activeNav)
  const onboardingComplete = useSession((s) => s.onboardingComplete)
  const paletteOpen = useSession((s) => s.paletteOpen)
  const setPaletteOpen = useSession((s) => s.setPaletteOpen)
  const activeTabId = useSession((s) => s.activeTabId)
  const closeTab = useSession((s) => s.closeTab)

  useKeyboardShortcut(['cmd'], 'k', () => setPaletteOpen(!paletteOpen))
  useKeyboardShortcut(['cmd'], 'p', () => setPaletteOpen(!paletteOpen), { allowInInputs: true })
  useKeyboardShortcut([], 'escape', () => setPaletteOpen(false), { allowInInputs: true })
  useKeyboardShortcut(
    ['cmd'],
    'w',
    () => {
      if (activeTabId) closeTab(activeTabId)
    },
    { allowInInputs: true }
  )

  if (!onboardingComplete) return <Onboarding />

  const Screen = SCREENS[activeNav]

  return (
    <div className="flex h-full flex-col bg-bg text-text">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="flex min-w-0 flex-1 flex-col">
          <WorkspaceTabs />
          <div className="min-h-0 flex-1 overflow-auto">
            {Screen ? <Screen /> : <PlaceholderPage navId={activeNav} />}
          </div>
        </main>
      </div>
      <StatusBar />
      <CommandPalette />
    </div>
  )
}