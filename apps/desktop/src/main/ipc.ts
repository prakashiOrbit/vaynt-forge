import { dialog, ipcMain, BrowserWindow } from 'electron'
import { collectVariables, type RequestModel, type ScriptContext } from '@vayntforge/engine'
import { UndiciRequestClient } from '@vayntforge/engine/networking/http-client'
import { IPC } from '../shared/ipc'
import type { StorageService } from './storageService'
import type { VariableScopes } from '../shared/types'
import { runScript } from './scriptSandbox'
import {
  ensureGrpcServer,
  grpcBidiEnd,
  grpcBidiSend,
  grpcBidiStart,
  grpcClientStream,
  grpcServerStream,
  grpcUnary,
} from './grpcServer'
import { startMockServer, stopMockServer } from './mockServerRuntime'
import { startLoadTest, cancelLoadTest } from './loadEngine'
import { checkForUpdates, downloadUpdate, getUpdateStatus, quitAndInstall } from './updater'
import type { GrpcMetadataArg, MockServer, PerfTestConfig } from '@vayntforge/engine'

const realClient = new UndiciRequestClient()

const emitTo = (event: Electron.IpcMainInvokeEvent) => (channelId: string, frame: object) => {
  event.sender.send(IPC.GRPC_FRAME, channelId, { ...frame, channelId, timestamp: Date.now() })
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

  // Real network execution — this is what the renderer's Send button calls
  // (see sendRequest.ts). Genuine undici HTTP, not a simulation.
  ipcMain.handle(IPC.NETWORK_EXECUTE, async (_event, request: RequestModel, scopes: VariableScopes) => {
    return realClient.execute(request, { variables: collectVariables(scopes) })
  })

  ipcMain.handle(IPC.SCRIPTS_RUN, async (_event, code: string, context: ScriptContext) => {
    return runScript(code, context)
  })

  // Sprint 9 — the in-app gRPC demo server. Server-stream/bidi frames are
  // pushed back to the initiating window over IPC.GRPC_FRAME.
  ipcMain.handle(IPC.GRPC_START, async (event) => {
    const emit = emitTo(event)
    const address = await ensureGrpcServer()
    emit('server', { kind: 'ready', method: 'server', message: { address } })
    return address
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