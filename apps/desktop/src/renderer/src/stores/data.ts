import { create } from 'zustand'
import { DEFAULT_APP_SETTINGS } from '@vayntforge/engine'
import type {
  AppNotification,
  AppSettings,
  Collection,
  CollectionDraft,
  CollectionPatch,
  Environment,
  Folder,
  FolderDraft,
  FolderPatch,
  HistoryEntry,
  JarCookie,
  MockServer,
  NotificationDraft,
  OpenApiSpec,
  OpenApiSpecDraft,
  PerformanceRun,
  RequestModel,
  TestRun,
  Variable,
  Workspace,
  WorkspaceDraft,
} from '@vayntforge/engine'
import type { StorageChannel, WorkspaceSnapshot } from '../../../shared/types'
import { useSession } from './session'

function call<K extends keyof StorageChannel>(
  method: K,
  ...args: Parameters<StorageChannel[K]>
): Promise<ReturnType<StorageChannel[K]>> {
  return (window.vayntforge.storage.call as (m: typeof method, ...a: unknown[]) => Promise<unknown>)(
    method,
    ...args
  ) as Promise<ReturnType<StorageChannel[K]>>
}

/** Everything the active workspace needs, held per workspace (isolation). */
export interface WorkspaceBucket {
  loading: boolean
  loaded: boolean
  error: string | null
  collections: Collection[]
  foldersByCollection: Record<string, Folder[]>
  requests: RequestModel[]
  environments: Environment[]
  globalVariables: Variable[]
  mockServers: MockServer[]
  openApiSpecs: OpenApiSpec[]
  performanceRuns: PerformanceRun[]
  history: HistoryEntry[]
  testRuns: TestRun[]
  settings: AppSettings
  notifications: AppNotification[]
  cookies: JarCookie[]
  secretsSupported: boolean
}

export const DEFAULT_BUCKET: WorkspaceBucket = {
  loading: false,
  loaded: false,
  error: null,
  collections: [],
  foldersByCollection: {},
  requests: [],
  environments: [],
  globalVariables: [],
  mockServers: [],
  openApiSpecs: [],
  performanceRuns: [],
  history: [],
  testRuns: [],
  settings: DEFAULT_APP_SETTINGS,
  notifications: [],
  cookies: [],
  secretsSupported: true,
}

function bucketFromSnapshot(snap: WorkspaceSnapshot): WorkspaceBucket {
  return {
    loading: false,
    loaded: true,
    error: null,
    collections: snap.collections,
    foldersByCollection: snap.foldersByCollection,
    requests: snap.requests,
    environments: snap.environments,
    globalVariables: snap.globalVariables,
    mockServers: snap.mockServers,
    openApiSpecs: snap.openApiSpecs,
    performanceRuns: snap.performanceRuns,
    history: snap.history,
    testRuns: snap.testRuns,
    settings: snap.settings,
    notifications: snap.notifications,
    cookies: snap.cookies,
    secretsSupported: snap.secretsSupported,
  }
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/** Refresh every bucket that references the given entity id. */
function refreshHostingBuckets(ids: string[]): (state: DataState) => Promise<void> {
  return async (state: DataState) => {
    const hosts = Object.entries(state.buckets)
      .filter(([, b]) =>
        ids.some(
          (id) =>
            b.requests.some((r) => r.id === id) ||
            b.collections.some((c) => c.id === id) ||
            b.mockServers.some((m) => m.id === id) ||
            b.openApiSpecs.some((s) => s.id === id) ||
            b.performanceRuns.some((p) => p.id === id) ||
            b.environments.some((e) => e.id === id) ||
            b.globalVariables.some((g) => g.id === id) ||
            b.testRuns.some((t) => t.id === id) ||
            b.notifications.some((n) => n.id === id) ||
            b.history.some((h) => h.id === id)
        )
      )
      .map(([key]) => key)
    for (const wsId of hosts) await state.refresh(wsId)
  }
}

interface DataState {
  inited: boolean
  workspaces: Workspace[]
  buckets: Record<string, WorkspaceBucket>

  init(): Promise<void>
  loadWorkspaces(): Promise<void>
  refresh(workspaceId: string): Promise<void>
  ensureLoaded(workspaceId: string): Promise<void>

  createWorkspace(input: WorkspaceDraft): Promise<Workspace>
  renameWorkspace(id: string, name: string): Promise<void>
  deleteWorkspace(id: string): Promise<void>

  createCollection(input: CollectionDraft): Promise<Collection>
  updateCollection(id: string, patch: CollectionPatch): Promise<void>
  deleteCollection(id: string): Promise<void>

  createFolder(input: FolderDraft): Promise<Folder>
  updateFolder(id: string, patch: FolderPatch): Promise<void>
  deleteFolder(id: string, collectionId: string): Promise<void>

  saveRequest(request: RequestModel): Promise<void>
  deleteRequest(id: string): Promise<void>

  saveEnvironment(environment: Environment): Promise<void>
  deleteEnvironment(id: string): Promise<void>

  saveGlobalVariable(variable: Variable): Promise<void>
  deleteGlobalVariable(id: string): Promise<void>

  saveMockServer(server: MockServer): Promise<void>
  deleteMockServer(id: string): Promise<void>

  createOpenApiSpec(input: OpenApiSpecDraft): Promise<OpenApiSpec>
  deleteOpenApiSpec(id: string): Promise<void>

  savePerformanceRun(run: PerformanceRun): Promise<void>
  deletePerformanceRun(id: string): Promise<void>

  addHistory(workspaceId: string, entry: Omit<HistoryEntry, 'id'>): Promise<void>
  deleteHistoryEntry(id: string): Promise<void>
  clearHistory(workspaceId: string): Promise<void>

  saveTestRun(run: TestRun): Promise<void>
  deleteTestRun(id: string): Promise<void>

  saveSettings(workspaceId: string, settings: AppSettings): Promise<void>
  addNotification(input: NotificationDraft): Promise<void>
  markNotificationRead(id: string): Promise<void>
  dismissNotification(id: string): Promise<void>
  markAllNotificationsRead(workspaceId: string): Promise<void>
  clearNotifications(workspaceId: string): Promise<void>
  clearCookies(workspaceId: string): Promise<void>
}

export const useData = create<DataState>()((set, get) => ({
  inited: false,
  workspaces: [],
  buckets: {},

  init: async () => {
    if (get().inited) return
    await get().loadWorkspaces()
    set({ inited: true })
  },

  loadWorkspaces: async () => {
    const workspaces = await call('listWorkspaces')
    set({ workspaces })
  },

  refresh: async (workspaceId) => {
    set((s) => ({
      buckets: { ...s.buckets, [workspaceId]: { ...(s.buckets[workspaceId] ?? DEFAULT_BUCKET), loading: true } },
    }))
    try {
      const snap = await call('snapshot', workspaceId)
      set((s) => ({ buckets: { ...s.buckets, [workspaceId]: bucketFromSnapshot(snap) } }))
    } catch (err) {
      set((s) => ({
        buckets: {
          ...s.buckets,
          [workspaceId]: { ...(s.buckets[workspaceId] ?? DEFAULT_BUCKET), loading: false, error: messageOf(err) },
        },
      }))
      throw err
    }
  },

  ensureLoaded: async (workspaceId) => {
    if (!get().buckets[workspaceId]?.loaded) await get().refresh(workspaceId)
  },

  createWorkspace: async (input) => {
    const ws = await call('createWorkspace', input)
    await get().loadWorkspaces()
    await get().refresh(ws.id)
    return ws
  },
  renameWorkspace: async (id, name) => {
    await call('renameWorkspace', id, name)
    await get().loadWorkspaces()
  },
  deleteWorkspace: async (id) => {
    await call('deleteWorkspace', id)
    set((s) => {
      const buckets = { ...s.buckets }
      delete buckets[id]
      return { buckets }
    })
    await get().loadWorkspaces()
  },

  createCollection: async (input) => {
    const created = await call('createCollection', input)
    await get().refresh(created.workspaceId)
    return created
  },
  updateCollection: async (id, patch) => {
    await call('updateCollection', id, patch)
    await refreshHostingBuckets([id])(get())
  },
  deleteCollection: async (id) => {
    await call('deleteCollection', id)
    await refreshHostingBuckets([id])(get())
  },

  createFolder: async (input) => {
    const created = await call('createFolder', input)
    await refreshHostingBuckets([input.collectionId])(get())
    return created
  },
  updateFolder: async (id, patch) => {
    const updated = await call('updateFolder', id, patch)
    if (updated) await refreshHostingBuckets([updated.collectionId])(get())
  },
  deleteFolder: async (id, collectionId) => {
    await call('deleteFolder', id)
    await refreshHostingBuckets([collectionId])(get())
  },

  saveRequest: async (request) => {
    await call('saveRequest', request)
    await get().refresh(request.workspaceId)
  },
  deleteRequest: async (id) => {
    await call('deleteRequest', id)
    await refreshHostingBuckets([id])(get())
  },

  saveEnvironment: async (environment) => {
    await call('saveEnvironment', environment)
    await get().refresh(environment.workspaceId)
  },
  deleteEnvironment: async (id) => {
    await call('deleteEnvironment', id)
    await refreshHostingBuckets([id])(get())
  },

  saveGlobalVariable: async (variable) => {
    await call('saveGlobalVariable', variable)
    await get().refresh(variable.workspaceId ?? '')
  },
  deleteGlobalVariable: async (id) => {
    await call('deleteGlobalVariable', id)
    await refreshHostingBuckets([id])(get())
  },

  saveMockServer: async (server) => {
    await call('saveMockServer', server)
    await get().refresh(server.workspaceId)
  },
  deleteMockServer: async (id) => {
    await call('deleteMockServer', id)
    await refreshHostingBuckets([id])(get())
  },

  createOpenApiSpec: async (input) => {
    const created = await call('createOpenApiSpec', input)
    await get().refresh(created.workspaceId)
    return created
  },
  deleteOpenApiSpec: async (id) => {
    await call('deleteOpenApiSpec', id)
    await refreshHostingBuckets([id])(get())
  },

  savePerformanceRun: async (run) => {
    await call('savePerformanceRun', run)
    await get().refresh(run.workspaceId)
  },
  deletePerformanceRun: async (id) => {
    await call('deletePerformanceRun', id)
    await refreshHostingBuckets([id])(get())
  },

  addHistory: async (workspaceId, entry) => {
    await call('addHistory', entry)
    await get().refresh(workspaceId)
  },
  deleteHistoryEntry: async (id) => {
    await call('deleteHistoryEntry', id)
    await refreshHostingBuckets([id])(get())
  },
  clearHistory: async (workspaceId) => {
    await call('clearHistory', workspaceId)
    await get().refresh(workspaceId)
  },

  saveTestRun: async (run) => {
    await call('saveTestRun', run)
    await get().refresh(run.workspaceId)
  },
  deleteTestRun: async (id) => {
    await call('deleteTestRun', id)
    await refreshHostingBuckets([id])(get())
  },

  saveSettings: async (workspaceId, settings) => {
    await call('saveSettings', workspaceId, settings)
    await get().refresh(workspaceId)
  },
  addNotification: async (input) => {
    await call('addNotification', input)
    await get().refresh(input.workspaceId)
  },
  markNotificationRead: async (id) => {
    await call('updateNotification', id, { read: true })
    await refreshHostingBuckets([id])(get())
  },
  dismissNotification: async (id) => {
    await call('updateNotification', id, { dismissed: true })
    await refreshHostingBuckets([id])(get())
  },
  markAllNotificationsRead: async (workspaceId) => {
    const bucket = get().buckets[workspaceId]
    if (!bucket) return
    for (const n of bucket.notifications.filter((x) => !x.read)) {
      await call('updateNotification', n.id, { read: true })
    }
    await get().refresh(workspaceId)
  },
  clearNotifications: async (workspaceId) => {
    await call('clearNotifications', workspaceId)
    await get().refresh(workspaceId)
  },
  clearCookies: async (workspaceId) => {
    await call('clearCookieJar', workspaceId)
    await get().refresh(workspaceId)
  },
}))

// ── Selectors / hooks ──────────────────────────────────────

/** Live bucket for the currently active session workspace. */
export function useActiveWorkspaceData(): WorkspaceBucket {
  const workspaceId = useSession((s) => s.activeWorkspaceId)
  return useData((s) => s.buckets[workspaceId]) ?? DEFAULT_BUCKET
}

export function useDataWorkspace(workspaceId: string | null): WorkspaceBucket {
  return useData((s) => (workspaceId ? s.buckets[workspaceId] : undefined)) ?? DEFAULT_BUCKET
}

export function useActiveWorkspace(): Workspace | undefined {
  const workspaceId = useSession((s) => s.activeWorkspaceId)
  return useData((s) => s.workspaces.find((w) => w.id === workspaceId))
}

export function useWorkspaceById(id: string | null): Workspace | undefined {
  return useData((s) => (id ? s.workspaces.find((w) => w.id === id) : undefined))
}