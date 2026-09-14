import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc'
import type { ApiForgeApi } from '../shared/types'

const api: ApiForgeApi = {
  app: {
    ping: () => ipcRenderer.invoke(IPC.PING) as Promise<string>,
    version: process.env['npm_package_version'] ?? '0.0.0',
  },
}

contextBridge.exposeInMainWorld('apiforge', api)