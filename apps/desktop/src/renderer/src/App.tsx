import { ContextMenuProvider, Toaster } from '@apiforge/ui'
import { AppShell } from './components/AppShell'
import { ThemeManager } from './lib/theme'

export function App() {
  return (
    <ContextMenuProvider>
      <ThemeManager />
      <AppShell />
      <Toaster />
    </ContextMenuProvider>
  )
}