import { ipcMain } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import { join } from 'path'
import { app } from 'electron'
import AdmZip from 'adm-zip'
import { Database } from '../database'
import { BrowserManager } from '../browser-manager'
import { resolveFingerprint, FINGERPRINT_PRESETS } from '../fingerprint/presets'
import { getSettings, updateSettings } from '../settings'
import { downloadUpdate, installUpdate } from '../auto-updater'
import { login, register, logout, getCurrentUser, updatePassword, isAuthenticated } from '../auth'
import { fetchLicense, activateLicense, deactivateLicense, getCurrentLicense, checkProfileLimit, getUsage, getMachineId } from '../license'
import * as team from '../team'
import { pushProfiles, pullProfiles, getSyncState, getSyncManifest, markPendingChange } from '../sync'
import type { CreateProfileInput, CreateProxyInput, TeamRole } from '../../shared/types'
import { parseNetscapeCookies, toNetscapeFormat } from '../utils/cookies'

// ── Handler registration ───────────────────────────────────────────────────

export function registerIpcHandlers(): void {
  const db = Database.getInstance()
  const bm = BrowserManager.getInstance()

  // ── Profiles ──────────────────────────────────────────────────────────────

  ipcMain.handle('profiles:list', () => {
    return db.getAllProfiles()
  })

  ipcMain.handle('profiles:create', (_event, input: CreateProfileInput) => {
    const id = uuidv4()
    const fingerprint = resolveFingerprint(input.preset, id)
    const userDataPath = join(app.getPath('userData'), 'profiles', id)

    db.createProfile({
      id,
      name: input.name,
      fingerprint,
      proxy_id: input.proxy_id,
      notes: input.notes,
      user_data_path: userDataPath
    })

    return db.getProfile(id)
  })

  ipcMain.handle('profiles:update', (_event, id: string, data: Record<string, any>) => {
    db.updateProfile(id, data)
    return db.getProfile(id)
  })

  ipcMain.handle('profiles:clone', async (_event, id: string) => {
    const source = db.getProfile(id) as any
    if (!source) throw new Error(`Profile ${id} not found`)

    const newId = uuidv4()
    const sourceFp = typeof source.fingerprint === 'string'
      ? JSON.parse(source.fingerprint)
      : source.fingerprint
    const newFingerprint = resolveFingerprint(sourceFp.preset, newId)
    const userDataPath = join(app.getPath('userData'), 'profiles', newId)

    db.cloneProfile({
      id: newId,
      sourceId: id,
      name: `${source.name} (Copy)`,
      fingerprint: newFingerprint,
      user_data_path: userDataPath
    })

    return db.getProfile(newId)
  })

  ipcMain.handle('profiles:rerollFingerprint', async (_event, id: string) => {
    const profile = db.getProfile(id) as any
    if (!profile) throw new Error(`Profile ${id} not found`)

    const fp = typeof profile.fingerprint === 'string'
      ? JSON.parse(profile.fingerprint)
      : profile.fingerprint
    const newFingerprint = resolveFingerprint(fp.preset, uuidv4())

    db.updateProfile(id, { fingerprint: newFingerprint })
    return db.getProfile(id)
  })

  ipcMain.handle('profiles:delete', (_event, id: string) => {
    bm.closeProfile(id).catch(() => {})
    db.deleteProfile(id)
  })

  ipcMain.handle('profiles:launch', async (_event, id: string) => {
    const profile = db.getProfile(id) as any
    if (!profile) throw new Error(`Profile ${id} not found`)

    const fingerprint = typeof profile.fingerprint === 'string'
      ? JSON.parse(profile.fingerprint)
      : profile.fingerprint

    const allProxies = db.getAllProxies() as any[]
    const { proxy, nextIndex } = bm.pickProxy(profile, allProxies)

    // Update rotation index for round-robin
    if (profile.rotation_mode === 'round-robin' && nextIndex !== undefined) {
      db.updateProfile(id, { rotation_index: nextIndex })
    }

    let cookies: any[] = []
    try { cookies = JSON.parse(profile.cookies || '[]') } catch { /* ignore */ }

    await bm.launchProfile(id, fingerprint, proxy, cookies.length > 0 ? cookies : undefined)
    db.updateProfileLastUsed(id)
  })

  ipcMain.handle('profiles:close', async (_event, id: string) => {
    await bm.closeProfile(id)
  })

  ipcMain.handle('profiles:active', () => {
    return bm.getActiveSessions()
  })

  ipcMain.handle('profiles:setGroup', (_event, profileId: string, groupId: string | null) => {
    db.updateProfileGroup(profileId, groupId)
  })

  // ── Cookies ───────────────────────────────────────────────────────────────

  ipcMain.handle('cookies:import', async (
    _event, profileId: string, text: string, format: 'netscape' | 'json'
  ) => {
    let cookies: any[]
    try {
      cookies = format === 'json' ? JSON.parse(text) : parseNetscapeCookies(text)
    } catch {
      throw new Error('Invalid cookie format — check your input')
    }
    if (!Array.isArray(cookies)) throw new Error('Cookies must be an array')
    db.updateCookies(profileId, JSON.stringify(cookies))
    return cookies.length
  })

  ipcMain.handle('cookies:export', async (
    _event, profileId: string, format: 'netscape' | 'json'
  ) => {
    const cookiesStr = db.getCookies(profileId)
    const cookies = JSON.parse(cookiesStr)
    return format === 'json'
      ? JSON.stringify(cookies, null, 2)
      : toNetscapeFormat(cookies)
  })

  // ── Groups ────────────────────────────────────────────────────────────────

  ipcMain.handle('groups:list', () => db.getAllGroups())

  ipcMain.handle('groups:create', (_event, input: { name: string; color?: string }) => {
    const id = uuidv4()
    db.createGroup({ id, ...input })
    return { id, name: input.name, color: input.color ?? '#6366f1', created_at: new Date().toISOString() }
  })

  ipcMain.handle('groups:delete', (_event, id: string) => {
    db.deleteGroup(id)
  })

  // ── Profile bundle export ─────────────────────────────────────────────────

  ipcMain.handle('profiles:export', (_event, id: string) => {
    const profile = db.getProfile(id) as any
    if (!profile) throw new Error(`Profile ${id} not found`)

    const zip = new AdmZip()

    const meta = {
      id: profile.id,
      name: profile.name,
      notes: profile.notes,
      created_at: profile.created_at,
      exported_at: new Date().toISOString()
    }
    zip.addFile('profile.json', Buffer.from(JSON.stringify(meta, null, 2)))
    zip.addFile('fingerprint.json', Buffer.from(profile.fingerprint ?? '{}'))
    zip.addFile('cookies.json', Buffer.from(db.getCookies(id)))

    return zip.toBuffer()
  })

  ipcMain.handle('profiles:import', async (_event, zipBuffer: Buffer) => {
    const zip = new AdmZip(zipBuffer)

    const metaEntry = zip.getEntry('profile.json')
    const fpEntry   = zip.getEntry('fingerprint.json')
    const ckEntry   = zip.getEntry('cookies.json')

    if (!metaEntry || !fpEntry) throw new Error('Invalid bundle: missing profile.json or fingerprint.json')

    const meta        = JSON.parse(metaEntry.getData().toString('utf8'))
    const fingerprint = JSON.parse(fpEntry.getData().toString('utf8'))

    const newId       = uuidv4()
    const userDataPath = join(app.getPath('userData'), 'profiles', newId)

    db.createProfile({
      id: newId,
      name: `${meta.name} (Imported)`,
      fingerprint,
      notes: meta.notes ?? '',
      user_data_path: userDataPath
    })

    if (ckEntry) {
      const cookies = ckEntry.getData().toString('utf8')
      db.updateCookies(newId, cookies)
    }

    return db.getProfile(newId)
  })

  // ── Proxies ───────────────────────────────────────────────────────────────

  ipcMain.handle('proxies:list', () => {
    return db.getAllProxies()
  })

  ipcMain.handle('proxies:create', (_event, input: CreateProxyInput) => {
    const id = uuidv4()
    db.createProxy({ id, ...input })
    return { id, ...input }
  })

  ipcMain.handle('proxies:delete', (_event, id: string) => {
    db.deleteProxy(id)
  })

  ipcMain.handle('proxies:test', async (_event, id: string) => {
    const proxies = db.getAllProxies() as any[]
    const proxy = proxies.find((p) => p.id === id)
    if (!proxy) throw new Error(`Proxy ${id} not found`)

    const start = Date.now()
    try {
      const result = await bm.testProxy(proxy)
      db.updateProxyHealth(id, result.latency_ms, true)
      return { latency_ms: result.latency_ms, healthy: true, ip: result.ip }
    } catch {
      const latency_ms = Date.now() - start
      db.updateProxyHealth(id, latency_ms, false)
      return { latency_ms, healthy: false }
    }
  })

  // ── Fingerprint Presets ───────────────────────────────────────────────────

  ipcMain.handle('fingerprint:presets', () => {
    return Object.keys(FINGERPRINT_PRESETS)
  })

  // ── Settings ──────────────────────────────────────────────────────────────

  ipcMain.handle('settings:get', () => {
    return getSettings()
  })

  ipcMain.handle('settings:update', (_event, partial: Record<string, any>) => {
    return updateSettings(partial)
  })

  // ── Auto-updater ──────────────────────────────────────────────────────────

  ipcMain.handle('updater:download', () => {
    downloadUpdate()
  })

  ipcMain.handle('updater:install', () => {
    installUpdate()
  })

  // ── Auth ─────────────────────────────────────────────────────────────────

  ipcMain.handle('auth:login', async (_event, input: { email: string; password: string }) => {
    return login(input)
  })

  ipcMain.handle('auth:register', async (_event, input: { email: string; password: string; name: string }) => {
    return register(input)
  })

  ipcMain.handle('auth:logout', async () => {
    return logout()
  })

  ipcMain.handle('auth:me', async () => {
    return getCurrentUser()
  })

  ipcMain.handle('auth:isAuthenticated', () => {
    return isAuthenticated()
  })

  ipcMain.handle('auth:updatePassword', async (_event, currentPassword: string, newPassword: string) => {
    return updatePassword(currentPassword, newPassword)
  })

  // ── License ──────────────────────────────────────────────────────────────

  ipcMain.handle('license:current', async () => {
    return getCurrentLicense()
  })

  ipcMain.handle('license:fetch', async () => {
    return fetchLicense()
  })

  ipcMain.handle('license:activate', async (_event, licenseKey: string) => {
    return activateLicense(licenseKey)
  })

  ipcMain.handle('license:deactivate', async () => {
    return deactivateLicense()
  })

  ipcMain.handle('license:checkProfileLimit', () => {
    return checkProfileLimit()
  })

  ipcMain.handle('license:usage', () => {
    return getUsage()
  })

  ipcMain.handle('license:machineId', () => {
    return getMachineId()
  })

  // ── Team ─────────────────────────────────────────────────────────────────

  ipcMain.handle('team:get', async () => {
    return team.getTeam()
  })

  ipcMain.handle('team:create', async (_event, name: string) => {
    return team.createTeam(name)
  })

  ipcMain.handle('team:updateName', async (_event, name: string) => {
    return team.updateTeamName(name)
  })

  ipcMain.handle('team:delete', async () => {
    return team.deleteTeam()
  })

  ipcMain.handle('team:members', async () => {
    return team.getMembers()
  })

  ipcMain.handle('team:updateMemberRole', async (_event, userId: string, role: TeamRole) => {
    return team.updateMemberRole(userId, role)
  })

  ipcMain.handle('team:removeMember', async (_event, userId: string) => {
    return team.removeMember(userId)
  })

  ipcMain.handle('team:invite', async (_event, email: string, role: TeamRole) => {
    return team.inviteMember(email, role)
  })

  ipcMain.handle('team:invites', async () => {
    return team.getInvites()
  })

  ipcMain.handle('team:cancelInvite', async (_event, inviteId: string) => {
    return team.cancelInvite(inviteId)
  })

  ipcMain.handle('team:shareProfile', async (_event, profileId: string, memberIds: string[], permission: 'read' | 'write') => {
    return team.shareProfile(profileId, memberIds, permission)
  })

  ipcMain.handle('team:sharedProfiles', async () => {
    return team.getSharedProfiles()
  })

  ipcMain.handle('team:unshareProfile', async (_event, profileId: string, memberId: string) => {
    return team.unshareProfile(profileId, memberId)
  })

  ipcMain.handle('team:auditLog', async (_event, params?: { page?: number; limit?: number; user_id?: string; action?: string }) => {
    return team.getAuditLog(params)
  })

  // ── Cloud Sync ───────────────────────────────────────────────────────────

  ipcMain.handle('sync:status', () => {
    return getSyncState()
  })

  ipcMain.handle('sync:push', async (_event, encryptionPassword: string) => {
    return pushProfiles(encryptionPassword)
  })

  ipcMain.handle('sync:pull', async (_event, encryptionPassword: string) => {
    return pullProfiles(encryptionPassword)
  })

  ipcMain.handle('sync:manifest', async () => {
    return getSyncManifest()
  })
}
