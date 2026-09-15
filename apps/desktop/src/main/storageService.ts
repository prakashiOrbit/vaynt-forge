import { safeStorage } from 'electron'
import { SQLiteStorage } from '@vayntforge/sqlite'
import { withSecretCodec, seedProvider, DEFAULT_APP_SETTINGS } from '@vayntforge/engine'
import type {
  SecretCodec,
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
import type { StorageChannel, WorkspaceSnapshot } from '../shared/types'

/**
 * Electron `safeStorage` codec — secret variable values are encrypted with the
 * OS keychain before they reach SQLite and decrypted only on read. On platforms
 * where the keyring is unavailable the values stay plaintext and
 * `secretsSupported` reports false so the UI can warn.
 */
class SafeStorageCodec implements SecretCodec {
  isAvailable(): boolean {
    try {
      return safeStorage.isEncryptionAvailable()
    } catch {
      return false
    }
  }
  encrypt(plaintext: string): string {
    return safeStorage.encryptString(plaintext).toString('base64')
  }
  decrypt(payload: string): string {
    try {
      return safeStorage.decryptString(Buffer.from(payload, 'base64'))
    } catch {
      return payload
    }
  }
}

/**
 * The main-process storage service. Implements {@link StorageChannel} over the
 * SQLite provider, seeded with the "Acme API" demo on first launch. Seeded secret
 * values are encrypted at rest via the safeStorage codec.
 */
export class StorageService implements StorageChannel {
  private readonly provider: ReturnType<typeof withSecretCodec>

  constructor(dbPath: string) {
    const raw = new SQLiteStorage({ path: dbPath })
    this.provider = withSecretCodec(raw, new SafeStorageCodec())
    if (raw.listWorkspaces().length === 0) seedProvider(this.provider)
  }

  // ── Workspaces ────────────────────────────────────────────
  async listWorkspaces(): Promise<Workspace[]> {
    return this.provider.listWorkspaces()
  }
  async createWorkspace(input: WorkspaceDraft): Promise<Workspace> {
    return this.provider.createWorkspace(input)
  }
  async renameWorkspace(id: string, name: string): Promise<Workspace> {
    const updated = this.provider.updateWorkspace(id, { name })
    if (!updated) throw new Error(`Workspace not found: ${id}`)
    return updated
  }
  async deleteWorkspace(id: string): Promise<void> {
    this.provider.deleteWorkspace(id)
  }

  async snapshot(workspaceId: string): Promise<WorkspaceSnapshot> {
    const foldersByCollection: Record<string, Folder[]> = {}
    for (const col of this.provider.listCollections(workspaceId)) {
      foldersByCollection[col.id] = this.provider.listFolders(col.id)
    }
    return {
      workspaceId,
      collections: this.provider.listCollections(workspaceId),
      foldersByCollection,
      requests: this.provider.listRequests(workspaceId),
      environments: this.provider.listEnvironments(workspaceId),
      globalVariables: this.provider.listGlobalVariables(workspaceId),
      mockServers: this.provider.listMockServers(workspaceId),
      history: this.provider.listHistory(workspaceId),
      testRuns: this.provider.listTestRuns(workspaceId),
      settings: this.provider.getSettings(workspaceId) ?? DEFAULT_APP_SETTINGS,
      notifications: this.provider.listNotifications(workspaceId),
      secretsSupported: new SafeStorageCodec().isAvailable(),
      updatedAt: Date.now(),
    }
  }

  // ── Collections ───────────────────────────────────────────
  async createCollection(input: CollectionDraft): Promise<Collection> {
    return this.provider.createCollection(input)
  }
  async updateCollection(id: string, patch: CollectionPatch): Promise<Collection> {
    const updated = this.provider.updateCollection(id, patch)
    if (!updated) throw new Error(`Collection not found: ${id}`)
    return updated
  }
  async deleteCollection(id: string): Promise<void> {
    this.provider.deleteCollection(id)
  }

  // ── Folders ───────────────────────────────────────────────
  async createFolder(input: FolderDraft): Promise<Folder> {
    return this.provider.createFolder(input)
  }
  async updateFolder(id: string, patch: FolderPatch): Promise<Folder> {
    const updated = this.provider.updateFolder(id, patch)
    if (!updated) throw new Error(`Folder not found: ${id}`)
    return updated
  }
  async deleteFolder(id: string): Promise<void> {
    this.provider.deleteFolder(id)
  }

  // ── Requests ──────────────────────────────────────────────
  async saveRequest(request: RequestModel): Promise<RequestModel> {
    this.provider.saveRequest(request)
    return this.provider.getRequest(request.id) ?? request
  }
  async deleteRequest(id: string): Promise<void> {
    this.provider.deleteRequest(id)
  }

  // ── Environments + global variables (secret-aware via codec) ─
  async saveEnvironment(environment: Environment): Promise<Environment> {
    this.provider.saveEnvironment(environment)
    return this.provider.listEnvironments(environment.workspaceId).find((e) => e.id === environment.id) ?? environment
  }
  async deleteEnvironment(id: string): Promise<void> {
    this.provider.deleteEnvironment(id)
  }
  async saveGlobalVariable(variable: Variable): Promise<Variable> {
    this.provider.saveGlobalVariable(variable)
    return this.provider.listGlobalVariables(variable.workspaceId ?? '').find((v) => v.id === variable.id) ?? variable
  }
  async deleteGlobalVariable(id: string): Promise<void> {
    this.provider.deleteGlobalVariable(id)
  }

  // ── Mock servers ──────────────────────────────────────────
  async saveMockServer(server: MockServer): Promise<MockServer> {
    this.provider.saveMockServer(server)
    return this.provider.getMockServer(server.id) ?? server
  }
  async deleteMockServer(id: string): Promise<void> {
    this.provider.deleteMockServer(id)
  }

  // ── History ───────────────────────────────────────────────
  async addHistory(entry: Omit<HistoryEntry, 'id'>): Promise<HistoryEntry> {
    if (!entry.workspaceId) throw new Error('addHistory requires a workspaceId')
    return this.provider.addHistory(entry)
  }
  async clearHistory(workspaceId: string): Promise<void> {
    this.provider.clearHistory(workspaceId)
  }

  // ── Test runs ─────────────────────────────────────────────
  async saveTestRun(run: TestRun): Promise<TestRun> {
    this.provider.saveTestRun(run)
    return run
  }
  async deleteTestRun(id: string): Promise<void> {
    this.provider.deleteTestRun(id)
  }

  // ── Settings ──────────────────────────────────────────────
  async saveSettings(workspaceId: string, settings: AppSettings): Promise<AppSettings> {
    this.provider.saveSettings(workspaceId, settings)
    return this.provider.getSettings(workspaceId) ?? settings
  }

  // ── Notifications ─────────────────────────────────────────
  async addNotification(input: NotificationDraft): Promise<AppNotification> {
    return this.provider.addNotification(input)
  }
  async updateNotification(id: string, patch: NotificationPatch): Promise<AppNotification> {
    const updated = this.provider.updateNotification(id, patch)
    if (!updated) throw new Error(`Notification not found: ${id}`)
    return updated
  }
  async clearNotifications(workspaceId: string): Promise<void> {
    this.provider.clearNotifications(workspaceId)
  }

  async secretsSupported(): Promise<boolean> {
    return new SafeStorageCodec().isAvailable()
  }

  close(): void {
    const raw = this.provider as unknown as { close?: () => void }
    raw.close?.()
  }
}