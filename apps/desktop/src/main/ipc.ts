import { ipcMain } from 'electron'
import { IPC } from '../shared/ipc'

export function registerIpcHandlers(): void {
  ipcMain.handle(IPC.PING, () => `pong @ ${new Date().toISOString()}`)
}