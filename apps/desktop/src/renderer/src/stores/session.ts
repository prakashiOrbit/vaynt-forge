import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { HttpMethod } from '@vayntforge/engine'

export interface WorkspaceTab {
  id: string
  method: HttpMethod
  name: string
  url: string
  dirty?: boolean
}

export function newRequestTab(seed?: Partial<Omit<WorkspaceTab, 'method'>>): WorkspaceTab {
  const id = seed?.id ?? `req_${crypto.randomUUID().slice(0, 8)}`
  return { id, method: 'GET', name: 'New Request', url: 'https://api.acme.dev/v1/users', ...seed }
}

/** Nav id the shell switches to whenever a request/websocket tab becomes active. */
export const REQUEST_BUILDER_NAV = 'request-builder'

interface SessionState {
  activeNav: string
  activeWorkspaceId: string
  activeEnvironmentId: string
  tabs: WorkspaceTab[]
  activeTabId: string | null
  sidebarCollapsed: boolean
  sidebarWidth: number
  explorerWidth: number
  responseHeight: number
  theme: 'dark' | 'light' | 'system'
  onboardingComplete: boolean
  paletteOpen: boolean

  setActiveNav(nav: string): void
  setActiveWorkspace(id: string): void
  setActiveEnvironment(id: string): void
  openTab(tab: WorkspaceTab): void
  closeTab(id: string): void
  setActiveTab(id: string | null): void
  updateTab(id: string, patch: Partial<Pick<WorkspaceTab, 'name' | 'method' | 'url' | 'dirty'>>): void
  toggleSidebar(): void
  setSidebarWidth(width: number): void
  setExplorerWidth(width: number): void
  setResponseHeight(height: number): void
  setTheme(theme: 'dark' | 'light' | 'system'): void
  completeOnboarding(): void
  setPaletteOpen(open: boolean): void
  openNewRequest(): void
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      activeNav: 'home',
      activeWorkspaceId: '',
      activeEnvironmentId: '',
      tabs: [],
      activeTabId: null,
      sidebarCollapsed: false,
      sidebarWidth: 208,
      explorerWidth: 240,
      responseHeight: 280,
      theme: 'dark',
      onboardingComplete: false,
      paletteOpen: false,

      setActiveNav: (nav) => set({ activeNav: nav }),
      setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),
      setActiveEnvironment: (id) => set({ activeEnvironmentId: id }),
      openTab: (tab) =>
        set((s) =>
          s.tabs.some((t) => t.id === tab.id)
            ? { activeTabId: tab.id, activeNav: REQUEST_BUILDER_NAV }
            : { tabs: [...s.tabs, tab], activeTabId: tab.id, activeNav: REQUEST_BUILDER_NAV }
        ),
      closeTab: (id) =>
        set((s) => {
          const tabs = s.tabs.filter((t) => t.id !== id)
          const activeTabId =
            s.activeTabId === id ? (tabs[tabs.length - 1]?.id ?? null) : s.activeTabId
          return { tabs, activeTabId, activeNav: activeTabId ? s.activeNav : 'home' }
        }),
      setActiveTab: (id) => set({ activeTabId: id, activeNav: id ? REQUEST_BUILDER_NAV : 'home' }),
      updateTab: (id, patch) =>
        set((s) => ({ tabs: s.tabs.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarWidth: (width) => set({ sidebarWidth: width }),
      setExplorerWidth: (width) => set({ explorerWidth: width }),
      setResponseHeight: (height) => set({ responseHeight: height }),
      setTheme: (theme) => set({ theme }),
      completeOnboarding: () => set({ onboardingComplete: true, paletteOpen: false }),
      setPaletteOpen: (open) => set({ paletteOpen: open }),
      openNewRequest: () =>
        set((s) => {
          const tab = newRequestTab()
          return { tabs: [...s.tabs, tab], activeTabId: tab.id, activeNav: REQUEST_BUILDER_NAV }
        }),
    }),
    {
      name: 'vayntforge-session',
      partialize: (s) => ({
        activeWorkspaceId: s.activeWorkspaceId,
        activeEnvironmentId: s.activeEnvironmentId,
        sidebarCollapsed: s.sidebarCollapsed,
        sidebarWidth: s.sidebarWidth,
        explorerWidth: s.explorerWidth,
        responseHeight: s.responseHeight,
        theme: s.theme,
        onboardingComplete: s.onboardingComplete,
      }),
    }
  )
)