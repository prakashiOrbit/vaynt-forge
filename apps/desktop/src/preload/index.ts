import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc'
import type { ApiForgeApi } from '../shared/types'

const storage = {
  call: (method: string, ...args: unknown[]) => ipcRenderer.invoke(IPC.STORAGE_CALL, method, ...args),
} as ApiForgeApi['storage']

const api: ApiForgeApi = {
  app: {
    ping: () => ipcRenderer.invoke(IPC.PING) as Promise<string>,
    version: process.env['npm_package_version'] ?? '0.0.0',
  },
  storage,
}

contextBridge.exposeInMainWorld('apiforge', api)