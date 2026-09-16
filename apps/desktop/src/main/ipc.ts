import { randomUUID } from 'node:crypto'
import { dialog, ipcMain, BrowserWindow } from 'electron'
import {
  collectVariables,
  resolveRequest,
  cookieHeaderForUrl,
  cookiesFromResponse,
  mergeIntoJar,
  type ConsoleEntry,
  type RequestModel,
  type ScriptContext,
} from '@vayntforge/engine'
import { UndiciRequestClient } from '@vayntforge/engine/networking/http-client'
import { fetchClientCredentialsToken } from '@vayntforge/engine/networking/oauth2-client'
import { IPC } from '../shared/ipc'
import type { StorageService } from './storageService'
import type { VariableScopes } from '../shared/types'
import { runScript } from '@vayntforge/engine/scripting/sandbox'
import {
  grpcBidiEnd,
  grpcBidiSend,
  grpcBidiStart,
  grpcClientStream,
  grpcConnectDemo,
  grpcConnectExternal,
  grpcDisconnect,
  grpcServerStream,
  grpcUnary,
} from './grpcServer'
import { startMockServer, stopMockServer } from './mockServerRuntime'
import { startLoadTest, cancelLoadTest } from './loadEngine'
import { checkForUpdates, downloadUpdate, getUpdateStatus, quitAndInstall } from './updater'
import { wsConnect, wsSend, wsPing, wsClose } from './wsServer'
import { sseConnect, sseClose } from './sseServer'
import type {
  GrpcMetadataArg,
  MockServer,
  OAuth2Config,
  PerfTestConfig,
  SsePushEvent,
  WsMessageFormat,
  WsPushEvent,
} from '@vayntforge/engine'

const realClient = new UndiciRequestClient()

const emitTo = (event: Electron.IpcMainInvokeEvent) => (channelId: string, frame: object) => {
  event.sender.send(IPC.GRPC_FRAME, channelId, { ...frame, channelId, timestamp: Date.now() })
}

const emitWs = (event: Electron.IpcMainInvokeEvent) => (channelId: string, evt: WsPushEvent) => {
  event.sender.send(IPC.WS_EVENT, channelId, evt)
}

const emitSse = (event: Electron.IpcMainInvokeEvent) => (channelId: string, evt: SsePushEvent) => {
  event.sender.send(IPC.SSE_EVENT, channelId, evt)
}

/**
 * Exactly the `StorageChannel` interface in `shared/types.ts` — the only
 * `StorageService` methods the renderer is allowed to reach through the
 * generic `storage:call` dispatcher. `StorageChannel` was previously a
 * type-only contract (erased at runtime), so the old handler actually
 * accepted ANY method name that resolved to a function on the service,
 * including `encrypt`/`decrypt` (would let a compromised renderer decrypt
 * arbitrary ciphertext or mint fake "encrypted" secrets), `close()`, and
 * internal main-process-only getters. This allowlist makes that contract a
 * real runtime boundary, not just a compile-time one.
 */
const STORAGE_METHODS = new Set([
  'listWorkspaces',
  'createWorkspace',
  'renameWorkspace',
  'deleteWorkspace',
  'snapshot',
  'createCollection',
  'updateCollection',
  'deleteCollection',
  'createFolder',
  'updateFolder',
  'deleteFolder',
  'saveRequest',
  'deleteRequest',
  'saveEnvironment',
  'deleteEnvironment',
  'saveGlobalVariable',
  'deleteGlobalVariable',
  'saveMockServer',
  'deleteMockServer',
  'createOpenApiSpec',
  'deleteOpenApiSpec',
  'savePerformanceRun',
  'deletePerformanceRun',
  'addHistory',
  'deleteHistoryEntry',
  'clearHistory',
  'saveTestRun',
  'deleteTestRun',
  'saveSettings',
  'addNotification',
  'updateNotification',
  'clearNotifications',
  'saveCookieJar',
  'clearCookieJar',
  'secretsSupported',
])

export function registerIpcHandlers(storage: StorageService): void {
  ipcMain.handle(IPC.PING, () => `pong @ ${new Date().toISOString()}`)

  ipcMain.handle(IPC.STORAGE_CALL, async (_event, method: string, ...args: unknown[]) => {
    if (typeof method !== 'string' || !STORAGE_METHODS.has(method)) {
      throw new Error(`Unknown storage method: ${method}`)
    }
    const fn = (storage as unknown as Record<string, unknown>)[method]
    if (typeof fn !== 'function') throw new Error(`Unknown storage method: ${method}`)
    return (fn as (...a: unknown[]) => unknown).apply(storage, args)
  })

  ipcMain.handle(IPC.DIALOG_OPEN_FILE, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = win
      ? await dialog.showOpenDialog(win, { properties: ['openFile'] })
      : await dialog.showOpenDialog({ properties: ['openFile'] })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle(IPC.DIALOG_OPEN_PROTO_FILE, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const opts = { properties: ['openFile' as const], filters: [{ name: 'Protocol Buffers', extensions: ['proto'] }] }
    const result = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle(IPC.DIALOG_OPEN_CERT_FILE, async (event, kind: 'cert' | 'key' | 'pfx') => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const filters =
      kind === 'cert'
        ? [{ name: 'Certificates', extensions: ['crt', 'pem', 'cer'] }]
        : kind === 'key'
          ? [{ name: 'Private Keys', extensions: ['key', 'pem'] }]
          : [{ name: 'PKCS#12', extensions: ['pfx', 'p12'] }]
    const opts = { properties: ['openFile' as const], filters }
    const result = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  // Real network execution — this is what the renderer's Send button calls
  // (see sendRequest.ts). Genuine undici HTTP, not a simulation.
  //
  // Cookie jar: transparent, like a browser's or Postman's. Before sending,
  // inject whatever cookies the workspace's jar has for this request's
  // resolved URL (unless the request already sets its own Cookie header —
  // an explicit header always wins). After a real response comes back, fold
  // any Set-Cookie headers it carried into the jar and persist it. Both
  // steps are skipped entirely when the request already has an explicit
  // Cookie header, and skipped/no-op when the response sets no cookies.
  ipcMain.handle(IPC.NETWORK_EXECUTE, async (event, request: RequestModel, scopes: VariableScopes) => {
    const workspaceSettings = storage.getSettingsSync(request.workspaceId)
    const ctx = {
      variables: collectVariables(scopes),
      proxy: workspaceSettings.proxy,
      caCertificates: workspaceSettings.certificates.map((c) => c.pem),
      clientCertificates: workspaceSettings.clientCertificates,
    }
    const hasExplicitCookieHeader = request.headers.some((h) => h.enabled && h.key.toLowerCase() === 'cookie')

    let requestToSend = request
    let resolvedUrl: string | undefined
    try {
      resolvedUrl = resolveRequest(request, ctx.variables).url
    } catch {
      resolvedUrl = undefined // an unresolvable URL just falls through to realClient's own error handling
    }

    if (!hasExplicitCookieHeader && resolvedUrl) {
      const jarHeader = cookieHeaderForUrl(storage.getCookieJar(request.workspaceId), resolvedUrl, Date.now())
      if (jarHeader) {
        requestToSend = {
          ...request,
          headers: [...request.headers, { id: '__cookie_jar__', key: 'Cookie', value: jarHeader, enabled: true }],
        }
      }
    }

    const response = await realClient.execute(requestToSend, ctx)

    if (resolvedUrl && response.cookies.length > 0) {
      const now = Date.now()
      const incoming = cookiesFromResponse(response.cookies, resolvedUrl, now)
      if (incoming.length > 0) {
        const merged = mergeIntoJar(storage.getCookieJar(request.workspaceId), incoming, now)
        await storage.saveCookieJar(request.workspaceId, merged)
      }
    }

    // The Console shows the real, final wire request — recompute against
    // `requestToSend` (not the original `request`) so a jar-injected Cookie
    // header shows up here too, not just the auth/variable resolution the
    // first `resolveRequest` call above already reflects.
    let resolvedForLog: ReturnType<typeof resolveRequest> | undefined
    try {
      resolvedForLog = resolveRequest(requestToSend, ctx.variables)
    } catch {
      resolvedForLog = undefined
    }
    const consoleEntry: ConsoleEntry = {
      id: `console_${randomUUID()}`,
      timestamp: Date.now(),
      protocol: 'http',
      summary: `${requestToSend.method} ${resolvedForLog?.url ?? resolvedUrl ?? requestToSend.url}`,
      method: requestToSend.method,
      url: resolvedForLog?.url ?? resolvedUrl ?? requestToSend.url,
      requestHeaders: resolvedForLog?.headers,
      requestBody: resolvedForLog?.body,
      status: response.status,
      statusText: response.statusText,
      responseHeaders: response.headers,
      responseBody: response.bodyText,
      timeMs: response.timeMs,
      error: response.error?.message,
    }
    event.sender.send(IPC.CONSOLE_ENTRY, consoleEntry)

    return response
  })

  // Real RFC 6749 client-credentials grant — a genuine POST to the
  // configured Token URL, not a simulated token. See oauth2-client.ts.
  ipcMain.handle(IPC.OAUTH2_FETCH_TOKEN, async (_event, config: OAuth2Config) => {
    return fetchClientCredentialsToken(config)
  })

  ipcMain.handle(IPC.SCRIPTS_RUN, async (_event, code: string, context: ScriptContext) => {
    return runScript(code, context)
  })

  // Sprint 9 — the in-app gRPC demo server. Server-stream/bidi frames are
  // pushed back to the initiating window over IPC.GRPC_FRAME.
  ipcMain.handle(IPC.GRPC_START, async (_event, channelId: string) => {
    return grpcConnectDemo(channelId)
  })

  // Sprint 15 — a real external `host:port` gRPC target, discovered via
  // server reflection or a user-supplied `.proto` file.
  ipcMain.handle(
    IPC.GRPC_CONNECT_EXTERNAL,
    async (_event, channelId: string, address: string, tls: boolean, protoPath?: string) => {
      return grpcConnectExternal(channelId, address, tls, protoPath)
    }
  )

  ipcMain.handle(IPC.GRPC_DISCONNECT, async (_event, channelId: string) => {
    grpcDisconnect(channelId)
  })

  ipcMain.handle(
    IPC.GRPC_UNARY,
    async (event, channelId: string, method: string, message: unknown, metadata?: GrpcMetadataArg[]) =>
      grpcUnary(channelId, method, message, metadata, emitTo(event))
  )

  ipcMain.handle(IPC.GRPC_SERVER_STREAM, async (event, channelId: string, method: string, message: unknown, metadata?: GrpcMetadataArg[]) => {
    grpcServerStream(channelId, method, message, metadata, emitTo(event)).catch((err) =>
      emitTo(event)(channelId, { kind: 'error', method, message: { message: err?.message ?? String(err) } })
    )
  })

  ipcMain.handle(
    IPC.GRPC_CLIENT_STREAM,
    async (event, channelId: string, method: string, messages: unknown[], metadata?: GrpcMetadataArg[]) =>
      grpcClientStream(channelId, method, messages, metadata, emitTo(event))
  )

  ipcMain.handle(IPC.GRPC_BIDI_START, async (event, channelId: string, method: string) => {
    const emit = emitTo(event)
    grpcBidiStart(channelId, method, (frame) => emit(channelId, frame)).catch((err) =>
      emit(channelId, { kind: 'error', method, message: { message: err?.message ?? String(err) } })
    )
  })

  ipcMain.handle(IPC.GRPC_BIDI_SEND, async (event, channelId: string, message: unknown) => {
    grpcBidiSend(channelId, message, (frame) => emitTo(event)(channelId, frame)).catch((err) =>
      emitTo(event)(channelId, { kind: 'error', method: 'Chat', message: { message: err?.message ?? String(err) } })
    )
  })

  ipcMain.handle(IPC.GRPC_BIDI_END, async (event, channelId: string) => {
    grpcBidiEnd(channelId, (frame) => emitTo(event)(channelId, frame)).catch(() => undefined)
  })

  // Real WebSocket connections — genuine `ws` handshakes/frames/ping-pong,
  // one socket per renderer tab (channelId), pushed back over IPC.WS_EVENT.
  ipcMain.handle(IPC.WS_CONNECT, async (event, channelId: string, url: string) => {
    wsConnect(channelId, url, emitWs(event))
  })

  ipcMain.handle(IPC.WS_SEND, async (event, channelId: string, text: string, format: WsMessageFormat) => {
    wsSend(channelId, text, format, emitWs(event))
  })

  ipcMain.handle(IPC.WS_PING, async (event, channelId: string) => {
    wsPing(channelId, emitWs(event))
  })

  ipcMain.handle(IPC.WS_CLOSE, async (event, channelId: string) => {
    wsClose(channelId, emitWs(event))
  })

  // Real Server-Sent Events — a genuine streamed `undici` GET parsed as
  // text/event-stream, one stream per renderer tab, pushed over IPC.SSE_EVENT.
  ipcMain.handle(IPC.SSE_CONNECT, async (event, channelId: string, url: string) => {
    sseConnect(channelId, url, emitSse(event)).catch((err) =>
      emitSse(event)(channelId, { kind: 'log', line: `Error: ${err instanceof Error ? err.message : String(err)}` })
    )
  })

  ipcMain.handle(IPC.SSE_CLOSE, async (event, channelId: string) => {
    sseClose(channelId, emitSse(event))
  })

  // Sprint 10 — the in-app mock server engine (real node:http per MockServer row).
  ipcMain.handle(IPC.MOCK_START, async (event, server: MockServer) => {
    await startMockServer(
      server,
      (entry) => event.sender.send(IPC.MOCK_LOG, server.id, entry),
      () => storage.getMockServerSync(server.id) ?? server
    )
  })

  ipcMain.handle(IPC.MOCK_STOP, async (_event, id: string) => {
    await stopMockServer(id)
  })

  // Sprint 11 — the load engine (real undici.Pool concurrency per run).
  ipcMain.handle(
    IPC.PERF_START,
    async (event, runId: string, request: RequestModel, scopes: VariableScopes, config: PerfTestConfig) => {
      startLoadTest(
        runId,
        request,
        scopes,
        config,
        (batch) => event.sender.send(IPC.PERF_PROGRESS, runId, batch),
        (samples, durationMs) => event.sender.send(IPC.PERF_DONE, runId, samples, durationMs)
      )
    }
  )

  ipcMain.handle(IPC.PERF_CANCEL, async (_event, runId: string) => {
    cancelLoadTest(runId)
  })

  ipcMain.handle(IPC.UPDATE_CHECK, async () => {
    await checkForUpdates()
  })
  ipcMain.handle(IPC.UPDATE_DOWNLOAD, async () => {
    await downloadUpdate()
  })
  ipcMain.handle(IPC.UPDATE_INSTALL, async () => {
    quitAndInstall()
  })
  ipcMain.handle(IPC.UPDATE_GET_STATUS, async () => getUpdateStatus())
}