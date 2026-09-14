import type { Workspace, Collection, HistoryEntry, TestRun } from '../types/workspace'
import type { RequestModel } from '../types/request'
import type { Environment } from '../types/variables'
import type { MockServer } from '../types/mock'

/**
 * Persistence contract. In Sprint 0 this is backed by an in-memory map seeded
 * with the "Acme API" demo workspace; Sprint 3 replaces the implementation with
 * SQLite in the Electron main process. The renderer never touches storage directly.
 */
export interface StorageProvider {
  listWorkspaces(): Workspace[]
  getWorkspace(id: string): Workspace | undefined
  createWorkspace(input: Omit<Workspace, 'id' | 'createdAt' | 'updatedAt'>): Workspace
  deleteWorkspace(id: string): void

  listCollections(workspaceId: string): Collection[]
  createCollection(input: Omit<Collection, 'id' | 'createdAt' | 'updatedAt'>): Collection
  deleteCollection(id: string): void

  listRequests(workspaceId: string): RequestModel[]
  saveRequest(request: RequestModel): void
  getRequest(id: string): RequestModel | undefined
  deleteRequest(id: string): void

  listEnvironments(workspaceId: string): Environment[]
  saveEnvironment(environment: Environment): void

  listMockServers(workspaceId: string): MockServer[]
  saveMockServer(server: MockServer): void

  addHistory(entry: Omit<HistoryEntry, 'id' | 'timestamp'>): HistoryEntry
  listHistory(workspaceId: string): HistoryEntry[]
  clearHistory(workspaceId: string): void

  saveTestRun(run: TestRun): void
  listTestRuns(workspaceId: string): TestRun[]
}