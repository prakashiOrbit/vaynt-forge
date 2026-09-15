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
}

contextBridge.exposeInMainWorld('vayntforge', api)