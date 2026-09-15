import { app, shell, session, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { IPC } from '../shared/ipc'
import { registerIpcHandlers } from './ipc'
import { StorageService } from './storageService'
import { getRunningServerIds, stopAllMockServers } from './mockServerRuntime'
import { initAutoUpdater, checkForUpdates } from './updater'

let storageService: StorageService | null = null

const iconPath = join(app.getAppPath(), 'src', 'renderer', 'public', 'vaynt-forge.png')

const isDev = Boolean(process.env['ELECTRON_RENDERER_URL'])

/**
 * Production is `'self'`-only: every script/style/font this app ships is
 * bundled locally by Vite (no CDN scripts, no remote fonts — see
 * @fontsource in package.json), and the app never sends real requests to
 * arbitrary hosts from the renderer *except* one deliberate, real feature —
 * OpenAPI "Import from URL" (`OpenApiPage.tsx`) does a genuine renderer-side
 * `fetch()` of a user-provided spec URL — hence `connect-src https: http:`
 * rather than `'self'`. Dev mode is intentionally looser: electron-vite's
 * HMR needs `'unsafe-eval'`/`'unsafe-inline'` and a `ws:` connection to its
 * own dev server origin, neither of which ships in the packaged app.
 */
const CSP = isDev
  ? [
      "default-src 'self' " + process.env['ELECTRON_RENDERER_URL'],
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' " + process.env['ELECTRON_RENDERER_URL'],
      "style-src 'self' 'unsafe-inline' " + process.env['ELECTRON_RENDERER_URL'],
      "connect-src 'self' https: http: ws: " + process.env['ELECTRON_RENDERER_URL'],
      "img-src 'self' data: " + process.env['ELECTRON_RENDERER_URL'],
      "font-src 'self' data: " + process.env['ELECTRON_RENDERER_URL'],
      "object-src 'none'",
      "base-uri 'none'",
    ].join('; ')
  : [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      'connect-src \'self\' https: http:',
      "img-src 'self' data:",
      "font-src 'self' data:",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'none'",
      "frame-src 'none'",
    ].join('; ')

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    title: 'Vaynt Forge',
    icon: existsSync(iconPath) ? iconPath : undefined,
    backgroundColor: '#0e1012',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  win.on('ready-to-show', () => win.show())

  initAutoUpdater(win)
  if (!isDev) {
    // Fire-and-forget: a background check a few seconds after launch, same
    // as VS Code/most Electron apps. Errors (including "no releases
    // published yet") surface through IPC.UPDATE_STATUS, not a crash.
    setTimeout(() => void checkForUpdates(), 5000)
  }

  // Open external links in the system browser, never in-app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  // BrowserWindow's `icon` option doesn't drive the macOS Dock icon in dev
  // mode (Electron shows its own default there) — only app.dock.setIcon does.
  if (process.platform === 'darwin' && existsSync(iconPath)) {
    app.dock?.setIcon(iconPath)
  }

  const dbPath = join(app.getPath('userData'), 'vayntforge.db')
  storageService = new StorageService(dbPath)
  registerIpcHandlers(storageService)
  console.log(`[storage] sqlite @ ${dbPath}`)

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [CSP],
      },
    })
  })

  app.on('web-contents-created', (_e, contents) => {
    contents.on('will-navigate', (event, url) => {
      const allowed = url.startsWith('file:') || url.startsWith(process.env['ELECTRON_RENDERER_URL'] ?? '')
      if (!allowed) event.preventDefault()
    })
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

let quitting = false
app.on('before-quit', (event) => {
  if (quitting) return
  quitting = true
  event.preventDefault()
  void (async () => {
    // The persisted `status: 'running'` flag would otherwise survive quit
    // and lie to the next launch — the OS socket dies with this process.
    for (const id of getRunningServerIds()) {
      const server = storageService?.getMockServerSync(id)
      if (server) await storageService?.saveMockServer({ ...server, status: 'stopped' })
    }
    await stopAllMockServers()
    storageService?.close()
    app.quit()
  })()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

export { IPC }