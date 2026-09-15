import type {
  StorageProvider,
  WorkspaceDraft,
  WorkspacePatch,
  CollectionDraft,
  CollectionPatch,
  FolderDraft,
  FolderPatch,
  HistoryInput,
  NotificationDraft,
} from './provider'
import type { Workspace, Collection, Folder, HistoryEntry, TestRun } from '../types/workspace'
import type { RequestModel } from '../types/request'
import type { Variable, Environment } from '../types/variables'
import type { MockServer } from '../types/mock'
import type { AppSettings } from '../types/settings'
import type { AppNotification } from '../types/notifications'
import { seedProvider } from './seed'

/**
 * Pure-TS storage provider — no Electron, no Node imports. Used by tests and
 * as the reference semantics for `SQLiteStorage` in @vayntforge/sqlite.
 * `seed = true` (default) populates the "Acme API" demo workspace.
 */
export class InMemoryStorage implements StorageProvider {
  private workspaces = new Map<string, Workspace>()
  private collections = new Map<string, Collection>()
  private folders = new Map<string, Folder>()
  private requests = new Map<string, RequestModel>()
  private environments = new Map<string, Environment>()
  private globalVariables = new Map<string, Variable>()
  private mockServers = new Map<string, MockServer>()
  private history: HistoryEntry[] = []
  private testRuns = new Map<string, TestRun>()
  private settings = new Map<string, AppSettings>()
  private notifications = new Map<string, AppNotification>()
  private seq = 0

  constructor(seed = true) {
    if (seed) seedProvider(this)
  }

  private nextId(prefix: string): string {
    this.seq += 1
    return `${prefix}_${this.seq}`
  }

  // ── Workspaces ────────────────────────────────────────────
  listWorkspaces(): Workspace[] {
    return [...this.workspaces.values()]
  }
  getWorkspace(id: string): Workspace | undefined {
    return this.workspaces.get(id)
  }
  createWorkspace(input: WorkspaceDraft): Workspace {
    const now = Date.now()
    const ws = { ...input, id: this.nextId('ws'), createdAt: now, updatedAt: now }
    this.workspaces.set(ws.id, ws)
    return ws
  }
  updateWorkspace(id: string, patch: WorkspacePatch): Workspace | undefined {
    const current = this.workspaces.get(id)
    if (!current) return undefined
    const updated = { ...current, ...patch, id, createdAt: current.createdAt, updatedAt: Date.now() }
    this.workspaces.set(id, updated)
    return updated
  }
  deleteWorkspace(id: string): void {
    const collections = this.listCollections(id)
    for (const col of collections) {
      for (const folder of this.listFolders(col.id)) this.folders.delete(folder.id)
      this.collections.delete(col.id)
    }
    for (const r of this.listRequests(id)) this.requests.delete(r.id)
    for (const e of this.listEnvironments(id)) this.environments.delete(e.id)
    for (const v of this.listGlobalVariables(id)) this.globalVariables.delete(v.id)
    for (const s of this.listMockServers(id)) this.mockServers.delete(s.id)
    this.history = this.history.filter((h) => h.workspaceId !== id)
    for (const r of this.listTestRuns(id)) this.testRuns.delete(r.id)
    for (const n of this.listNotifications(id)) this.notifications.delete(n.id)
    this.settings.delete(id)
    this.workspaces.delete(id)
  }

  // ── Collections ───────────────────────────────────────────
  listCollections(workspaceId: string): Collection[] {
    return [...this.collections.values()].filter((c) => c.workspaceId === workspaceId)
  }
  getCollection(id: string): Collection | undefined {
    return this.collections.get(id)
  }
  createCollection(input: CollectionDraft): Collection {
    const now = Date.now()
    const c = { ...input, id: this.nextId('col'), createdAt: now, updatedAt: now }
    this.collections.set(c.id, c)
    return c
  }
  updateCollection(id: string, patch: CollectionPatch): Collection | undefined {
    const current = this.collections.get(id)
    if (!current) return undefined
    const updated = { ...current, ...patch, id, createdAt: current.createdAt, updatedAt: Date.now() }
    this.collections.set(id, updated)
    return updated
  }
  deleteCollection(id: string): void {
    for (const folder of this.listFolders(id)) this.folders.delete(folder.id)
    this.collections.delete(id)
  }

  // ── Folders ───────────────────────────────────────────────
  listFolders(collectionId: string): Folder[] {
    return [...this.folders.values()].filter((f) => f.collectionId === collectionId)
  }
  createFolder(input: FolderDraft): Folder {
    const folder: Folder = { ...input, id: this.nextId('fld'), requestIds: input.requestIds ?? [] }
    this.folders.set(folder.id, folder)
    return folder
  }
  updateFolder(id: string, patch: FolderPatch): Folder | undefined {
    const current = this.folders.get(id)
    if (!current) return undefined
    const updated = { ...current, ...patch, id }
    this.folders.set(id, updated)
    return updated
  }
  deleteFolder(id: string): void {
    this.folders.delete(id)
  }

  // ── Requests ──────────────────────────────────────────────
  listRequests(workspaceId: string): RequestModel[] {
    return [...this.requests.values()].filter((r) => r.workspaceId === workspaceId)
  }
  getRequest(id: string): RequestModel | undefined {
    return this.requests.get(id)
  }
  saveRequest(request: RequestModel): void {
    this.requests.set(request.id, { ...request, updatedAt: Date.now() })
  }
  deleteRequest(id: string): void {
    this.requests.delete(id)
  }

  // ── Environments ──────────────────────────────────────────
  listEnvironments(workspaceId: string): Environment[] {
    return [...this.environments.values()].filter((e) => e.workspaceId === workspaceId)
  }
  getEnvironment(id: string): Environment | undefined {
    return this.environments.get(id)
  }
  saveEnvironment(environment: Environment): void {
    this.environments.set(environment.id, { ...environment, updatedAt: Date.now() })
  }
  deleteEnvironment(id: string): void {
    this.environments.delete(id)
  }

  // ── Global variables ──────────────────────────────────────
  listGlobalVariables(workspaceId: string): Variable[] {
    return [...this.globalVariables.values()].filter((v) => v.workspaceId === workspaceId)
  }
  saveGlobalVariable(variable: Variable): void {
    this.globalVariables.set(variable.id, variable)
  }
  deleteGlobalVariable(id: string): void {
    this.globalVariables.delete(id)
  }

  // ── Mock servers ──────────────────────────────────────────
  listMockServers(workspaceId: string): MockServer[] {
    return [...this.mockServers.values()].filter((s) => s.workspaceId === workspaceId)
  }
  getMockServer(id: string): MockServer | undefined {
    return this.mockServers.get(id)
  }
  saveMockServer(server: MockServer): void {
    this.mockServers.set(server.id, { ...server, updatedAt: Date.now() })
  }
  deleteMockServer(id: string): void {
    this.mockServers.delete(id)
  }

  // ── History ───────────────────────────────────────────────
  addHistory(input: HistoryInput): HistoryEntry {
    const entry: HistoryEntry = { ...input, id: this.nextId('hist'), timestamp: input.timestamp ?? Date.now() }
    this.history.unshift(entry)
    this.history = this.history.slice(0, 200)
    return entry
  }
  listHistory(workspaceId: string): HistoryEntry[] {
    return this.history.filter((h) => h.workspaceId === workspaceId)
  }
  clearHistory(workspaceId: string): void {
    this.history = this.history.filter((h) => h.workspaceId !== workspaceId)
  }

  // ── Test runs ─────────────────────────────────────────────
  saveTestRun(run: TestRun): void {
    this.testRuns.set(run.id, run)
  }
  listTestRuns(workspaceId: string): TestRun[] {
    return [...this.testRuns.values()].filter((r) => r.workspaceId === workspaceId)
  }
  deleteTestRun(id: string): void {
    this.testRuns.delete(id)
  }

  // ── Settings ──────────────────────────────────────────────
  getSettings(workspaceId: string): AppSettings | undefined {
    return this.settings.get(workspaceId)
  }
  saveSettings(workspaceId: string, settings: AppSettings): void {
    this.settings.set(workspaceId, settings)
  }

  // ── Notifications ─────────────────────────────────────────
  listNotifications(workspaceId: string): AppNotification[] {
    return [...this.notifications.values()]
      .filter((n) => n.workspaceId === workspaceId && !n.dismissed)
      .sort((a, b) => b.createdAt - a.createdAt)
  }
  addNotification(input: NotificationDraft): AppNotification {
    const notification: AppNotification = { ...input, id: this.nextId('notif'), createdAt: Date.now() }
    this.notifications.set(notification.id, notification)
    return notification
  }
  updateNotification(id: string, patch: Parameters<StorageProvider['updateNotification']>[1]): AppNotification | undefined {
    const current = this.notifications.get(id)
    if (!current) return undefined
    const updated = { ...current, ...patch }
    this.notifications.set(id, updated)
    return updated
  }
  clearNotifications(workspaceId: string): void {
    for (const n of this.listNotifications(workspaceId)) this.notifications.delete(n.id)
  }
}

export type { AppNotification, AppSettings }