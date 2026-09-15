import { app, shell, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { IPC } from '../shared/ipc'
import { registerIpcHandlers } from './ipc'
import { StorageService } from './storageService'

let storageService: StorageService | null = null

const iconPath = join(app.getAppPath(), 'src', 'renderer', 'public', 'vaynt-forge.png')

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
      sandbox: false,
    },
  })

  win.on('ready-to-show', () => win.show())

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

app.on('before-quit', () => {
  storageService?.close()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

export { IPC }