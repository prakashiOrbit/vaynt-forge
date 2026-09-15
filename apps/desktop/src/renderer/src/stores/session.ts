import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { HttpMethod, TabKind } from '@vayntforge/engine'
import { useRealtime } from './realtime'

export interface WorkspaceTab {
  id: string
  kind?: TabKind
  method: HttpMethod
  name: string
  url: string
  dirty?: boolean
  /** Debugger tabs: the request/websocket tab whose draft+response they inspect. */
  sourceTabId?: string
}

export function newRequestTab(seed?: Partial<Omit<WorkspaceTab, 'method' | 'kind'>>): WorkspaceTab {
  const id = seed?.id ?? `req_${crypto.randomUUID().slice(0, 8)}`
  return { id, method: 'GET', name: 'New Request', url: 'https://api.acme.dev/v1/users', ...seed }
}

export function newWebSocketTab(seed?: Partial<WorkspaceTab>): WorkspaceTab {
  const id = `ws_${crypto.randomUUID().slice(0, 8)}`
  return { id, kind: 'ws', method: 'GET', name: 'WebSocket', url: 'ws://demo.vayntforge.dev/chat', ...seed }
}

export function newSseTab(seed?: Partial<WorkspaceTab>): WorkspaceTab {
  const id = `sse_${crypto.randomUUID().slice(0, 8)}`
  return { id, kind: 'sse', method: 'GET', name: 'SSE Monitor', url: 'https://demo.vayntforge.dev/events', ...seed }
}

export function newGraphQLTab(seed?: Partial<WorkspaceTab>): WorkspaceTab {
  const id = `gql_${crypto.randomUUID().slice(0, 8)}`
  return { id, kind: 'graphql', method: 'POST', name: 'GraphQL', url: 'https://api.acme.dev/graphql', ...seed }
}

export function newGrpcTab(seed?: Partial<WorkspaceTab>): WorkspaceTab {
  const id = `grpc_${crypto.randomUUID().slice(0, 8)}`
  return { id, kind: 'grpc', method: 'POST', name: 'gRPC', url: '127.0.0.1', ...seed }
}

export function newDebuggerTab(sourceTabId: string, seed?: Partial<WorkspaceTab>): WorkspaceTab {
  const id = `dbg_${crypto.randomUUID().slice(0, 8)}`
  return { id, kind: 'debugger', method: 'GET', name: 'Debugger', url: '', sourceTabId, ...seed }
}

export function newCompareTab(seed?: Partial<WorkspaceTab>): WorkspaceTab {
  const id = `cmp_${crypto.randomUUID().slice(0, 8)}`
  return { id, kind: 'compare', method: 'GET', name: 'Compare Requests', url: '', ...seed }
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
  openNewWebSocket(): void
  openNewSSE(): void
  openNewGraphQL(): void
  openNewGrpc(): void
  openDebugger(sourceTabId: string): void
  openCompare(): void
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
      closeTab: (id) => {
        useRealtime.getState().remove(id)
        set((s) => {
          const tabs = s.tabs.filter((t) => t.id !== id)
          const activeTabId =
            s.activeTabId === id ? (tabs[tabs.length - 1]?.id ?? null) : s.activeTabId
          return { tabs, activeTabId, activeNav: activeTabId ? s.activeNav : 'home' }
        })
      },
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
      openNewWebSocket: () =>
        set((s) => {
          const tab = newWebSocketTab()
          return { tabs: [...s.tabs, tab], activeTabId: tab.id, activeNav: REQUEST_BUILDER_NAV }
        }),
      openNewSSE: () =>
        set((s) => {
          const tab = newSseTab()
          return { tabs: [...s.tabs, tab], activeTabId: tab.id, activeNav: REQUEST_BUILDER_NAV }
        }),
      openNewGraphQL: () =>
        set((s) => {
          const tab = newGraphQLTab()
          return { tabs: [...s.tabs, tab], activeTabId: tab.id, activeNav: REQUEST_BUILDER_NAV }
        }),
      openNewGrpc: () =>
        set((s) => {
          const tab = newGrpcTab()
          return { tabs: [...s.tabs, tab], activeTabId: tab.id, activeNav: REQUEST_BUILDER_NAV }
        }),
      openDebugger: (sourceTabId) =>
        set((s) => {
          const source = s.tabs.find((t) => t.id === sourceTabId)
          const tab = newDebuggerTab(sourceTabId, { name: source ? `Debug: ${source.name}` : 'Debugger' })
          return { tabs: [...s.tabs, tab], activeTabId: tab.id, activeNav: REQUEST_BUILDER_NAV }
        }),
      openCompare: () =>
        set((s) => {
          const tab = newCompareTab()
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