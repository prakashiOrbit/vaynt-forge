import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc'
import type { VayntForgeApi } from '../shared/types'

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
  },
  network: {
    execute: (request, scopes) => ipcRenderer.invoke(IPC.NETWORK_EXECUTE, request, scopes),
  },
  scripts: {
    run: (code, context) => ipcRenderer.invoke(IPC.SCRIPTS_RUN, code, context),
  },
  realtime: {
    grpc: {
      start: () => ipcRenderer.invoke(IPC.GRPC_START) as Promise<string>,
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
}

import type { GrpcFrame, GrpcStreamResult, GrpcUnaryResult, MockLogEntry } from '@vayntforge/engine'

contextBridge.exposeInMainWorld('vayntforge', api)