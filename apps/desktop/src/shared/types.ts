import type {
  Workspace,
  Collection,
  Folder,
  HistoryEntry,
  TestRun,
  RequestModel,
  Environment,
  Variable,
  MockServer,
  AppSettings,
  AppNotification,
  NotificationPatch,
  WorkspaceDraft,
  CollectionDraft,
  CollectionPatch,
  FolderDraft,
  FolderPatch,
  NotificationDraft,
} from '@vayntforge/engine'

/**
 * Everything a single workspace needs rendered. Assembled by the main process
 * from the storage provider (secret variable values already decrypted).
 */
export interface WorkspaceSnapshot {
  workspaceId: string
  collections: Collection[]
  foldersByCollection: Record<string, Folder[]>
  requests: RequestModel[]
  environments: Environment[]
  globalVariables: Variable[]
  mockServers: MockServer[]
  history: HistoryEntry[]
  testRuns: TestRun[]
  settings: AppSettings
  notifications: AppNotification[]
  secretsSupported: boolean
  updatedAt: number
}

/**
 * The typed storage surface the renderer calls over IPC (`storage:call`).
 * Sits between the session/data Zustand stores and the main-process
 * SQLite-backed provider, which encrypts secret values with safeStorage.
 */
export interface StorageChannel {
  listWorkspaces(): Promise<Workspace[]>
  createWorkspace(input: WorkspaceDraft): Promise<Workspace>
  renameWorkspace(id: string, name: string): Promise<Workspace>
  deleteWorkspace(id: string): Promise<void>

  snapshot(workspaceId: string): Promise<WorkspaceSnapshot>

  createCollection(input: CollectionDraft): Promise<Collection>
  updateCollection(id: string, patch: CollectionPatch): Promise<Collection>
  deleteCollection(id: string): Promise<void>

  createFolder(input: FolderDraft): Promise<Folder>
  updateFolder(id: string, patch: FolderPatch): Promise<Folder>
  deleteFolder(id: string): Promise<void>

  saveRequest(request: RequestModel): Promise<RequestModel>
  deleteRequest(id: string): Promise<void>

  saveEnvironment(environment: Environment): Promise<Environment>
  deleteEnvironment(id: string): Promise<void>

  saveGlobalVariable(variable: Variable): Promise<Variable>
  deleteGlobalVariable(id: string): Promise<void>

  saveMockServer(server: MockServer): Promise<MockServer>
  deleteMockServer(id: string): Promise<void>

  addHistory(entry: Omit<HistoryEntry, 'id'>): Promise<HistoryEntry>
  clearHistory(workspaceId: string): Promise<void>

  saveTestRun(run: TestRun): Promise<TestRun>
  deleteTestRun(id: string): Promise<void>

  saveSettings(workspaceId: string, settings: AppSettings): Promise<AppSettings>
  addNotification(input: NotificationDraft): Promise<AppNotification>
  updateNotification(id: string, patch: NotificationPatch): Promise<AppNotification>
  clearNotifications(workspaceId: string): Promise<void>

  /** Whether the platform secure store is usable (affects secret masking UX). */
  secretsSupported(): Promise<boolean>
}

export interface VayntForgeApi {
  app: {
    /** Proves the renderer ↔ main IPC round-trip works (Sprint 0). */
    ping(): Promise<string>
    version: string
  }
  storage: {
    /** Type-safe generic call into the SQLite-backed {@link StorageChannel}. */
    call<K extends keyof StorageChannel>(
      method: K,
      ...args: Parameters<StorageChannel[K]>
    ): Promise<ReturnType<StorageChannel[K]>>
  }
}