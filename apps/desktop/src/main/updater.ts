import { autoUpdater } from 'electron-updater'
import { app } from 'electron'
import type { BrowserWindow } from 'electron'
import { IPC } from '../shared/ipc'
import type { UpdateStatus } from '../shared/types'

/**
 * electron-updater checks GitHub Releases (see apps/desktop/electron-builder.yml
 * `publish`) for a newer `latest*.yml` + artifact than the running app's
 * version. No release has been published yet, and no code-signing identity
 * is configured (see electron-builder.yml comments) — this wiring is real
 * and functional end-to-end (verified locally: checkForUpdates() against the
 * live, empty GitHub repo returns a genuine "no published release" error
 * rather than crashing or silently doing nothing), but the "app updates
 * itself" acceptance criterion can only be proven once a real release
 * exists to update *to*, which is a publish action for the user to approve.
 */
let lastStatus: UpdateStatus = { state: 'idle' }
let targetWindow: BrowserWindow | null = null

function emit(status: UpdateStatus): void {
  lastStatus = status
  targetWindow?.webContents.send(IPC.UPDATE_STATUS, status)
}

export function initAutoUpdater(win: BrowserWindow): void {
  targetWindow = win
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false

  autoUpdater.on('checking-for-update', () => emit({ state: 'checking' }))
  autoUpdater.on('update-available', (info) => emit({ state: 'available', version: info.version }))
  autoUpdater.on('update-not-available', (info) => emit({ state: 'not-available', version: info.version }))
  autoUpdater.on('download-progress', (progress) =>
    emit({ state: 'downloading', percent: Math.round(progress.percent) })
  )
  autoUpdater.on('update-downloaded', (info) => emit({ state: 'downloaded', version: info.version }))
  autoUpdater.on('error', (err) => emit({ state: 'error', message: err.message }))
}

export function getUpdateStatus(): UpdateStatus {
  return lastStatus
}

export async function checkForUpdates(): Promise<void> {
  // electron-updater's own checkForUpdates() silently no-ops (just a console
  // log, no thrown error, no event) when app.isPackaged is false — verified
  // locally: clicking "Check for updates" in an unpacked/dev run left the
  // UI stuck on "Not checked yet" forever with no feedback at all, a real
  // dead-button bug. Surfacing this explicitly instead of calling into
  // electron-updater at all in that case.
  if (!app.isPackaged) {
    emit({
      state: 'error',
      message: 'Auto-update only runs in a packaged build — use "npm run pack" or "npm run release" to test it.',
    })
    return
  }
  try {
    await autoUpdater.checkForUpdates()
  } catch (err) {
    emit({ state: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}

export async function downloadUpdate(): Promise<void> {
  try {
    await autoUpdater.downloadUpdate()
  } catch (err) {
    emit({ state: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}

export function quitAndInstall(): void {
  autoUpdater.quitAndInstall()
}
