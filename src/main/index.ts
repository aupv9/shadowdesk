import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { Database } from './database'
import { registerIpcHandlers } from './ipc/handlers'
import { initAutoUpdater } from './auto-updater'
import { initSyncWindow } from './sync'

const isDev = process.env.NODE_ENV === 'development'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.ghostbrowser.app')
  }

  // Initialize database (sql.js is async — WASM load)
  const db = Database.getInstance()
  await db.initialize()

  // Register IPC handlers
  registerIpcHandlers()

  createWindow()

  // Auto-updater (only in production builds)
  if (!isDev && mainWindow) {
    initAutoUpdater(mainWindow)
  }

  // Initialize sync window reference for status notifications
  if (mainWindow) {
    initSyncWindow(mainWindow)
  }

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

export { mainWindow }
