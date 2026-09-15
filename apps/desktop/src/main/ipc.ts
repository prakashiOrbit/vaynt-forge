import { ipcMain } from 'electron'
import { IPC } from '../shared/ipc'
import type { StorageService } from './storageService'

export function registerIpcHandlers(storage: StorageService): void {
  ipcMain.handle(IPC.PING, () => `pong @ ${new Date().toISOString()}`)

  ipcMain.handle(IPC.STORAGE_CALL, async (_event, method: string, ...args: unknown[]) => {
    const fn = (storage as unknown as Record<string, unknown>)[method]
    if (typeof fn !== 'function') throw new Error(`Unknown storage method: ${method}`)
    return (fn as (...a: unknown[]) => unknown).apply(storage, args)
  })
}