export type MockServerStatus = 'stopped' | 'running'

export interface MockEndpoint {
  id: string
  method: string
  path: string
  status: number
  headers: Record<string, string>
  body: string
  /** Simulated latency in ms. */
  delayMs: number
  /** E.g. 0.05 = 5% of requests return the error status. */
  errorRate: number
}

export interface MockLogEntry {
  id: string
  timestamp: number
  method: string
  path: string
  status: number
  durationMs: number
}

export interface MockServer {
  id: string
  name: string
  workspaceId: string
  port: number
  status: MockServerStatus
  latencyMs: number
  endpoints: MockEndpoint[]
  log: MockLogEntry[]
  createdAt: number
  updatedAt: number
}