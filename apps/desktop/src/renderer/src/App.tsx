import { useEffect } from 'react'
import { ContextMenuProvider, Toaster } from '@vayntforge/ui'
import { AppShell } from './components/AppShell'
import { DataBootstrapper } from './components/DataBootstrapper'
import { ThemeManager } from './lib/theme'
import { useConsole } from './stores/console'

export function App() {
  // Binds the Console's listeners at app startup, not when the Console tab
  // happens to be opened — otherwise any request sent before a user first
  // visits Console would be silently missed (Electron's ipcRenderer doesn't
  // buffer events for listeners that don't exist yet).
  useEffect(() => {
    useConsole.getState().bind()
  }, [])

  return (
    <ContextMenuProvider>
      <DataBootstrapper />
      <ThemeManager />
      <AppShell />
      <Toaster />
    </ContextMenuProvider>
  )
}