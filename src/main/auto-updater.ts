import { autoUpdater } from 'electron-updater'
import { BrowserWindow } from 'electron'

autoUpdater.autoDownload = false

export function initAutoUpdater(mainWindow: BrowserWindow): void {
  autoUpdater.on('update-available', (info) => {
    mainWindow.webContents.send('updater:status', {
      status: 'available',
      version: info.version
    })
  })

  autoUpdater.on('update-not-available', () => {
    mainWindow.webContents.send('updater:status', {
      status: 'up-to-date'
    })
  })

  autoUpdater.on('download-progress', (progress) => {
    mainWindow.webContents.send('updater:status', {
      status: 'downloading',
      percent: Math.round(progress.percent)
    })
  })

  autoUpdater.on('update-downloaded', () => {
    mainWindow.webContents.send('updater:status', {
      status: 'ready'
    })
  })

  autoUpdater.on('error', (err) => {
    mainWindow.webContents.send('updater:status', {
      status: 'error',
      message: err.message
    })
  })

  // Check for updates after a short delay, then every 4 hours
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {})
  }, 5000)
  setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => {})
  }, 4 * 60 * 60 * 1000)
}

export function downloadUpdate(): void {
  autoUpdater.downloadUpdate().catch(() => {})
}

export function installUpdate(): void {
  autoUpdater.quitAndInstall()
}
