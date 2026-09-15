import * as http from 'node:http'
import { matchMockEndpoint } from '@vayntforge/engine'
import type { MockEndpoint, MockLogEntry, MockServer } from '@vayntforge/engine'

/**
 * Sprint 10 — the in-app mock server engine: a real `node:http` server per
 * `MockServer` row (no framework — same "raw platform API" choice Sprint 9
 * made for gRPC). Each request is matched against the server's configured
 * endpoints via `matchMockEndpoint`, delayed by `delayMs`, and — per
 * `errorRate` — occasionally answered with a generic 500 instead of the
 * designed response, to simulate a flaky upstream.
 */

type EmitLog = (entry: MockLogEntry) => void

const servers = new Map<string, http.Server>()

const readBody = (req: http.IncomingMessage): Promise<void> =>
  new Promise((resolve) => {
    req.on('data', () => undefined)
    req.on('end', resolve)
  })

function handleRequest(getServer: () => MockServer, emit: EmitLog) {
  return async (req: http.IncomingMessage, res: http.ServerResponse) => {
    const started = Date.now()
    await readBody(req)
    const server = getServer()
    const method = req.method ?? 'GET'
    const path = req.url ?? '/'
    const endpoint = matchMockEndpoint(server.endpoints, method, path)

    const respond = (status: number, headers: Record<string, string>, body: string) => {
      res.writeHead(status, headers)
      res.end(body)
      emit({
        id: `log_${Math.random().toString(36).slice(2, 10)}`,
        timestamp: started,
        method,
        path,
        status,
        durationMs: Date.now() - started,
      })
    }

    const send = (ep: MockEndpoint) => {
      const simulateError = ep.errorRate > 0 && Math.random() < ep.errorRate
      if (simulateError) {
        respond(500, { 'content-type': 'application/json' }, JSON.stringify({ error: 'Simulated upstream failure' }))
        return
      }
      respond(ep.status, ep.headers, ep.body)
    }

    const delay = endpoint?.delayMs ?? server.latencyMs
    if (!endpoint) {
      setTimeout(() => respond(404, { 'content-type': 'application/json' }, JSON.stringify({ error: 'No mock endpoint matches this request' })), delay)
      return
    }
    setTimeout(() => send(endpoint), delay)
  }
}

/** Starts (or restarts, if already running) the given mock server. */
export async function startMockServer(server: MockServer, emit: EmitLog, getLatest: () => MockServer): Promise<void> {
  await stopMockServer(server.id)
  const srv = http.createServer((req, res) => {
    void handleRequest(getLatest, emit)(req, res)
  })
  await new Promise<void>((resolve, reject) => {
    srv.once('error', (err: NodeJS.ErrnoException) => {
      servers.delete(server.id)
      reject(err.code === 'EADDRINUSE' ? new Error(`Port ${server.port} is already in use`) : err)
    })
    srv.listen(server.port, '127.0.0.1', () => {
      servers.set(server.id, srv)
      resolve()
    })
  })
}

export async function stopMockServer(id: string): Promise<void> {
  const srv = servers.get(id)
  if (!srv) return
  servers.delete(id)
  await new Promise<void>((resolve) => srv.close(() => resolve()))
}

export function isMockServerRunning(id: string): boolean {
  return servers.has(id)
}

/** Ids of every mock server this process actually has bound right now —
 * used on quit to correct the persisted `status` before the OS sockets die. */
export function getRunningServerIds(): string[] {
  return [...servers.keys()]
}

export async function stopAllMockServers(): Promise<void> {
  await Promise.all([...servers.keys()].map((id) => stopMockServer(id)))
}
