import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { HttpMethod } from '@apiforge/engine'

export interface WorkspaceTab {
  id: string
  method: HttpMethod
  name: string
  url: string
  dirty?: boolean
}

interface SessionState {
  activeNav: string
  activeWorkspaceId: string | null
  activeEnvironmentId: string | null
  tabs: WorkspaceTab[]
  activeTabId: string | null
  sidebarCollapsed: boolean
  theme: 'dark' | 'light' | 'system'

  setActiveNav(nav: string): void
  setActiveWorkspace(id: string): void
  setActiveEnvironment(id: string): void
  openTab(tab: WorkspaceTab): void
  closeTab(id: string): void
  setActiveTab(id: string | null): void
  toggleSidebar(): void
  setTheme(theme: 'dark' | 'light' | 'system'): void
}

const SAMPLE_TABS: WorkspaceTab[] = [
  { id: 't1', method: 'GET', name: 'Get User', url: 'https://api.acme.dev/v1/users?page=1&limit=20' },
  { id: 't2', method: 'POST', name: 'Login', url: 'https://api.acme.dev/v1/auth/login', dirty: true },
]

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      activeNav: 'home',
      activeWorkspaceId: null,
      activeEnvironmentId: 'env_dev',
      tabs: SAMPLE_TABS,
      activeTabId: 't1',
      sidebarCollapsed: false,
      theme: 'dark',

      setActiveNav: (nav) => set({ activeNav: nav }),
      setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),
      setActiveEnvironment: (id) => set({ activeEnvironmentId: id }),
      openTab: (tab) =>
        set((s) =>
          s.tabs.some((t) => t.id === tab.id)
            ? { activeTabId: tab.id }
            : { tabs: [...s.tabs, tab], activeTabId: tab.id }
        ),
      closeTab: (id) =>
        set((s) => {
          const tabs = s.tabs.filter((t) => t.id !== id)
          const activeTabId = s.activeTabId === id ? tabs[tabs.length - 1]?.id ?? null : s.activeTabId
          return { tabs, activeTabId }
        }),
      setActiveTab: (id) => set({ activeTabId: id }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'apiforge-session',
      partialize: (s) => ({
        activeWorkspaceId: s.activeWorkspaceId,
        activeEnvironmentId: s.activeEnvironmentId,
        sidebarCollapsed: s.sidebarCollapsed,
        theme: s.theme,
      }),
    }
  )
)