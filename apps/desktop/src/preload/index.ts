import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc'
import type { VayntForgeApi, UpdateStatus } from '../shared/types'

const storage = {
  call: (method: string, ...args: unknown[]) => ipcRenderer.invoke(IPC.STORAGE_CALL, method, ...args),
} as VayntForgeApi['storage']

const api: VayntForgeApi = {
  app: {
    ping: () => ipcRenderer.invoke(IPC.PING) as Promise<string>,
    version: process.env['npm_package_version'] ?? '0.0.0',
  },
  storage,
  dialog: {
    openFile: () => ipcRenderer.invoke(IPC.DIALOG_OPEN_FILE) as Promise<string | null>,
    openProtoFile: () => ipcRenderer.invoke(IPC.DIALOG_OPEN_PROTO_FILE) as Promise<string | null>,
    openCertFile: (kind) => ipcRenderer.invoke(IPC.DIALOG_OPEN_CERT_FILE, kind) as Promise<string | null>,
  },
  network: {
    execute: (request, scopes) => ipcRenderer.invoke(IPC.NETWORK_EXECUTE, request, scopes),
    fetchOAuth2Token: (config) => ipcRenderer.invoke(IPC.OAUTH2_FETCH_TOKEN, config),
  },
  scripts: {
    run: (code, context) => ipcRenderer.invoke(IPC.SCRIPTS_RUN, code, context),
  },
  realtime: {
    grpc: {
      start: (channelId) =>
        ipcRenderer.invoke(IPC.GRPC_START, channelId) as Promise<{
          address: string
          services: GrpcService[]
          protoSource?: string
        }>,
      connectExternal: (channelId, address, tls, protoPath) =>
        ipcRenderer.invoke(IPC.GRPC_CONNECT_EXTERNAL, channelId, address, tls, protoPath) as Promise<{
          services: GrpcService[]
          protoSource?: string
        }>,
      disconnect: (channelId) => ipcRenderer.invoke(IPC.GRPC_DISCONNECT, channelId) as Promise<void>,
      unary: (channelId, method, message, metadata) =>
        ipcRenderer.invoke(IPC.GRPC_UNARY, channelId, method, message, metadata) as Promise<GrpcUnaryResult>,
      serverStream: (channelId, method, message, metadata) =>
        ipcRenderer.invoke(IPC.GRPC_SERVER_STREAM, channelId, method, message, metadata) as Promise<void>,
      clientStream: (channelId, method, messages, metadata) =>
        ipcRenderer.invoke(IPC.GRPC_CLIENT_STREAM, channelId, method, messages, metadata) as Promise<GrpcStreamResult>,
      bidiStart: (channelId, method) => ipcRenderer.invoke(IPC.GRPC_BIDI_START, channelId, method) as Promise<void>,
      bidiSend: (channelId, message) => ipcRenderer.invoke(IPC.GRPC_BIDI_SEND, channelId, message) as Promise<void>,
      bidiEnd: (channelId) => ipcRenderer.invoke(IPC.GRPC_BIDI_END, channelId) as Promise<void>,
      onFrame: (callback) => {
        const listener = (_e: unknown, channelId: string, frame: unknown) => callback(channelId, frame as GrpcFrame)
        ipcRenderer.on(IPC.GRPC_FRAME, listener)
        return () => ipcRenderer.removeListener(IPC.GRPC_FRAME, listener)
      },
    },
    ws: {
      connect: (channelId, url) => ipcRenderer.invoke(IPC.WS_CONNECT, channelId, url) as Promise<void>,
      send: (channelId, text, format) => ipcRenderer.invoke(IPC.WS_SEND, channelId, text, format) as Promise<void>,
      ping: (channelId) => ipcRenderer.invoke(IPC.WS_PING, channelId) as Promise<void>,
      close: (channelId) => ipcRenderer.invoke(IPC.WS_CLOSE, channelId) as Promise<void>,
      onEvent: (callback) => {
        const listener = (_e: unknown, channelId: string, event: unknown) => callback(channelId, event as WsPushEvent)
        ipcRenderer.on(IPC.WS_EVENT, listener)
        return () => ipcRenderer.removeListener(IPC.WS_EVENT, listener)
      },
    },
    sse: {
      connect: (channelId, url) => ipcRenderer.invoke(IPC.SSE_CONNECT, channelId, url) as Promise<void>,
      close: (channelId) => ipcRenderer.invoke(IPC.SSE_CLOSE, channelId) as Promise<void>,
      onEvent: (callback) => {
        const listener = (_e: unknown, channelId: string, event: unknown) => callback(channelId, event as SsePushEvent)
        ipcRenderer.on(IPC.SSE_EVENT, listener)
        return () => ipcRenderer.removeListener(IPC.SSE_EVENT, listener)
      },
    },
  },
  console: {
    onEntry: (callback) => {
      const listener = (_e: unknown, entry: unknown) => callback(entry as ConsoleEntry)
      ipcRenderer.on(IPC.CONSOLE_ENTRY, listener)
      return () => ipcRenderer.removeListener(IPC.CONSOLE_ENTRY, listener)
    },
  },
  mock: {
    start: (server) => ipcRenderer.invoke(IPC.MOCK_START, server) as Promise<void>,
    stop: (id) => ipcRenderer.invoke(IPC.MOCK_STOP, id) as Promise<void>,
    onLog: (callback) => {
      const listener = (_e: unknown, serverId: string, entry: unknown) => callback(serverId, entry as MockLogEntry)
      ipcRenderer.on(IPC.MOCK_LOG, listener)
      return () => ipcRenderer.removeListener(IPC.MOCK_LOG, listener)
    },
  },
  performance: {
    start: (runId, request, scopes, config) =>
      ipcRenderer.invoke(IPC.PERF_START, runId, request, scopes, config) as Promise<void>,
    cancel: (runId) => ipcRenderer.invoke(IPC.PERF_CANCEL, runId) as Promise<void>,
    onProgress: (callback) => {
      const listener = (_e: unknown, runId: string, batch: unknown) => callback(runId, batch as PerfSample[])
      ipcRenderer.on(IPC.PERF_PROGRESS, listener)
      return () => ipcRenderer.removeListener(IPC.PERF_PROGRESS, listener)
    },
    onDone: (callback) => {
      const listener = (_e: unknown, runId: string, samples: unknown, durationMs: number) =>
        callback(runId, samples as PerfSample[], durationMs)
      ipcRenderer.on(IPC.PERF_DONE, listener)
      return () => ipcRenderer.removeListener(IPC.PERF_DONE, listener)
    },
  },
  update: {
    check: () => ipcRenderer.invoke(IPC.UPDATE_CHECK) as Promise<void>,
    download: () => ipcRenderer.invoke(IPC.UPDATE_DOWNLOAD) as Promise<void>,
    install: () => ipcRenderer.invoke(IPC.UPDATE_INSTALL) as Promise<void>,
    getStatus: () => ipcRenderer.invoke(IPC.UPDATE_GET_STATUS) as Promise<UpdateStatus>,
    onStatus: (callback) => {
      const listener = (_e: unknown, status: UpdateStatus) => callback(status)
      ipcRenderer.on(IPC.UPDATE_STATUS, listener)
      return () => ipcRenderer.removeListener(IPC.UPDATE_STATUS, listener)
    },
  },
}

import type {
  ConsoleEntry,
  GrpcFrame,
  GrpcService,
  GrpcStreamResult,
  GrpcUnaryResult,
  MockLogEntry,
  PerfSample,
  SsePushEvent,
  WsPushEvent,
} from '@vayntforge/engine'

contextBridge.exposeInMainWorld('vayntforge', api)