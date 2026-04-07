import { ipcMain, dialog } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import { join, basename } from 'path'
import { app } from 'electron'
import AdmZip from 'adm-zip'
import { Database } from '../database'
import { BrowserManager } from '../browser-manager'
import { AutomationEngine } from '../automation'
import { ApiServer } from '../api-server'
import { resolveFingerprint, FINGERPRINT_PRESETS } from '../fingerprint/presets'
import { getTemplates, getTemplate } from '../workflow-templates'
import { getSettings, updateSettings } from '../settings'
import { downloadUpdate, installUpdate } from '../auto-updater'
import { login, register, logout, getCurrentUser, updatePassword, isAuthenticated } from '../auth'
import { fetchLicense, activateLicense, deactivateLicense, getCurrentLicense, checkProfileLimit, getUsage, getMachineId } from '../license'
import * as team from '../team'
import {
  pushProfiles, pullProfiles, getSyncState, getSyncManifest,
  markPendingChange, enableSyncDaemon, disableSyncDaemon, isDaemonEnabled
} from '../sync'
import type { CreateProfileInput, CreateProxyInput, TeamRole, CreateWorkflowInput, UpdateWorkflowInput, ApiServerConfig } from '../../shared/types'
import { parseNetscapeCookies, toNetscapeFormat } from '../utils/cookies'
import { DetectionTestRunner } from '../detection-test'
import { ChromiumPatchManager } from '../fingerprint/chromium-patches'
import { WorkflowScheduler, buildScheduleRow } from '../scheduler'
import { driftFingerprint } from '../fingerprint-drift'
import { runWarmUp } from '../warmup'
import { detectCollisions } from '../fingerprint/collision-detector'
import { getSolver, listSolvers, type CaptchaProviderId } from '../captcha'
import { Recorder } from '../recorder'
import { getVault } from '../vault'

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

    markPendingChange()
    return db.getProfile(id)
  })

  ipcMain.handle('profiles:update', (_event, id: string, data: Record<string, any>) => {
    db.updateProfile(id, data)
    markPendingChange()
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

    markPendingChange()
    return db.getProfile(newId)
  })

  ipcMain.handle('profiles:rerollFingerprint', async (_event, id: string) => {
    const profile = db.getProfile(id) as any
    if (!profile) throw new Error(`Profile ${id} not found`)

    const fp = typeof profile.fingerprint === 'string'
      ? JSON.parse(profile.fingerprint)
      : profile.fingerprint

    // Phase 6: snapshot the current fingerprint before replacing it
    db.saveProfileVersion({
      id: uuidv4(),
      profileId: id,
      fingerprint: fp,
      label: 'Before reroll'
    })

    const newFingerprint = resolveFingerprint(fp.preset, uuidv4())
    db.updateProfile(id, { fingerprint: newFingerprint })
    markPendingChange()
    return db.getProfile(id)
  })

  // Phase 10: switch preset on an existing profile while preserving behavior/timing
  ipcMain.handle('profiles:changePreset', async (_event, id: string, presetKey: string) => {
    const profile = db.getProfile(id) as any
    if (!profile) throw new Error(`Profile ${id} not found`)
    if (!FINGERPRINT_PRESETS[presetKey]) throw new Error(`Unknown preset: ${presetKey}`)

    const fp = typeof profile.fingerprint === 'string'
      ? JSON.parse(profile.fingerprint)
      : profile.fingerprint

    // Snapshot before changing
    db.saveProfileVersion({ id: uuidv4(), profileId: id, fingerprint: fp, label: `Before preset change to ${presetKey}` })

    // Resolve new fingerprint, then carry over behavior + timing from old one
    const newFp = resolveFingerprint(presetKey, id)
    if (fp.behavior) newFp.behavior = fp.behavior
    if (fp.timing)   newFp.timing   = fp.timing

    db.updateProfile(id, { fingerprint: newFp })
    markPendingChange()
    return db.getProfile(id)
  })

  ipcMain.handle('profiles:delete', async (_event, id: string) => {
    await bm.closeProfile(id).catch(() => {})
    db.deleteProfile(id)
    markPendingChange()
    // Remove Chromium user-data directory for this profile
    const { rm } = await import('fs/promises')
    const profileDataPath = join(app.getPath('userData'), 'profiles', id)
    await rm(profileDataPath, { recursive: true, force: true }).catch(() => {})
  })

  ipcMain.handle('profiles:launch', async (_event, id: string) => {
    const profile = db.getProfile(id) as any
    if (!profile) throw new Error(`Profile ${id} not found`)
    // Chromium fallback: validate before launch attempt

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
    markPendingChange()
  })

  // Phase 12.C.4: fingerprint collision detection
  ipcMain.handle('profiles:detectCollisions', () => {
    const profiles = db.getAllProfiles()
    return detectCollisions(profiles)
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
    markPendingChange()
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

  ipcMain.handle('cookies:capture', async (_event, profileId: string) => {
    const page = await bm.getActivePage(profileId)
    if (!page) throw new Error('Profile is not running — launch it first')
    const cookies = await page.cookies()
    // Also save captured cookies to the DB
    db.updateCookies(profileId, JSON.stringify(cookies))
    markPendingChange()
    return cookies
  })

  // Phase 12.C.1 — Interactive cookie editor

  ipcMain.handle('cookies:list', async (_event, profileId: string) => {
    const raw = db.getCookies(profileId)
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  })

  /**
   * Replace the entire cookie set for a profile. If the profile is currently
   * running, the live browser session is also updated so the change takes
   * effect immediately. Same-domain duplicates are kept; the caller is
   * responsible for de-duplication if needed.
   */
  ipcMain.handle('cookies:save', async (_event, profileId: string, cookies: any[]) => {
    if (!Array.isArray(cookies)) throw new Error('cookies must be an array')
    db.updateCookies(profileId, JSON.stringify(cookies))
    markPendingChange()

    // Best-effort: push the new set into the live session if there is one.
    const page = await bm.getActivePage(profileId).catch(() => null)
    if (page) {
      try {
        const existing = await page.cookies()
        if (existing.length > 0) {
          await page.deleteCookie(...existing.map((c: any) => ({ name: c.name, domain: c.domain, path: c.path })))
        }
        if (cookies.length > 0) {
          await page.setCookie(...(cookies as any[]))
        }
      } catch (err) {
        // Non-fatal — DB is the source of truth on next launch.
      }
    }
    return cookies.length
  })

  // ── Storage inspector (Phase 12.C.2) ──────────────────────────────────────
  //
  // Read-only inspector for per-profile localStorage / sessionStorage / IndexedDB.
  // All three require the profile to be currently running so we can drive Chromium
  // via the existing CDP session. The IPC surface is intentionally narrow:
  //
  //   storage:listOrigins(profileId)            → string[] (security origins)
  //   storage:getDOMStorage(profileId, origin, isLocal) → { key, value }[]
  //   storage:listIndexedDb(profileId, origin)  → { name, version, stores: string[] }[]
  //   storage:getIndexedDbEntries(profileId, origin, dbName, store, max?) → any[]

  ipcMain.handle('storage:listOrigins', async (_event, profileId: string) => {
    const page = await bm.getActivePage(profileId)
    if (!page) throw new Error('Profile is not running — launch it first')

    // Aggregate origins from every frame in every open page (browser-wide for
    // this profile's user-data dir). Skip about:blank, chrome://, devtools://.
    const browser = page.browser()
    const origins = new Set<string>()
    for (const p of await browser.pages()) {
      if (p.isClosed()) continue
      for (const frame of p.frames()) {
        const url = frame.url()
        if (!url || url === 'about:blank') continue
        try {
          const u = new URL(url)
          if (u.protocol === 'http:' || u.protocol === 'https:') {
            origins.add(`${u.protocol}//${u.host}`)
          }
        } catch {
          // ignore unparseable urls
        }
      }
    }
    return Array.from(origins).sort()
  })

  ipcMain.handle(
    'storage:getDOMStorage',
    async (_event, profileId: string, origin: string, isLocalStorage: boolean) => {
      const page = await bm.getActivePage(profileId)
      if (!page) throw new Error('Profile is not running — launch it first')
      const session = await page.createCDPSession()
      try {
        const result = (await session.send('DOMStorage.getDOMStorageItems', {
          storageId: { securityOrigin: origin, isLocalStorage }
        } as any)) as { entries: [string, string][] }
        return result.entries.map(([key, value]) => ({ key, value }))
      } finally {
        await session.detach().catch(() => {})
      }
    }
  )

  ipcMain.handle(
    'storage:listIndexedDb',
    async (_event, profileId: string, origin: string) => {
      const page = await bm.getActivePage(profileId)
      if (!page) throw new Error('Profile is not running — launch it first')
      const session = await page.createCDPSession()
      try {
        const namesResult = (await session.send('IndexedDB.requestDatabaseNames', {
          securityOrigin: origin
        } as any)) as { databaseNames: string[] }

        const dbs: Array<{ name: string; version: number; stores: string[] }> = []
        for (const name of namesResult.databaseNames) {
          try {
            const dbInfo = (await session.send('IndexedDB.requestDatabase', {
              securityOrigin: origin,
              databaseName: name
            } as any)) as {
              databaseWithObjectStores: {
                name: string
                version: number
                objectStores: { name: string }[]
              }
            }
            dbs.push({
              name: dbInfo.databaseWithObjectStores.name,
              version: dbInfo.databaseWithObjectStores.version,
              stores: dbInfo.databaseWithObjectStores.objectStores.map((s) => s.name)
            })
          } catch {
            dbs.push({ name, version: 0, stores: [] })
          }
        }
        return dbs
      } finally {
        await session.detach().catch(() => {})
      }
    }
  )

  ipcMain.handle(
    'storage:getIndexedDbEntries',
    async (
      _event,
      profileId: string,
      origin: string,
      databaseName: string,
      objectStoreName: string,
      max: number = 100
    ) => {
      const page = await bm.getActivePage(profileId)
      if (!page) throw new Error('Profile is not running — launch it first')
      const session = await page.createCDPSession()
      try {
        const data = (await session.send('IndexedDB.requestData', {
          securityOrigin: origin,
          databaseName,
          objectStoreName,
          indexName: '',
          skipCount: 0,
          pageSize: Math.max(1, Math.min(500, max)),
          keyRange: undefined
        } as any)) as {
          objectStoreDataEntries: Array<{
            key: { value?: any; type?: string }
            primaryKey: { value?: any; type?: string }
            value: { value?: any; type?: string }
          }>
          hasMore: boolean
        }
        return {
          entries: data.objectStoreDataEntries.map((e) => ({
            key: e.key?.value ?? null,
            primaryKey: e.primaryKey?.value ?? null,
            value: e.value?.value ?? null
          })),
          hasMore: data.hasMore
        }
      } finally {
        await session.detach().catch(() => {})
      }
    }
  )

  // ── Visual recorder (Phase 12.B.2) ────────────────────────────────────────

  ipcMain.handle('recorder:start', async (_event, profileId: string) => {
    await Recorder.getInstance().start(profileId)
    return { recording: true }
  })

  ipcMain.handle('recorder:stop', async (_event, profileId: string) => {
    return Recorder.getInstance().stop(profileId)
  })

  ipcMain.handle('recorder:state', async (_event, profileId: string) => {
    return Recorder.getInstance().state(profileId)
  })

  ipcMain.handle('recorder:isRecording', async (_event, profileId: string) => {
    return Recorder.getInstance().isRecording(profileId)
  })

  // ── Encrypted credential vault (Phase 12.C.3) ─────────────────────────────

  ipcMain.handle('vault:status', async () => {
    const v = getVault()
    return { initialized: v.isInitialized(), unlocked: v.isUnlocked() }
  })

  ipcMain.handle('vault:unlock', async (_event, masterPassword: string) => {
    if (!masterPassword) throw new Error('Master password is required')
    return getVault().unlock(masterPassword)
  })

  ipcMain.handle('vault:lock', async () => {
    getVault().lock()
    return { locked: true }
  })

  ipcMain.handle('vault:list', async (_event, profileId?: string) => {
    return getVault().list(profileId)
  })

  ipcMain.handle('vault:get', async (_event, id: string) => {
    return getVault().get(id)
  })

  ipcMain.handle(
    'vault:create',
    async (
      _event,
      input: {
        profile_id: string | null
        label: string
        username: string
        password: string
        fields?: Record<string, string>
      }
    ) => {
      return getVault().create(input)
    }
  )

  ipcMain.handle(
    'vault:update',
    async (
      _event,
      id: string,
      data: Partial<{
        label: string
        username: string
        password: string
        fields: Record<string, string>
        profile_id: string | null
      }>
    ) => {
      return getVault().update(id, data)
    }
  )

  ipcMain.handle('vault:delete', async (_event, id: string) => {
    getVault().delete(id)
    return { deleted: true }
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

    markPendingChange()

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

  ipcMain.handle('proxies:importBulk', (_event, lines: string[]) => {
    let imported = 0
    let failed = 0
    for (const raw of lines) {
      const line = raw.trim()
      if (!line || line.startsWith('#')) continue
      try {
        // Supported formats:
        //   type:host:port[:user[:pass]]
        //   host:port[:user[:pass]]   (defaults to http)
        const parts = line.split(':')
        let type: 'http' | 'https' | 'socks5' = 'http'
        let idx = 0
        if (['http', 'https', 'socks5'].includes(parts[0].toLowerCase())) {
          type = parts[0].toLowerCase() as 'http' | 'https' | 'socks5'
          idx = 1
        }
        const host = parts[idx]
        const port = parseInt(parts[idx + 1] ?? '8080', 10)
        const username = parts[idx + 2] || undefined
        const password = parts[idx + 3] || undefined
        if (!host || isNaN(port)) { failed++; continue }
        const id = uuidv4()
        db.createProxy({ id, name: `${host}:${port}`, type, host, port, username, password })
        imported++
      } catch {
        failed++
      }
    }
    return { imported, failed }
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

  // ── System: Chromium binary info (Phase 12.A.1) ──────────────────────────

  ipcMain.handle('system:chromiumVersion', async () => {
    try {
      return await bm.detectBinaryVersion()
    } catch (err) {
      return { error: (err as Error).message ?? 'Failed to detect Chromium version' }
    }
  })

  // ── Captcha (Phase 12.B.1) ───────────────────────────────────────────────

  ipcMain.handle('captcha:listProviders', () => {
    return listSolvers()
  })

  ipcMain.handle('captcha:checkBalance', async (_event, providerId: CaptchaProviderId, apiKey?: string) => {
    const settings = getSettings()
    const key = apiKey || settings.captcha.apiKeys[providerId] || ''
    if (!key) throw new Error(`No API key configured for ${providerId}`)
    const solver = getSolver(providerId)
    try {
      const balance = await solver.getBalance(key)
      return { provider: providerId, balance }
    } catch (err: any) {
      return { provider: providerId, error: err.message ?? 'Balance check failed' }
    }
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

  ipcMain.handle('sync:daemonEnabled', () => {
    return isDaemonEnabled()
  })

  ipcMain.handle('sync:enableDaemon', (_event, encryptionPassword: string) => {
    return enableSyncDaemon(encryptionPassword)
  })

  ipcMain.handle('sync:disableDaemon', () => {
    disableSyncDaemon()
  })

  // ── Automation / RPA ────────────────────────────────────────────────────

  const automation = AutomationEngine.getInstance()

  // Phase 12.B.4 — parse the variables JSON column on every read
  const hydrateWorkflow = (row: any) => ({
    ...row,
    steps: JSON.parse(row.steps),
    variables: row.variables ? JSON.parse(row.variables) : {}
  })

  ipcMain.handle('workflows:list', () => {
    const rows = db.getAllWorkflows()
    return rows.map(hydrateWorkflow)
  })

  ipcMain.handle('workflows:get', (_event, id: string) => {
    const row = db.getWorkflow(id)
    if (!row) throw new Error(`Workflow ${id} not found`)
    return hydrateWorkflow(row)
  })

  ipcMain.handle('workflows:create', (_event, input: CreateWorkflowInput) => {
    const id = uuidv4()
    db.createWorkflow({
      id,
      name: input.name,
      description: input.description,
      steps: input.steps,
      variables: input.variables
    })
    return hydrateWorkflow(db.getWorkflow(id))
  })

  ipcMain.handle('workflows:update', (_event, id: string, data: UpdateWorkflowInput) => {
    db.updateWorkflow(id, data)
    return hydrateWorkflow(db.getWorkflow(id))
  })

  ipcMain.handle('workflows:delete', (_event, id: string) => {
    db.deleteWorkflow(id)
  })

  ipcMain.handle('workflows:run', async (event, workflowId: string, profileId: string, variables?: Record<string, string>) => {
    return automation.executeWorkflow(workflowId, profileId, variables, event.sender)
  })

  // Phase 10.1 — parallel execution against many profiles at once
  ipcMain.handle('workflows:runParallel', async (
    event,
    workflowId: string,
    profileIds: string[],
    variables?: Record<string, string>,
    concurrency?: number
  ) => {
    return automation.executeWorkflowParallel(workflowId, profileIds, variables, concurrency ?? 5, event.sender)
  })

  ipcMain.handle('workflows:stop', (_event, workflowId: string, profileId: string) => {
    automation.stopWorkflow(workflowId, profileId)
  })

  ipcMain.handle('workflows:stopAll', (_event, workflowId: string) => {
    return automation.stopWorkflowAll(workflowId)
  })

  ipcMain.handle('workflows:isRunning', (_event, workflowId: string, profileId: string) => {
    return automation.isWorkflowRunning(workflowId, profileId)
  })

  ipcMain.handle('workflows:runs', (_event, workflowId: string) => {
    const rows = db.getWorkflowRuns(workflowId)
    return rows.map((r: any) => ({ ...r, step_results: JSON.parse(r.step_results) }))
  })

  // ── Schedules (Phase 10.2) ────────────────────────────────────────────────

  const scheduler = WorkflowScheduler.getInstance()

  ipcMain.handle('schedules:list', () => {
    const rows = db.getAllSchedules()
    return rows.map((r: any) => ({
      ...r,
      enabled: !!r.enabled,
      profile_ids: JSON.parse(r.profile_ids || '[]')
    }))
  })

  ipcMain.handle('schedules:create', (_event, input: { workflow_id: string; profile_ids: string[]; cron: string; enabled?: boolean; name?: string }) => {
    const row = buildScheduleRow(input)
    db.createSchedule(row)
    return { ...row, enabled: row.enabled }
  })

  ipcMain.handle('schedules:update', (_event, id: string, data: any) => {
    if (data.cron) {
      const next = scheduler.nextRun(data.cron)
      data.next_run_at = next ? next.toISOString() : null
    }
    db.updateSchedule(id, data)
    const row = db.getSchedule(id)
    if (!row) return null
    return { ...row, enabled: !!row.enabled, profile_ids: JSON.parse(row.profile_ids || '[]') }
  })

  ipcMain.handle('schedules:delete', (_event, id: string) => {
    db.deleteSchedule(id)
  })

  ipcMain.handle('schedules:runNow', async (_event, id: string) => {
    const row = db.getSchedule(id)
    if (!row) throw new Error('Schedule not found')
    const profileIds: string[] = JSON.parse(row.profile_ids || '[]')
    await scheduler.runSchedule(id, row.workflow_id, profileIds)
    return { triggered: profileIds.length }
  })

  // ── Profile Extensions (Phase 10.3) ───────────────────────────────────────

  ipcMain.handle('extensions:list', (_event, profileId: string) => {
    return db.getProfileExtensions(profileId).map((e: any) => ({ ...e, enabled: !!e.enabled }))
  })

  ipcMain.handle('extensions:add', (_event, profileId: string, name: string, extPath: string) => {
    const id = uuidv4()
    db.addProfileExtension({ id, profile_id: profileId, name, path: extPath, enabled: true })
    return { id, profile_id: profileId, name, path: extPath, enabled: true }
  })

  ipcMain.handle('extensions:setEnabled', (_event, id: string, enabled: boolean) => {
    db.setExtensionEnabled(id, enabled)
  })

  ipcMain.handle('extensions:remove', (_event, id: string) => {
    db.removeProfileExtension(id)
  })

  ipcMain.handle('extensions:pickFolder', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select unpacked Chrome extension folder',
      properties: ['openDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const path = result.filePaths[0]
    return { path, name: basename(path) }
  })

  // ── Profile drift / warm-up (Phase 11.2 / 11.3) ───────────────────────────

  ipcMain.handle('profiles:setDrift', (_event, profileId: string, enabled: boolean) => {
    db.setProfileDriftEnabled(profileId, enabled)
  })

  ipcMain.handle('profiles:applyDrift', (_event, profileId: string) => {
    const profile: any = db.getProfile(profileId)
    if (!profile) throw new Error('Profile not found')
    const fp = typeof profile.fingerprint === 'string' ? JSON.parse(profile.fingerprint) : profile.fingerprint
    const drifted = driftFingerprint(fp)
    db.updateProfile(profileId, { fingerprint: drifted })
    db.setProfileLastDrift(profileId, new Date().toISOString())
    return drifted
  })

  ipcMain.handle('profiles:warmUp', async (_event, profileId: string, sites?: string[]) => {
    const result = await runWarmUp(profileId, sites)
    return result
  })

  // ── Workflow Templates ──────────────────────────────────────────────

  ipcMain.handle('templates:list', () => {
    return getTemplates()
  })

  ipcMain.handle('templates:get', (_event, id: string) => {
    const tpl = getTemplate(id)
    if (!tpl) throw new Error(`Template ${id} not found`)
    return tpl
  })

  ipcMain.handle('templates:createFromTemplate', (_event, templateId: string, name?: string) => {
    const tpl = getTemplate(templateId)
    if (!tpl) throw new Error(`Template ${templateId} not found`)
    const id = uuidv4()
    // Deep clone steps and assign new IDs
    const steps = JSON.parse(JSON.stringify(tpl.steps)).map((s: any) => ({
      ...s,
      id: uuidv4()
    }))
    db.createWorkflow({ id, name: name ?? tpl.name, description: tpl.description, steps })
    const row = db.getWorkflow(id)
    return { ...row, steps: JSON.parse(row.steps) }
  })

  // ── API Server ──────────────────────────────────────────────────────

  const apiServer = ApiServer.getInstance()

  ipcMain.handle('apiServer:status', () => {
    return apiServer.getStatus()
  })

  ipcMain.handle('apiServer:config', () => {
    return apiServer.getConfig()
  })

  ipcMain.handle('apiServer:start', async (_event, config?: Partial<ApiServerConfig>) => {
    return apiServer.start(config)
  })

  ipcMain.handle('apiServer:stop', async () => {
    await apiServer.stop()
    return apiServer.getStatus()
  })

  // ── Detection Tests ───────────────────────────────────────────────────

  const detectionRunner = DetectionTestRunner.getInstance()

  ipcMain.handle('detection:runTest', async (_event, profileId: string) => {
    return detectionRunner.runTest(profileId)
  })

  ipcMain.handle('detection:results', (_event, profileId?: string) => {
    return detectionRunner.getResults(profileId)
  })

  ipcMain.handle('detection:summary', () => {
    return db.getDetectionTestSummary()
  })

  // Phase 7: detection result management + batch testing
  ipcMain.handle('detection:deleteResult', (_event, resultId: string) => {
    db.deleteDetectionTestResult(resultId)
  })

  ipcMain.handle('detection:clearHistory', (_event, profileId?: string) => {
    db.deleteAllDetectionTestResults(profileId)
  })

  ipcMain.handle('detection:batchTest', async (_event, profileIds: string[]) => {
    const results: any[] = []
    let completed = 0
    let failed = 0

    for (const profileId of profileIds) {
      try {
        const result = await detectionRunner.runTest(profileId)
        results.push(result)
        completed++
      } catch {
        failed++
      }
    }

    return { total: profileIds.length, completed, failed, results }
  })

  // ── Chromium Patches (Phase 8) ────────────────────────────────────────────

  const patchManager = ChromiumPatchManager.getInstance()

  ipcMain.handle('patches:status', () => {
    return patchManager.getStatus()
  })

  ipcMain.handle('patches:list', () => {
    return patchManager.getStatus().patches
  })

  ipcMain.handle('patches:getByCategory', (_event, category: string) => {
    return patchManager.getPatchesByCategory(category as any)
  })

  // ── Profile Version History (Phase 6) ─────────────────────────────────────

  ipcMain.handle('profiles:history', (_event, profileId: string) => {
    return db.getProfileVersions(profileId)
  })

  ipcMain.handle('profiles:saveVersion', (_event, profileId: string, label: string) => {
    const profile = db.getProfile(profileId) as any
    if (!profile) throw new Error(`Profile ${profileId} not found`)
    const fp = typeof profile.fingerprint === 'string'
      ? JSON.parse(profile.fingerprint)
      : profile.fingerprint
    const versionId = uuidv4()
    db.saveProfileVersion({ id: versionId, profileId, fingerprint: fp, label: label || 'Manual snapshot' })
    return { id: versionId }
  })

  ipcMain.handle('profiles:restoreVersion', async (_event, profileId: string, versionId: string) => {
    const version = db.getProfileVersion(versionId)
    if (!version) throw new Error(`Version ${versionId} not found`)
    if (version.profile_id !== profileId) throw new Error('Version does not belong to this profile')

    // Snapshot current state before restoring
    const current = db.getProfile(profileId) as any
    if (current) {
      const currentFp = typeof current.fingerprint === 'string'
        ? JSON.parse(current.fingerprint)
        : current.fingerprint
      db.saveProfileVersion({
        id: uuidv4(),
        profileId,
        fingerprint: currentFp,
        label: `Before restore to ${version.label}`
      })
    }

    db.updateProfile(profileId, { fingerprint: version.fingerprint })
    return db.getProfile(profileId)
  })

  ipcMain.handle('profiles:deleteVersion', (_event, versionId: string) => {
    db.deleteProfileVersion(versionId)
  })
}
