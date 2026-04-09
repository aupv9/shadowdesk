/**
 * Database Auto-Backup System
 *
 * - Creates daily backups of the SQLite database
 * - Keeps max N backups (configurable, default 7)
 * - Supports manual backup trigger
 * - Supports restore from backup
 * - Backup files stored in userData/backups/
 */

import { app } from 'electron'
import { join } from 'path'
import { copyFile, mkdir, readdir, unlink, stat } from 'fs/promises'
import { existsSync } from 'fs'

const BACKUP_DIR_NAME = 'backups'
const MAX_BACKUPS = 7
const DB_FILENAME = 'ghost-browser.db'

function getBackupDir(): string {
  return join(app.getPath('userData'), BACKUP_DIR_NAME)
}

function getDbPath(): string {
  return join(app.getPath('userData'), DB_FILENAME)
}

/** Create a timestamped backup of the database */
export async function createBackup(label?: string): Promise<{ path: string; size: number }> {
  const backupDir = getBackupDir()
  await mkdir(backupDir, { recursive: true })

  const dbPath = getDbPath()
  if (!existsSync(dbPath)) {
    throw new Error('Database file not found — nothing to backup')
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const suffix = label ? `-${label.replace(/[^a-zA-Z0-9-_]/g, '')}` : ''
  const backupName = `ghost-browser-${timestamp}${suffix}.db`
  const backupPath = join(backupDir, backupName)

  await copyFile(dbPath, backupPath)

  const info = await stat(backupPath)

  // Prune old backups
  await pruneBackups()

  console.log(`[Backup] Created: ${backupName} (${(info.size / 1024).toFixed(1)} KB)`)
  return { path: backupPath, size: info.size }
}

/** List available backups, newest first */
export async function listBackups(): Promise<Array<{
  filename: string
  path: string
  size: number
  createdAt: string
}>> {
  const backupDir = getBackupDir()
  if (!existsSync(backupDir)) return []

  const files = await readdir(backupDir)
  const dbFiles = files.filter(f => f.startsWith('ghost-browser-') && f.endsWith('.db'))

  const results = await Promise.all(
    dbFiles.map(async filename => {
      const path = join(backupDir, filename)
      const info = await stat(path)
      return {
        filename,
        path,
        size: info.size,
        createdAt: info.mtime.toISOString()
      }
    })
  )

  return results.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/** Restore database from a backup file */
export async function restoreBackup(backupPath: string): Promise<void> {
  if (!existsSync(backupPath)) {
    throw new Error(`Backup file not found: ${backupPath}`)
  }

  const dbPath = getDbPath()

  // Create a safety backup before restore
  await createBackup('pre-restore')

  // Copy backup over current database
  await copyFile(backupPath, dbPath)

  console.log(`[Backup] Restored from: ${backupPath}`)
}

/** Delete a specific backup */
export async function deleteBackup(backupPath: string): Promise<void> {
  if (!existsSync(backupPath)) return
  await unlink(backupPath)
  console.log(`[Backup] Deleted: ${backupPath}`)
}

/** Remove old backups beyond MAX_BACKUPS limit */
async function pruneBackups(): Promise<void> {
  const backups = await listBackups()
  if (backups.length <= MAX_BACKUPS) return

  const toDelete = backups.slice(MAX_BACKUPS)
  for (const backup of toDelete) {
    try {
      await unlink(backup.path)
      console.log(`[Backup] Pruned old backup: ${backup.filename}`)
    } catch {
      // Non-fatal — skip files that can't be deleted
    }
  }
}

/** Check if a backup was created today */
export async function hasBackupToday(): Promise<boolean> {
  const backups = await listBackups()
  const today = new Date().toISOString().slice(0, 10)
  return backups.some(b => b.createdAt.slice(0, 10) === today)
}

/** Run daily backup check — creates one if none exists today */
export async function runDailyBackup(): Promise<void> {
  try {
    const alreadyDone = await hasBackupToday()
    if (alreadyDone) return
    await createBackup('auto')
  } catch (error) {
    console.error('[Backup] Daily backup failed:', error)
  }
}
