export type ConsoleProtocol = 'http' | 'ws' | 'sse' | 'grpc'

/**
 * One entry in the app-wide Console — every real request actually sent (with
 * its real, resolved headers/body — auth applied, `{{variables}}` resolved,
 * cookie jar injected) and the real response that came back, or a real
 * WebSocket/SSE/gRPC frame actually seen on the wire. Aggregated across every
 * open tab for the current session; never persisted to disk.
 */
export interface ConsoleEntry {
  id: string
  timestamp: number
  protocol: ConsoleProtocol
  /** One-line label for the log list, e.g. `"GET /users"` or `"WS → ping"`. */
  summary: string
  method?: string
  url?: string
  requestHeaders?: Record<string, string>
  requestBody?: string
  status?: number
  statusText?: string
  responseHeaders?: Record<string, string>
  responseBody?: string
  timeMs?: number
  error?: string
}
