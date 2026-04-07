import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { Database } from './database'
import { BrowserManager } from './browser-manager'
import { registerIpcHandlers } from './ipc/handlers'
import { initAutoUpdater } from './auto-updater'
import { initSyncWindow } from './sync'
import { ApiServer } from './api-server'
import { getSettings } from './settings'
import { resolveFingerprint } from './fingerprint/presets'
import { WorkflowScheduler } from './scheduler'

const isDev = process.env.NODE_ENV === 'development'

// ── Suppress harmless Chromium DevTools-frontend CDP version-mismatch errors ─
// These come from Chrome's bundled DevTools JS calling CDP domains that don't
// exist in the Chromium binary version (e.g. Autofill domain added in Chrome 112+).
// They are printed to stderr by the Chromium subprocess and are not actionable.
const SUPPRESS_PATTERNS = [
  "Autofill.enable",
  "Autofill.setAddresses",
]
const _stderrWrite = process.stderr.write.bind(process.stderr)
;(process.stderr as any).write = (chunk: any, ...args: any[]): boolean => {
  const str = typeof chunk === 'string' ? chunk : chunk.toString()
  if (SUPPRESS_PATTERNS.some(p => str.includes(p))) return true
  return _stderrWrite(chunk, ...args)
}

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

  // Phase 10.2 — start the workflow scheduler poller
  WorkflowScheduler.getInstance().start()

  // Auto-launch last used profile if setting is enabled
  const settings = getSettings()
  if (settings.autoLaunchLastSession) {
    const profiles = db.getAllProfiles() as any[]
    const lastUsed = profiles
      .filter((p) => p.last_used_at)
      .sort((a, b) => b.last_used_at.localeCompare(a.last_used_at))[0]
    if (lastUsed) {
      const fp = typeof lastUsed.fingerprint === 'string'
        ? JSON.parse(lastUsed.fingerprint)
        : lastUsed.fingerprint
      const allProxies = db.getAllProxies() as any[]
      const bm = BrowserManager.getInstance()
      const { proxy } = bm.pickProxy(lastUsed, allProxies)
      let cookies: any[] = []
      try { cookies = JSON.parse(lastUsed.cookies || '[]') } catch { /* ignore */ }
      bm.launchProfile(lastUsed.id, fp, proxy ?? undefined, cookies.length > 0 ? cookies : undefined)
        .catch(() => {})
    }
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

// Clean up API server + scheduler on quit
app.on('before-quit', async () => {
  WorkflowScheduler.getInstance().stop()
  await ApiServer.getInstance().stop()
})

export { mainWindow }
