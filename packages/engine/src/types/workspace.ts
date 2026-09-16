import type { AuthConfig, RequestScripts } from './request'
import type { Variable } from './variables'

export interface Workspace {
  id: string
  name: string
  description?: string
  isDemo?: boolean
  createdAt: number
  updatedAt: number
}

/** A Collection Runner chain step: extract a value from this request's response into a variable. */
export interface ChainRule {
  id: string
  requestId: string
  /** Path into the response body, e.g. `$.token` or `$.users[0].id`. */
  jsonPath: string
  variableName: string
  enabled: boolean
}

export interface Collection {
  id: string
  name: string
  workspaceId: string
  description?: string
  /** Optional — collections created before Sprint 7 have none; treat as `[]`. */
  chainRules?: ChainRule[]
  /** A request whose own auth is `{type:'inherit'}` falls back to this when no folder in its chain sets one. Never itself `'inherit'` — a collection has no parent to inherit from. */
  auth?: AuthConfig
  /** Resolved into the `collection` variable scope (between `global` and `environment`) for every request in this collection. */
  variables?: Variable[]
  /** Run before/after every request in this collection, ahead of any folder's and the request's own — see `resolveAncestorScripts`. */
  scripts?: RequestScripts
  /** Manual drag-reorder position among sibling collections in the same workspace — lower sorts first. Unset (never reordered) sorts after every explicitly-ordered collection, by `createdAt`. */
  order?: number
  createdAt: number
  updatedAt: number
}

export interface Folder {
  id: string
  collectionId: string
  name: string
  parentFolderId?: string
  requestIds: string[]
  /** Falls back to a parent folder's, then the collection's, when this is unset or itself `{type:'inherit'}`. */
  auth?: AuthConfig
  /** Run before/after every request in this folder, between the collection's and the request's own. */
  scripts?: RequestScripts
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