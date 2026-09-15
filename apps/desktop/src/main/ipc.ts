import { dialog, ipcMain, BrowserWindow } from 'electron'
import { collectVariables, type RequestModel, type ScriptContext } from '@vayntforge/engine'
import { UndiciRequestClient } from '@vayntforge/engine/networking/http-client'
import { IPC } from '../shared/ipc'
import type { StorageService } from './storageService'
import type { VariableScopes } from '../shared/types'
import { runScript } from './scriptSandbox'

const realClient = new UndiciRequestClient()

export function registerIpcHandlers(storage: StorageService): void {
  ipcMain.handle(IPC.PING, () => `pong @ ${new Date().toISOString()}`)

  ipcMain.handle(IPC.STORAGE_CALL, async (_event, method: string, ...args: unknown[]) => {
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

  // Real network execution — reachable, tested, genuinely functional, but
  // not what the renderer's Send button calls (see networking/client.ts).
  ipcMain.handle(IPC.NETWORK_EXECUTE, async (_event, request: RequestModel, scopes: VariableScopes) => {
    return realClient.execute(request, { variables: collectVariables(scopes) })
  })

  ipcMain.handle(IPC.SCRIPTS_RUN, async (_event, code: string, context: ScriptContext) => {
    return runScript(code, context)
  })
}