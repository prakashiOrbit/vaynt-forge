import type { Workspace, Collection, Folder, HistoryEntry, TestRun } from '../types/workspace.js'
import type { RequestModel } from '../types/request.js'
import type { Variable, Environment } from '../types/variables.js'
import type { MockServer } from '../types/mock.js'
import type { AppSettings } from '../types/settings.js'
import type { AppNotification, NotificationPatch } from '../types/notifications.js'
import type { OpenApiSpec } from '../openapi/types.js'
import type { PerformanceRun } from '../types/performance.js'
import type { JarCookie } from '../types/response.js'

export type WorkspaceDraft = Omit<Workspace, 'id' | 'createdAt' | 'updatedAt'>
export type WorkspacePatch = Partial<Omit<Workspace, 'id' | 'createdAt' | 'updatedAt'>>
export type CollectionDraft = Omit<Collection, 'id' | 'createdAt' | 'updatedAt'>
export type CollectionPatch = Partial<Omit<Collection, 'id' | 'createdAt' | 'updatedAt'>>
export type FolderDraft = Omit<Folder, 'id'>
export type FolderPatch = Partial<Omit<Folder, 'id'>>
export type HistoryInput = Omit<HistoryEntry, 'id'>
export type NotificationDraft = Omit<AppNotification, 'id' | 'createdAt'>
export type OpenApiSpecDraft = Omit<OpenApiSpec, 'id' | 'createdAt' | 'updatedAt'>

/**
 * Persistence contract (Sprint 3). Implemented by `InMemoryStorage` (pure TS,
 * used for tests + demo) and `SQLiteStorage` in @vayntforge/sqlite (the Electron
 * main process). The renderer never touches a provider directly — it talks to
 * the main process over the typed `StorageChannel` IPC boundary.
 *
 * Complex payloads (mock endpoints, request assertions, environment variables)
 * are persisted embedded in their parent row as JSON — see the sqlite schema.
 * `deleteWorkspace` cascades to every entity scoped to that workspace.
 */
export interface StorageProvider {
  // ── Workspaces ────────────────────────────────────────────
  listWorkspaces(): Workspace[]
  getWorkspace(id: string): Workspace | undefined
  createWorkspace(input: WorkspaceDraft): Workspace
  updateWorkspace(id: string, patch: WorkspacePatch): Workspace | undefined
  deleteWorkspace(id: string): void

  // ── Collections ───────────────────────────────────────────
  listCollections(workspaceId: string): Collection[]
  getCollection(id: string): Collection | undefined
  createCollection(input: CollectionDraft): Collection
  updateCollection(id: string, patch: CollectionPatch): Collection | undefined
  deleteCollection(id: string): void

  // ── Folders ───────────────────────────────────────────────
  listFolders(collectionId: string): Folder[]
  createFolder(input: FolderDraft): Folder
  updateFolder(id: string, patch: FolderPatch): Folder | undefined
  deleteFolder(id: string): void

  // ── Requests ──────────────────────────────────────────────
  listRequests(workspaceId: string): RequestModel[]
  getRequest(id: string): RequestModel | undefined
  saveRequest(request: RequestModel): void
  deleteRequest(id: string): void

  // ── Environments ──────────────────────────────────────────
  listEnvironments(workspaceId: string): Environment[]
  getEnvironment(id: string): Environment | undefined
  saveEnvironment(environment: Environment): void
  deleteEnvironment(id: string): void

  // ── Global variables ──────────────────────────────────────
  listGlobalVariables(workspaceId: string): Variable[]
  saveGlobalVariable(variable: Variable): void
  deleteGlobalVariable(id: string): void

  // ── Mock servers ──────────────────────────────────────────
  listMockServers(workspaceId: string): MockServer[]
  getMockServer(id: string): MockServer | undefined
  saveMockServer(server: MockServer): void
  deleteMockServer(id: string): void

  // ── OpenAPI specs ─────────────────────────────────────────
  listOpenApiSpecs(workspaceId: string): OpenApiSpec[]
  createOpenApiSpec(input: OpenApiSpecDraft): OpenApiSpec
  deleteOpenApiSpec(id: string): void

  // ── Performance runs ──────────────────────────────────────
  listPerformanceRuns(workspaceId: string): PerformanceRun[]
  getPerformanceRun(id: string): PerformanceRun | undefined
  savePerformanceRun(run: PerformanceRun): void
  deletePerformanceRun(id: string): void

  // ── History ───────────────────────────────────────────────
  addHistory(entry: HistoryInput): HistoryEntry
  listHistory(workspaceId: string): HistoryEntry[]
  deleteHistoryEntry(id: string): void
  clearHistory(workspaceId: string): void

  // ── Test runs ─────────────────────────────────────────────
  saveTestRun(run: TestRun): void
  listTestRuns(workspaceId: string): TestRun[]
  deleteTestRun(id: string): void

  // ── Settings ──────────────────────────────────────────────
  getSettings(workspaceId: string): AppSettings | undefined
  saveSettings(workspaceId: string, settings: AppSettings): void

  // ── Notifications ─────────────────────────────────────────
  listNotifications(workspaceId: string): AppNotification[]
  addNotification(input: NotificationDraft): AppNotification
  updateNotification(id: string, patch: NotificationPatch): AppNotification | undefined
  clearNotifications(workspaceId: string): void

  // ── Cookie jar ────────────────────────────────────────────
  getCookieJar(workspaceId: string): JarCookie[]
  saveCookieJar(workspaceId: string, cookies: JarCookie[]): void
}