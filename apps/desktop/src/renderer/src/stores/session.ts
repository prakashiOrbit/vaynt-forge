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

export interface AppWorkspace {
  id: string
  name: string
  isDemo?: boolean
}

export function newRequestTab(seed?: Partial<Omit<WorkspaceTab, 'method'>>): WorkspaceTab {
  const id = seed?.id ?? `req_${crypto.randomUUID().slice(0, 8)}`
  return { id, method: 'GET', name: 'New Request', url: 'https://api.acme.dev/v1/users', ...seed }
}

interface SessionState {
  activeNav: string
  activeWorkspaceId: string
  activeEnvironmentId: string
  tabs: WorkspaceTab[]
  activeTabId: string | null
  sidebarCollapsed: boolean
  sidebarWidth: number
  theme: 'dark' | 'light' | 'system'
  onboardingComplete: boolean
  paletteOpen: boolean
  workspaces: AppWorkspace[]

  setActiveNav(nav: string): void
  setActiveWorkspace(id: string): void
  setActiveEnvironment(id: string): void
  openTab(tab: WorkspaceTab): void
  closeTab(id: string): void
  setActiveTab(id: string | null): void
  toggleSidebar(): void
  setSidebarWidth(width: number): void
  setTheme(theme: 'dark' | 'light' | 'system'): void
  completeOnboarding(): void
  setPaletteOpen(open: boolean): void
  createWorkspace(name: string): string
  renameWorkspace(id: string, name: string): void
  duplicateWorkspace(id: string): void
  deleteWorkspace(id: string): void
  openNewRequest(): void
}

const SAMPLE_TABS: WorkspaceTab[] = [
  { id: 't1', method: 'GET', name: 'Get User', url: 'https://api.acme.dev/v1/users?page=1&limit=20' },
  { id: 't2', method: 'POST', name: 'Login', url: 'https://api.acme.dev/v1/auth/login', dirty: true },
]

const DEFAULT_WORKSPACES: AppWorkspace[] = [
  { id: 'ws_acme', name: 'Acme API', isDemo: true },
  { id: 'ws_my', name: 'My Workspace' },
  { id: 'ws_itouch', name: 'iTouch' },
  { id: 'ws_arc', name: 'Project ARC' },
]

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      activeNav: 'home',
      activeWorkspaceId: 'ws_acme',
      activeEnvironmentId: 'env_dev',
      tabs: SAMPLE_TABS,
      activeTabId: 't1',
      sidebarCollapsed: false,
      sidebarWidth: 208,
      theme: 'dark',
      onboardingComplete: false,
      paletteOpen: false,
      workspaces: DEFAULT_WORKSPACES,

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
          const activeTabId =
            s.activeTabId === id ? (tabs[tabs.length - 1]?.id ?? null) : s.activeTabId
          return { tabs, activeTabId }
        }),
      setActiveTab: (id) => set({ activeTabId: id }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarWidth: (width) => set({ sidebarWidth: width }),
      setTheme: (theme) => set({ theme }),
      completeOnboarding: () => set({ onboardingComplete: true, paletteOpen: false }),
      setPaletteOpen: (open) => set({ paletteOpen: open }),
      createWorkspace: (name) => {
        const id = `ws_${crypto.randomUUID().slice(0, 8)}`
        set((s) => ({ workspaces: [...s.workspaces, { id, name }], activeWorkspaceId: id }))
        return id
      },
      renameWorkspace: (id, name) =>
        set((s) => ({
          workspaces: s.workspaces.map((w) => (w.id === id ? { ...w, name } : w)),
        })),
      duplicateWorkspace: (id) =>
        set((s) => {
          const src = s.workspaces.find((w) => w.id === id)
          if (!src) return {}
          return {
            workspaces: [
              ...s.workspaces,
              { ...src, id: `ws_${crypto.randomUUID().slice(0, 8)}`, name: `${src.name} Copy`, isDemo: false },
            ],
          }
        }),
      deleteWorkspace: (id) =>
        set((s) => {
          const workspaces = s.workspaces.filter((w) => w.id !== id)
          if (workspaces.length === s.workspaces.length || workspaces.length === 0) return {}
          const activeWorkspaceId =
            s.activeWorkspaceId === id ? (workspaces[0]?.id ?? 'ws_acme') : s.activeWorkspaceId
          return { workspaces, activeWorkspaceId }
        }),
      openNewRequest: () =>
        set((s) => {
          const tab = newRequestTab()
          return s.tabs.some((t) => t.id === tab.id)
            ? { activeTabId: tab.id }
            : { tabs: [...s.tabs, tab], activeTabId: tab.id }
        }),
    }),
    {
      name: 'apiforge-session',
      partialize: (s) => ({
        activeWorkspaceId: s.activeWorkspaceId,
        activeEnvironmentId: s.activeEnvironmentId,
        sidebarCollapsed: s.sidebarCollapsed,
        sidebarWidth: s.sidebarWidth,
        theme: s.theme,
        onboardingComplete: s.onboardingComplete,
        workspaces: s.workspaces,
      }),
    }
  )
)