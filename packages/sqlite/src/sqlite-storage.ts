import { DatabaseSync } from 'node:sqlite'
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
  OpenApiSpecDraft,
} from '../../engine/src/storage/provider'
import type { Workspace, Collection, Folder, HistoryEntry, TestRun } from '../../engine/src/types/workspace'
import type { RequestModel } from '../../engine/src/types/request'
import type { Environment, Variable } from '../../engine/src/types/variables'
import type { MockServer } from '../../engine/src/types/mock'
import type { AppSettings } from '../../engine/src/types/settings'
import type { AppNotification, NotificationPatch } from '../../engine/src/types/notifications'
import type { OpenApiSpec } from '../../engine/src/openapi/types'
import type { PerformanceRun } from '../../engine/src/types/performance'
import { generateId } from '../../engine/src/util/id'

export interface SQLiteStorageOptions {
  /** Absolute path to the `.db` file (the Electron main opens it under userData). */
  path: string
}

type Table =
  | 'workspaces'
  | 'collections'
  | 'folders'
  | 'requests'
  | 'environments'
  | 'variables'
  | 'mock_servers'
  | 'openapi_specs'
  | 'history'
  | 'test_runs'
  | 'settings'
  | 'notifications'
  | 'performance_runs'

interface DataRow {
  data: string
}

const HISTORY_CAP = 200

/**
 * SQLite-backed StorageProvider built on `node:sqlite` (DatabaseSync). Runs in
 * the Electron main process; never imported by the renderer. Complex payloads
 * (request assertions, mock endpoints/log, request/environment variables) are
 * embedded in their parent row as JSON — matching the shape of the engine types.
 *
 * Seeding the demo workspace is the caller's job via `seedProvider`, so it runs
 * through whatever decorators are applied (e.g. the safeStorage secrets codec).
 */
export class SQLiteStorage implements StorageProvider {
  private readonly db: DatabaseSync

  constructor(options: SQLiteStorageOptions) {
    this.db = new DatabaseSync(options.path)
    this.migrate()
  }

  private migrate(): void {
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS workspaces    (id TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS collections   (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS folders       (id TEXT PRIMARY KEY, collection_id TEXT NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS requests      (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS environments  (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS variables     (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, scope TEXT NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS mock_servers (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS openapi_specs (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS history       (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS test_runs     (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS settings      (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS performance_runs (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, data TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS idx_collections_ws   ON collections(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_folders_col      ON folders(collection_id);
      CREATE INDEX IF NOT EXISTS idx_requests_ws      ON requests(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_environments_ws  ON environments(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_variables_ws     ON variables(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_mock_ws          ON mock_servers(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_openapi_ws       ON openapi_specs(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_history_ws       ON history(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_testruns_ws      ON test_runs(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_ws ON notifications(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_perfruns_ws      ON performance_runs(workspace_id);
    `)
  }

  /** Close the underlying handle. Called on app quit (process exit also flushes). */
  close(): void {
    this.db.close()
  }

  // ── Low-level helpers ─────────────────────────────────────
  private all<T>(table: Table): T[]
  private all<T>(table: Table, column: 'workspace_id' | 'collection_id', value: string): T[]
  private all<T>(table: Table, column?: 'workspace_id' | 'collection_id', value?: string): T[] {
    const sql =
      column && value !== undefined
        ? `SELECT data FROM ${table} WHERE ${column} = ?`
        : `SELECT data FROM ${table}`
    const rows =
      column && value !== undefined
        ? (this.db.prepare(sql).all(value) as unknown as DataRow[])
        : (this.db.prepare(sql).all() as unknown as DataRow[])
    return rows.map((r) => JSON.parse(r.data) as T)
  }

  private byId<T>(table: Table, id: string): T | undefined {
    const row = this.db.prepare(`SELECT data FROM ${table} WHERE id = ?`).get(id) as DataRow | undefined
    return row ? (JSON.parse(row.data) as T) : undefined
  }

  private write(
    table: Table,
    id: string,
    data: unknown,
    extra?: { workspaceId?: string; collectionId?: string; scope?: string }
  ): void {
    const cols = ['data']
    const vals: (string | number)[] = [JSON.stringify(data)]
    if (extra?.workspaceId !== undefined) {
      cols.push('workspace_id')
      vals.push(extra.workspaceId)
    }
    if (extra?.collectionId !== undefined) {
      cols.push('collection_id')
      vals.push(extra.collectionId)
    }
    if (extra?.scope !== undefined) {
      cols.push('scope')
      vals.push(extra.scope)
    }
    const colSql = ['id', ...cols].join(', ')
    const placeholders = ['?', ...cols.map(() => '?')].join(', ')
    this.db.prepare(`INSERT INTO ${table} (${colSql}) VALUES (${placeholders})`).run(id, ...vals)
  }

  private update(table: Table, id: string, data: unknown): void {
    this.db.prepare(`UPDATE ${table} SET data = ? WHERE id = ?`).run(JSON.stringify(data), id)
  }

  private remove(table: Table, id: string): void {
    this.db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id)
  }

  private removeWhere(table: Table, column: 'workspace_id' | 'collection_id', value: string): void {
    this.db.prepare(`DELETE FROM ${table} WHERE ${column} = ?`).run(value)
  }

  // ── Workspaces ────────────────────────────────────────────
  listWorkspaces(): Workspace[] {
    return this.all<Workspace>('workspaces').sort((a, b) => b.updatedAt - a.updatedAt)
  }
  getWorkspace(id: string): Workspace | undefined {
    return this.byId<Workspace>('workspaces', id)
  }
  createWorkspace(input: WorkspaceDraft): Workspace {
    const ws: Workspace = {
      ...input,
      id: generateId('ws'),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    this.write('workspaces', ws.id, ws)
    return ws
  }
  updateWorkspace(id: string, patch: WorkspacePatch): Workspace | undefined {
    const current = this.byId<Workspace>('workspaces', id)
    if (!current) return undefined
    const updated: Workspace = { ...current, ...patch, id, createdAt: current.createdAt, updatedAt: Date.now() }
    this.update('workspaces', id, updated)
    return updated
  }
  deleteWorkspace(id: string): void {
    if (!this.getWorkspace(id)) return
    const collections = this.listCollections(id)
    this.db.exec('BEGIN')
    try {
      for (const col of collections) {
        this.removeWhere('folders', 'collection_id', col.id)
        this.remove('collections', col.id)
      }
      for (const t of ['requests', 'environments', 'variables', 'mock_servers', 'openapi_specs', 'history', 'test_runs', 'settings', 'notifications', 'performance_runs'] as Table[]) {
        this.removeWhere(t, 'workspace_id', id)
      }
      this.remove('workspaces', id)
      this.db.exec('COMMIT')
    } catch (err) {
      this.db.exec('ROLLBACK')
      throw err
    }
  }

  // ── Collections ───────────────────────────────────────────
  listCollections(workspaceId: string): Collection[] {
    return this.all<Collection>('collections', 'workspace_id', workspaceId).sort(
      (a, b) => a.createdAt - b.createdAt
    )
  }
  getCollection(id: string): Collection | undefined {
    return this.byId<Collection>('collections', id)
  }
  createCollection(input: CollectionDraft): Collection {
    const col: Collection = {
      ...input,
      id: generateId('col'),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    this.write('collections', col.id, col, { workspaceId: col.workspaceId })
    return col
  }
  updateCollection(id: string, patch: CollectionPatch): Collection | undefined {
    const current = this.byId<Collection>('collections', id)
    if (!current) return undefined
    const updated: Collection = { ...current, ...patch, id, createdAt: current.createdAt, updatedAt: Date.now() }
    this.update('collections', id, updated)
    return updated
  }
  deleteCollection(id: string): void {
    this.removeWhere('folders', 'collection_id', id)
    this.remove('collections', id)
  }

  // ── Folders ───────────────────────────────────────────────
  listFolders(collectionId: string): Folder[] {
    return this.all<Folder>('folders', 'collection_id', collectionId)
  }
  createFolder(input: FolderDraft): Folder {
    const folder: Folder = { ...input, id: generateId('fld'), requestIds: input.requestIds ?? [] }
    this.write('folders', folder.id, folder, { collectionId: folder.collectionId })
    return folder
  }
  updateFolder(id: string, patch: FolderPatch): Folder | undefined {
    const current = this.byId<Folder>('folders', id)
    if (!current) return undefined
    const updated: Folder = { ...current, ...patch, id }
    this.update('folders', id, updated)
    return updated
  }
  deleteFolder(id: string): void {
    this.remove('folders', id)
  }

  // ── Requests ──────────────────────────────────────────────
  listRequests(workspaceId: string): RequestModel[] {
    return this.all<RequestModel>('requests', 'workspace_id', workspaceId).sort(
      (a, b) => b.updatedAt - a.updatedAt
    )
  }
  getRequest(id: string): RequestModel | undefined {
    return this.byId<RequestModel>('requests', id)
  }
  saveRequest(request: RequestModel): void {
    const existing = this.byId<RequestModel>('requests', request.id)
    const updated: RequestModel = {
      ...request,
      workspaceId: request.workspaceId || existing?.workspaceId || '',
      updatedAt: Date.now(),
    }
    if (existing) {
      this.update('requests', request.id, updated)
    } else {
      this.write('requests', request.id, updated, { workspaceId: updated.workspaceId })
    }
  }
  deleteRequest(id: string): void {
    this.remove('requests', id)
  }

  // ── Environments ──────────────────────────────────────────
  listEnvironments(workspaceId: string): Environment[] {
    return this.all<Environment>('environments', 'workspace_id', workspaceId).sort(
      (a, b) => a.createdAt - b.createdAt
    )
  }
  getEnvironment(id: string): Environment | undefined {
    return this.byId<Environment>('environments', id)
  }
  saveEnvironment(environment: Environment): void {
    const existing = this.byId<Environment>('environments', environment.id)
    const updated: Environment = {
      ...environment,
      workspaceId: environment.workspaceId || existing?.workspaceId || '',
      updatedAt: Date.now(),
    }
    if (existing) {
      this.update('environments', environment.id, updated)
    } else {
      this.write('environments', environment.id, updated, { workspaceId: updated.workspaceId })
    }
  }
  deleteEnvironment(id: string): void {
    this.remove('environments', id)
  }

  // ── Global variables ──────────────────────────────────────
  listGlobalVariables(workspaceId: string): Variable[] {
    return this.all<Variable>('variables', 'workspace_id', workspaceId).filter(
      (v) => v.scope === 'global'
    )
  }
  saveGlobalVariable(variable: Variable): void {
    this.saveVariable(variable)
  }
  private saveVariable(variable: Variable): void {
    const existing = this.byId<Variable>('variables', variable.id)
    const scope = variable.scope ?? 'global'
    const workspaceId = variable.workspaceId ?? existing?.workspaceId ?? ''
    if (existing) {
      this.db
        .prepare('UPDATE variables SET data = ?, scope = ?, workspace_id = ? WHERE id = ?')
        .run(JSON.stringify(variable), scope, workspaceId, variable.id)
    } else {
      this.write('variables', variable.id, variable, { workspaceId, scope })
    }
  }
  deleteGlobalVariable(id: string): void {
    this.remove('variables', id)
  }

  // ── Mock servers ──────────────────────────────────────────
  listMockServers(workspaceId: string): MockServer[] {
    return this.all<MockServer>('mock_servers', 'workspace_id', workspaceId).sort(
      (a, b) => b.updatedAt - a.updatedAt
    )
  }
  getMockServer(id: string): MockServer | undefined {
    return this.byId<MockServer>('mock_servers', id)
  }
  saveMockServer(server: MockServer): void {
    const existing = this.byId<MockServer>('mock_servers', server.id)
    const updated: MockServer = {
      ...server,
      workspaceId: server.workspaceId || existing?.workspaceId || '',
      updatedAt: Date.now(),
    }
    if (existing) {
      this.update('mock_servers', server.id, updated)
    } else {
      this.write('mock_servers', server.id, updated, { workspaceId: updated.workspaceId })
    }
  }
  deleteMockServer(id: string): void {
    this.remove('mock_servers', id)
  }

  // ── OpenAPI specs ─────────────────────────────────────────
  listOpenApiSpecs(workspaceId: string): OpenApiSpec[] {
    return this.all<OpenApiSpec>('openapi_specs', 'workspace_id', workspaceId).sort(
      (a, b) => b.updatedAt - a.updatedAt
    )
  }
  createOpenApiSpec(input: OpenApiSpecDraft): OpenApiSpec {
    const now = Date.now()
    const spec: OpenApiSpec = { ...input, id: generateId('spec'), createdAt: now, updatedAt: now }
    this.write('openapi_specs', spec.id, spec, { workspaceId: spec.workspaceId })
    return spec
  }
  deleteOpenApiSpec(id: string): void {
    this.remove('openapi_specs', id)
  }

  // ── Performance runs ──────────────────────────────────────
  listPerformanceRuns(workspaceId: string): PerformanceRun[] {
    return this.all<PerformanceRun>('performance_runs', 'workspace_id', workspaceId).sort(
      (a, b) => b.createdAt - a.createdAt
    )
  }
  getPerformanceRun(id: string): PerformanceRun | undefined {
    return this.byId<PerformanceRun>('performance_runs', id)
  }
  savePerformanceRun(run: PerformanceRun): void {
    const existing = this.byId<PerformanceRun>('performance_runs', run.id)
    const updated: PerformanceRun = {
      ...run,
      workspaceId: run.workspaceId || existing?.workspaceId || '',
      updatedAt: Date.now(),
    }
    if (existing) {
      this.update('performance_runs', run.id, updated)
    } else {
      this.write('performance_runs', run.id, updated, { workspaceId: updated.workspaceId })
    }
  }
  deletePerformanceRun(id: string): void {
    this.remove('performance_runs', id)
  }

  // ── History ───────────────────────────────────────────────
  addHistory(entry: HistoryInput): HistoryEntry {
    const created: HistoryEntry = {
      ...entry,
      id: generateId('hist'),
      workspaceId: entry.workspaceId ?? '',
    }
    this.write('history', created.id, created, { workspaceId: created.workspaceId })

    const over = this.db
      .prepare('SELECT COUNT(*) AS n FROM history WHERE workspace_id = ?')
      .get(created.workspaceId) as { n: number }
    if (over.n > HISTORY_CAP) {
      const keep = this.db
        .prepare('SELECT id FROM history WHERE workspace_id = ? ORDER BY json_extract(data, \'$.timestamp\') DESC LIMIT ?')
        .all(created.workspaceId, HISTORY_CAP) as Array<{ id: string }>
      const keepSet = new Set(keep.map((r) => r.id))
      for (const row of this.db.prepare('SELECT id FROM history WHERE workspace_id = ?').all(created.workspaceId) as Array<{ id: string }>) {
        if (!keepSet.has(row.id)) this.remove('history', row.id)
      }
    }
    return created
  }
  listHistory(workspaceId: string): HistoryEntry[] {
    return this.all<HistoryEntry>('history', 'workspace_id', workspaceId).sort(
      (a, b) => b.timestamp - a.timestamp
    )
  }
  deleteHistoryEntry(id: string): void {
    this.remove('history', id)
  }
  clearHistory(workspaceId: string): void {
    this.removeWhere('history', 'workspace_id', workspaceId)
  }

  // ── Test runs ─────────────────────────────────────────────
  saveTestRun(run: TestRun): void {
    const existing = this.byId<TestRun>('test_runs', run.id)
    if (existing) {
      this.update('test_runs', run.id, run)
    } else {
      this.write('test_runs', run.id, run, { workspaceId: run.workspaceId })
    }
  }
  listTestRuns(workspaceId: string): TestRun[] {
    return this.all<TestRun>('test_runs', 'workspace_id', workspaceId).sort(
      (a, b) => b.startedAt - a.startedAt
    )
  }
  deleteTestRun(id: string): void {
    this.remove('test_runs', id)
  }

  // ── Settings ──────────────────────────────────────────────
  getSettings(workspaceId: string): AppSettings | undefined {
    return this.byId<AppSettings>('settings', workspaceId)
  }
  saveSettings(workspaceId: string, settings: AppSettings): void {
    const existing = this.byId<AppSettings>('settings', workspaceId)
    if (existing) {
      this.update('settings', workspaceId, settings)
    } else {
      this.write('settings', workspaceId, settings, { workspaceId })
    }
  }

  // ── Notifications ─────────────────────────────────────────
  listNotifications(workspaceId: string): AppNotification[] {
    return this.all<AppNotification>('notifications', 'workspace_id', workspaceId)
      .filter((n) => !n.dismissed)
      .sort((a, b) => b.createdAt - a.createdAt)
  }
  addNotification(input: NotificationDraft): AppNotification {
    const notification: AppNotification = {
      ...input,
      id: generateId('notif'),
      createdAt: Date.now(),
    }
    this.write('notifications', notification.id, notification, { workspaceId: notification.workspaceId })
    return notification
  }
  updateNotification(id: string, patch: NotificationPatch): AppNotification | undefined {
    const current = this.byId<AppNotification>('notifications', id)
    if (!current) return undefined
    const updated: AppNotification = { ...current, ...patch }
    this.update('notifications', id, updated)
    return updated
  }
  clearNotifications(workspaceId: string): void {
    this.removeWhere('notifications', 'workspace_id', workspaceId)
  }
}