import { ContextMenuProvider, Toaster } from '@apiforge/ui'
import { AppShell } from './components/AppShell'
import { DataBootstrapper } from './components/DataBootstrapper'
import { ThemeManager } from './lib/theme'

export function App() {
  return (
    <ContextMenuProvider>
      <DataBootstrapper />
      <ThemeManager />
      <AppShell />
      <Toaster />
    </ContextMenuProvider>
  )
}