import type { StorageProvider } from './provider'
import type { Workspace, Collection, HistoryEntry, TestRun } from '../types/workspace'
import type { RequestModel } from '../types/request'
import type { Environment } from '../types/variables'
import type { MockServer } from '../types/mock'
import { DEMO_WORKSPACE, DEMO_COLLECTIONS, DEMO_REQUESTS, DEMO_ENVIRONMENTS, DEMO_MOCK } from './seed'

/**
 * Sprint 0 in-memory storage, seeded with the "Acme API" demo workspace.
 * Sprint 3 swaps this for a SQLite-backed implementation behind the same contract.
 */
export class InMemoryStorage implements StorageProvider {
  private workspaces = new Map<string, Workspace>()
  private collections = new Map<string, Collection>()
  private requests = new Map<string, RequestModel>()
  private environments = new Map<string, Environment>()
  private mockServers = new Map<string, MockServer>()
  private history: HistoryEntry[] = []
  private testRuns = new Map<string, TestRun>()
  private seq = 0

  private nextId(prefix: string): string {
    this.seq += 1
    return `${prefix}_${this.seq}`
  }

  constructor() {
    this.seedDemo()
  }

  // ── Workspaces ────────────────────────────────────────────
  listWorkspaces(): Workspace[] {
    return [...this.workspaces.values()]
  }
  getWorkspace(id: string): Workspace | undefined {
    return this.workspaces.get(id)
  }
  createWorkspace(input: Omit<Workspace, 'id' | 'createdAt' | 'updatedAt'>): Workspace {
    const now = Date.now()
    const ws = { ...input, id: this.nextId('ws'), createdAt: now, updatedAt: now }
    this.workspaces.set(ws.id, ws)
    return ws
  }
  deleteWorkspace(id: string): void {
    this.workspaces.delete(id)
  }

  // ── Collections ───────────────────────────────────────────
  listCollections(workspaceId: string): Collection[] {
    return [...this.collections.values()].filter((c) => c.workspaceId === workspaceId)
  }
  createCollection(input: Omit<Collection, 'id' | 'createdAt' | 'updatedAt'>): Collection {
    const now = Date.now()
    const c = { ...input, id: this.nextId('col'), createdAt: now, updatedAt: now }
    this.collections.set(c.id, c)
    return c
  }
  deleteCollection(id: string): void {
    this.collections.delete(id)
  }

  // ── Requests ──────────────────────────────────────────────
  listRequests(workspaceId: string): RequestModel[] {
    return [...this.requests.values()].filter((r) => r.workspaceId === workspaceId)
  }
  saveRequest(request: RequestModel): void {
    this.requests.set(request.id, { ...request, updatedAt: Date.now() })
  }
  getRequest(id: string): RequestModel | undefined {
    return this.requests.get(id)
  }
  deleteRequest(id: string): void {
    this.requests.delete(id)
  }

  // ── Environments ──────────────────────────────────────────
  listEnvironments(workspaceId: string): Environment[] {
    return [...this.environments.values()].filter((e) => e.workspaceId === workspaceId)
  }
  saveEnvironment(environment: Environment): void {
    this.environments.set(environment.id, {
      ...environment,
      updatedAt: Date.now(),
    })
  }

  // ── Mock servers ──────────────────────────────────────────
  listMockServers(workspaceId: string): MockServer[] {
    return [...this.mockServers.values()].filter((s) => s.workspaceId === workspaceId)
  }
  saveMockServer(server: MockServer): void {
    this.mockServers.set(server.id, { ...server, updatedAt: Date.now() })
  }

  // ── History ───────────────────────────────────────────────
  addHistory(input: Omit<HistoryEntry, 'id' | 'timestamp'>): HistoryEntry {
    const entry: HistoryEntry = { ...input, id: this.nextId('hist'), timestamp: Date.now() }
    this.history.unshift(entry)
    this.history = this.history.slice(0, 200)
    return entry
  }
  listHistory(_workspaceId: string): HistoryEntry[] {
    return this.history
  }
  clearHistory(_workspaceId: string): void {
    this.history = []
  }

  // ── Test runs ─────────────────────────────────────────────
  saveTestRun(run: TestRun): void {
    this.testRuns.set(run.id, run)
  }
  listTestRuns(workspaceId: string): TestRun[] {
    return [...this.testRuns.values()].filter((r) => r.workspaceId === workspaceId)
  }

  // ── Seed ──────────────────────────────────────────────────
  private seedDemo(): void {
    const ws = this.createWorkspace(DEMO_WORKSPACE)
    for (const col of DEMO_COLLECTIONS) {
      const created = this.createCollection(col)
      for (const req of DEMO_REQUESTS.filter((r) => r.collectionName === created.name)) {
        this.requests.set(req.id, { ...req, workspaceId: ws.id, collectionId: created.id })
      }
    }
    for (const env of DEMO_ENVIRONMENTS) {
      this.environments.set(env.id, { ...env, workspaceId: ws.id })
    }
    this.mockServers.set(DEMO_MOCK.id, { ...DEMO_MOCK, workspaceId: ws.id })

    const now = Date.now()
    const seedHistory: Omit<HistoryEntry, 'id' | 'timestamp'>[] = [
      { requestId: 'req_get_users', requestName: 'Get User', method: 'GET', url: 'https://api.acme.dev/v1/users?page=1&limit=20', status: 200, statusText: 'OK', durationMs: 124, size: 224, environmentId: 'env_dev' },
      { requestId: 'req_login', requestName: 'Login', method: 'POST', url: 'https://api.acme.dev/v1/auth/login', status: 200, statusText: 'OK', durationMs: 238, size: 512, environmentId: 'env_dev' },
      { requestId: 'req_get_user', requestName: 'Get User Detail', method: 'GET', url: 'https://api.acme.dev/v1/users/usr_1024', status: 200, statusText: 'OK', durationMs: 81, size: 180, environmentId: 'env_dev' },
      { requestId: 'req_create_order', requestName: 'Create Order', method: 'POST', url: 'https://api.acme.dev/v1/orders', status: 500, statusText: 'Internal Server Error', durationMs: 923, size: 92, environmentId: 'env_dev' },
      { requestId: 'req_get_order', requestName: 'Get Order', method: 'GET', url: 'https://api.acme.dev/v1/orders/ord_901', status: 200, statusText: 'OK', durationMs: 156, size: 340, environmentId: 'env_dev' },
    ]
    this.history = seedHistory.map((h, i) => ({ ...h, id: `hist_seed_${i}`, timestamp: now - (i + 1) * 4 * 60_000 }))
  }
}

export { DEMO_WORKSPACE }
export type { StorageProvider }