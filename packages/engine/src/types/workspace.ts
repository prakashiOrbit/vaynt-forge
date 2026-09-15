export interface Workspace {
  id: string
  name: string
  description?: string
  isDemo?: boolean
  createdAt: number
  updatedAt: number
}

export interface Collection {
  id: string
  name: string
  workspaceId: string
  description?: string
  createdAt: number
  updatedAt: number
}

export interface Folder {
  id: string
  collectionId: string
  name: string
  parentFolderId?: string
  requestIds: string[]
}

export interface HistoryEntry {
  id: string
  workspaceId: string
  requestId?: string
  requestName: string
  method: string
  url: string
  status: number
  statusText: string
  durationMs: number
  size?: number
  environmentId?: string
  timestamp: number
}

export type RunStatus = 'pass' | 'fail' | 'skip'

export interface TestRunRequestResult {
  requestId: string
  requestName: string
  status: RunStatus
  durationMs: number
  assertionsPassed: number
  assertionsFailed: number
  error?: string
}

export interface TestRun {
  id: string
  name: string
  collectionId?: string
  workspaceId: string
  startedAt: number
  finishedAt?: number
  iterations: number
  passed: number
  failed: number
  skipped: number
  results: TestRunRequestResult[]
}