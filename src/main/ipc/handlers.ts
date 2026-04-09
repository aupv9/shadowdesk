import { ipcMain, dialog } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import { join, basename } from 'path'
import { writeFile } from 'fs/promises'
import { app } from 'electron'
import AdmZip from 'adm-zip'
import { Database } from '../database'
import { BrowserManager } from '../browser-manager'
import { AutomationEngine } from '../automation'
import { ApiServer } from '../api-server'
import { resolveFingerprint, FINGERPRINT_PRESETS } from '../fingerprint/presets'
import { getBehaviorPresets } from '../fingerprint/behavior-presets'
import { getTemplates, getTemplate } from '../workflow-templates'
import { getSeaPlatforms, getSeaPlatform, getSeaPlatformTemplates, getSeaRegions } from '../sea-platforms'
// Phase 17.H — Platform-Specific Detection Hardening (pre-flight validator)
import * as platformHardener from '../platform-hardener'
import { getSettings, updateSettings } from '../settings'
import { downloadUpdate, installUpdate } from '../auto-updater'
import {
  login, register, logout, getCurrentUser, updatePassword, isAuthenticated,
  resendVerificationEmail, exportUserData, deleteAccount
} from '../auth'
import {
  fetchLicense, activateLicense, deactivateLicense, getCurrentLicense, checkProfileLimit,
  getUsage, getMachineId, getLicenseStatus, listLicenseDevices, deactivateDevice
} from '../license'
import * as team from '../team'
import {
  pushProfiles, pullProfiles, getSyncState, getSyncManifest, getSyncHistory, getSyncDiff,
  markPendingChange, enableSyncDaemon, disableSyncDaemon, isDaemonEnabled
} from '../sync'
import type { CreateProfileInput, CreateProxyInput, TeamRole, CreateWorkflowInput, UpdateWorkflowInput, ApiServerConfig } from '../../shared/types'
import { parseNetscapeCookies, toNetscapeFormat } from '../utils/cookies'
import { DetectionTestRunner } from '../detection-test'
// Phase 4.2: Input validation + structured error handling
import {
  validateCreateProfileInput,
  validateUpdateProfileInput,
  validateCookiesJson,
  validatePreset,
  validateBulkIds,
} from '../validators/profile-validator'
import { ValidationError, NotFoundError } from '../error-handler'
import { ChromiumPatchManager } from '../fingerprint/chromium-patches'
import { WorkflowScheduler, buildScheduleRow, validateCronExpression } from '../scheduler'
import { driftFingerprint } from '../fingerprint-drift'
import { runWarmUp } from '../warmup'
import { detectCollisions } from '../fingerprint/collision-detector'
import { getSolver, listSolvers, type CaptchaProviderId } from '../captcha'
import { Recorder } from '../recorder'
import { getVault } from '../vault'
import { getNodeManager } from '../remote-nodes'
import { getMarketplace } from '../marketplace'
import { getWebhookManager } from '../webhooks'
import {
  getAiStatus, setAiApiKey, setAiEnabled,
  generateWorkflow, explainStep, fixStep,
  analyzeDetection, healSelector,
  getBehaviorArchetypes, getBehaviorArchetype
} from '../ai-assistant'
// Phase 21 — Behavior Correlation Detector
import {
  runCorrelationScan,
  listCorrelationReports,
  getCorrelationReport,
  deleteCorrelationReport,
  recordBehaviorSample,
  clearBehaviorSamplesForProfile,
} from '../behavior-correlation-service'
import type { BehaviorCorrelationOptions, BehaviorSample } from '../../shared/types'
import { ScriptAnalyzer } from '../script-analyzer'
import { RecordingRefiner } from '../recording-refiner'
import { getProxyProviderManager } from '../proxy-providers/provider-manager'
import type {
  ProxyGenerationOptions,
  ProxyProviderCredentialsInput,
  ProxyProviderType,
} from '../../shared/types'
import type { CreateNodeInput, CreateWebhookInput, TelegramConfig, MarketplaceCategory, WebhookConfig } from '../../shared/types'
import type { AutomationStep, DetectionVectorResult, RefineOptions } from '../../shared/types'

// ── Phase 18: Run history export helpers ──────────────────────────────────

/** Escape a single CSV field — wrap in quotes and double any embedded quotes. */
function csvField(value: unknown): string {
  if (value == null) return ''
  const s = typeof value === 'string' ? value : JSON.stringify(value)
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

/** Phase 18: Serialize workflow runs to CSV or JSON. */
interface ExportRunsOptions {
  format: 'csv' | 'json'
  /** When true each step of every run becomes its own row (CSV only). */
  perStep?: boolean
  /** Max number of runs to include (default 500, enforced cap 5000). */
  limit?: number
  /** Only include runs with this status. */
  status?: 'completed' | 'failed' | 'stopped'
  /** Include resolved variables in the export (default true). */
  includeVariables?: boolean
}

interface ExportedRunRow {
  run_id: string
  workflow_id: string
  profile_id: string
  status: string
  started_at: string
  completed_at: string
  duration_ms: number | null
  step_count: number
  failed_steps: number
  error: string | null
  variables?: Record<string, string> | null
}

interface ExportedStepRow {
  run_id: string
  workflow_id: string
  profile_id: string
  run_status: string
  step_index: number
  step_id: string
  action: string
  success: boolean
  error: string | null
  duration_ms: number | null
  started_at: string
}

function serializeRunsToJson(rows: any[], opts: ExportRunsOptions): string {
  const runs: ExportedRunRow[] = rows.map((r) => {
    const steps = (() => { try { return JSON.parse(r.step_results || '[]') } catch { return [] } })()
    const failed = steps.filter((s: any) => s && s.success === false).length
    const row: ExportedRunRow = {
      run_id: r.id,
      workflow_id: r.workflow_id,
      profile_id: r.profile_id,
      status: r.status,
      started_at: r.started_at,
      completed_at: r.completed_at,
      duration_ms: r.duration_ms ?? null,
      step_count: steps.length,
      failed_steps: failed,
      error: r.error ?? null
    }
    if (opts.includeVariables !== false) {
      try { row.variables = r.variables ? JSON.parse(r.variables) : null } catch { row.variables = null }
    }
    return row
  })
  return JSON.stringify({ exportedAt: new Date().toISOString(), count: runs.length, runs }, null, 2)
}

function serializeRunsToCsv(rows: any[], opts: ExportRunsOptions): string {
  if (opts.perStep) {
    const header = [
      'run_id', 'workflow_id', 'profile_id', 'run_status',
      'step_index', 'step_id', 'action', 'success', 'error',
      'duration_ms', 'started_at'
    ]
    const lines = [header.join(',')]
    for (const r of rows) {
      let steps: any[] = []
      try { steps = JSON.parse(r.step_results || '[]') } catch { /* ignore */ }
      steps.forEach((s, idx) => {
        const row: ExportedStepRow = {
          run_id: r.id,
          workflow_id: r.workflow_id,
          profile_id: r.profile_id,
          run_status: r.status,
          step_index: idx,
          step_id: s?.stepId ?? s?.id ?? '',
          action: s?.action ?? '',
          success: s?.success !== false,
          error: s?.error ?? null,
          duration_ms: typeof s?.durationMs === 'number' ? s.durationMs : null,
          started_at: r.started_at
        }
        lines.push([
          csvField(row.run_id),
          csvField(row.workflow_id),
          csvField(row.profile_id),
          csvField(row.run_status),
          csvField(row.step_index),
          csvField(row.step_id),
          csvField(row.action),
          csvField(row.success),
          csvField(row.error),
          csvField(row.duration_ms),
          csvField(row.started_at)
        ].join(','))
      })
    }
    return lines.join('\n')
  }

  const header = [
    'run_id', 'workflow_id', 'profile_id', 'status',
    'started_at', 'completed_at', 'duration_ms',
    'step_count', 'failed_steps', 'error'
  ]
  if (opts.includeVariables !== false) header.push('variables')
  const lines = [header.join(',')]
  for (const r of rows) {
    let steps: any[] = []
    try { steps = JSON.parse(r.step_results || '[]') } catch { /* ignore */ }
    const failed = steps.filter((s: any) => s && s.success === false).length
    const base = [
      csvField(r.id),
      csvField(r.workflow_id),
      csvField(r.profile_id),
      csvField(r.status),
      csvField(r.started_at),
      csvField(r.completed_at),
      csvField(r.duration_ms ?? ''),
      csvField(steps.length),
      csvField(failed),
      csvField(r.error ?? '')
    ]
    if (opts.includeVariables !== false) {
      let vars: any = null
      try { vars = r.variables ? JSON.parse(r.variables) : null } catch { /* ignore */ }
      base.push(csvField(vars))
    }
    lines.push(base.join(','))
  }
  return lines.join('\n')
}

// ── Handler registration ───────────────────────────────────────────────────

export function registerIpcHandlers(): void {
  const db = Database.getInstance()
  const bm = BrowserManager.getInstance()

  // ── Profiles ──────────────────────────────────────────────────────────────

  ipcMain.handle('profiles:list', () => {
    return db.getAllProfiles()
  })

  // Phase 2.1: Paginated profile listing
  ipcMain.handle('profiles:list-paginated', (_event, limit: number, offset: number, filters?: any) => {
    return db.getProfilesPaginated(limit, offset, filters)
  })

  ipcMain.handle('profiles:create', (_event, input: CreateProfileInput) => {
    // Phase 4.2: Validate input before DB write
    const validationError = validateCreateProfileInput(input)
    if (validationError) {
      throw new ValidationError(validationError.message, { field: validationError.field })
    }

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
    // Phase 4.2: Validate update payload (whitelist + field-level checks)
    const validationError = validateUpdateProfileInput(data)
    if (validationError) {
      throw new ValidationError(validationError.message, { field: validationError.field })
    }

    const existing = db.getProfile(id)
    if (!existing) {
      throw new NotFoundError(`Profile ${id} not found`)
    }

    db.updateProfile(id, data)
    markPendingChange()
    return db.getProfile(id)
  })

  ipcMain.handle('profiles:clone', async (_event, id: string) => {
    const source = db.getProfile(id) as any
    if (!source) throw new NotFoundError(`Profile ${id} not found`)

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

  // Phase 2.2: Bulk operations (Phase 4.2: Validated via validator module)
  ipcMain.handle('profiles:bulk-delete', async (_event, profileIds: string[]) => {
    const validationError = validateBulkIds(profileIds)
    if (validationError) {
      throw new ValidationError(validationError.message, { field: validationError.field })
    }

    // Close all profiles first
    for (const id of profileIds) {
      await bm.closeProfile(id).catch(() => {})
    }

    // Mark as archived in database
    const count = db.bulkDeleteProfiles(profileIds)
    markPendingChange()

    // Phase 4.3: Enqueue cleanup with 10s delay (undo window)
    // Users can cancel the delete within this window via profiles:bulk-restore.
    // Once the delay elapses, the cleanup worker removes the directories.
    const UNDO_WINDOW_MS = 10_000
    const { CleanupWorker } = await import('../cleanup-worker')
    const cleanupWorker = CleanupWorker.getInstance()
    for (const id of profileIds) {
      const profileDataPath = join(app.getPath('userData'), 'profiles', id)
      cleanupWorker.enqueue(id, [profileDataPath], UNDO_WINDOW_MS)
    }

    return { deleted: count, undoWindowMs: UNDO_WINDOW_MS }
  })

  ipcMain.handle('profiles:bulk-proxy', (_event, profileIds: string[], proxyId: string | null) => {
    const validationError = validateBulkIds(profileIds)
    if (validationError) {
      throw new ValidationError(validationError.message, { field: validationError.field })
    }

    const count = db.bulkUpdateProxyId(profileIds, proxyId)
    markPendingChange()
    return { updated: count }
  })

  ipcMain.handle('profiles:bulk-group', (_event, profileIds: string[], groupId: string | null) => {
    const validationError = validateBulkIds(profileIds)
    if (validationError) {
      throw new ValidationError(validationError.message, { field: validationError.field })
    }

    const count = db.bulkUpdateGroupId(profileIds, groupId)
    markPendingChange()
    return { updated: count }
  })

  // Phase 4.3: Restore archived profiles (undo support for bulk-delete)
  ipcMain.handle('profiles:bulk-restore', async (_event, profileIds: string[]) => {
    const validationError = validateBulkIds(profileIds)
    if (validationError) {
      throw new ValidationError(validationError.message, { field: validationError.field })
    }

    // Cancel any pending cleanup tasks to preserve profile data directories
    const { CleanupWorker } = await import('../cleanup-worker')
    const cleanupWorker = CleanupWorker.getInstance()
    const cancelled = cleanupWorker.cancelBulk(profileIds)

    // Flip status from archived back to active
    const restored = db.bulkRestoreProfiles(profileIds)
    markPendingChange()

    return { restored, cancelledCleanups: cancelled }
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

  // Selective sync (Account C5) — flip the sync_excluded flag
  ipcMain.handle('profiles:setSyncExcluded', (_event, profileId: string, excluded: boolean) => {
    db.setSyncExcluded(profileId, excluded)
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

  ipcMain.handle('recorder:start', async (_event, profileId: string, captureScreenshots?: boolean, captureNetwork?: boolean) => {
    const sessionId = await Recorder.getInstance().start(profileId, captureScreenshots ?? false, captureNetwork ?? false)
    return { recording: true, sessionId }
  })

  ipcMain.handle('recorder:stop', async (_event, profileId: string) => {
    return Recorder.getInstance().stop(profileId)
  })

  ipcMain.handle('recorder:state', async (_event, profileId: string) => {
    return Recorder.getInstance().state(profileId)
  })

  ipcMain.handle('recorder:validateSelectors', async (_event, profileId: string) => {
    const recorder = Recorder.getInstance()
    if (!recorder.isRecording(profileId)) throw new Error('No active recording for profile')
    const snapshot = recorder.state(profileId)
    // Expose validateSelectors indirectly via stop-then-re-check would break
    // the session. Instead we re-use the state's steps and run checks against
    // the live page without stopping.
    const bm = BrowserManager.getInstance()
    const page = await bm.getActivePage(profileId)
    if (!page) throw new Error('Profile page not available')
    return (recorder as any).validateSelectors(page, snapshot.steps)
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

  // ── Phase 20 — Proxy Provider Marketplace ─────────────────────────────────
  // (User-facing label: "Phase 17 — Proxy API Integration")

  const providerManager = getProxyProviderManager()

  ipcMain.handle('proxyProviders:catalog', () => {
    return providerManager.listCatalog()
  })

  ipcMain.handle('proxyProviders:list', () => {
    return providerManager.listAccounts()
  })

  ipcMain.handle('proxyProviders:create', (_event, input: {
    type: ProxyProviderType
    label: string
    endpoint?: string
    port?: number
    defaultPool?: 'residential' | 'datacenter' | 'mobile' | 'isp'
    defaultSession?: 'rotating' | 'sticky'
    credentials: ProxyProviderCredentialsInput
  }) => {
    if (!input || !input.type || !input.label) {
      throw new ValidationError('Provider type and label are required')
    }
    if (!input.credentials?.username || !input.credentials?.password) {
      throw new ValidationError('Provider username and password are required')
    }
    return providerManager.createAccount(input)
  })

  ipcMain.handle('proxyProviders:update', (_event, id: string, patch: any) => {
    if (!id) throw new ValidationError('Account id is required')
    return providerManager.updateAccount(id, patch)
  })

  ipcMain.handle('proxyProviders:delete', (_event, id: string) => {
    if (!id) throw new ValidationError('Account id is required')
    providerManager.deleteAccount(id)
    return { ok: true }
  })

  ipcMain.handle('proxyProviders:test', async (_event, id: string) => {
    if (!id) throw new ValidationError('Account id is required')
    return providerManager.testAccount(id)
  })

  ipcMain.handle('proxyProviders:refreshUsage', async (_event, id: string) => {
    if (!id) throw new ValidationError('Account id is required')
    return providerManager.refreshUsage(id)
  })

  ipcMain.handle(
    'proxyProviders:generate',
    async (_event, id: string, options: ProxyGenerationOptions) => {
      if (!id) throw new ValidationError('Account id is required')
      if (!options?.count || options.count < 1 || options.count > 100) {
        throw new ValidationError('count must be between 1 and 100')
      }
      return providerManager.generateProxies(id, options)
    },
  )

  ipcMain.handle(
    'proxyProviders:generateAndImport',
    async (_event, id: string, options: ProxyGenerationOptions) => {
      if (!id) throw new ValidationError('Account id is required')
      if (!options?.count || options.count < 1 || options.count > 100) {
        throw new ValidationError('count must be between 1 and 100')
      }
      return providerManager.generateAndImport(id, options)
    },
  )

  // ── Fingerprint Presets ───────────────────────────────────────────────────

  ipcMain.handle('fingerprint:presets', () => {
    return Object.keys(FINGERPRINT_PRESETS)
  })

  // ── Phase 17: Behavioral Config presets ──────────────────────────────────
  // Exposes a short list of behavior/timing preset bundles to the renderer.
  // The UI applies them by calling profiles:update with the merged fp.
  ipcMain.handle('behavior:presets', () => {
    return getBehaviorPresets()
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

  // D4: resend the verification email. Backend rate-limits server-side.
  ipcMain.handle('auth:resendVerification', async () => {
    return resendVerificationEmail()
  })

  // E3: GDPR data export — main returns the JSON payload for the
  // renderer to convert into a download.
  ipcMain.handle('auth:exportData', async () => {
    return exportUserData()
  })

  // E3: account deletion. Always clears local tokens, even on a partial
  // failure, so the user can't get stuck in a half-deleted state.
  ipcMain.handle('auth:deleteAccount', async () => {
    return deleteAccount()
  })

  // ── License ──────────────────────────────────────────────────────────────

  ipcMain.handle('license:current', async () => {
    return getCurrentLicense()
  })

  ipcMain.handle('license:status', () => {
    return getLicenseStatus()
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

  // E1: list machines this license is activated on. Returns an empty
  // array if the backend doesn't yet implement /licenses/devices, so the
  // renderer can hide the section gracefully.
  ipcMain.handle('license:devices', async () => {
    return listLicenseDevices()
  })

  // E1: revoke a remote machine's seat. Refuses to deactivate the
  // current machine — that path goes through license:deactivate.
  ipcMain.handle('license:deactivateDevice', async (_event, machineId: string) => {
    return deactivateDevice(machineId)
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

  ipcMain.handle('sync:history', (_event, limit?: number) => {
    return getSyncHistory(limit)
  })

  // S3: local-vs-remote diff preview. Computed without decrypting the
  // remote bundle so the user can preview before re-typing the password.
  ipcMain.handle('sync:diff', async () => {
    return getSyncDiff()
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
    // Tier 3: auto-snapshot the current state before overwriting
    const existing = db.getWorkflow(id)
    if (existing && data.steps !== undefined) {
      db.saveWorkflowVersion({
        id: uuidv4(),
        workflowId: id,
        name: existing.name,
        description: existing.description ?? '',
        steps: JSON.parse(existing.steps),
        variables: existing.variables ? JSON.parse(existing.variables) : undefined,
        label: `Auto-save ${new Date().toLocaleTimeString()}`
      })
    }
    db.updateWorkflow(id, data)
    return hydrateWorkflow(db.getWorkflow(id))
  })

  ipcMain.handle('workflows:delete', (_event, id: string) => {
    db.deleteWorkflow(id)
  })

  ipcMain.handle('workflows:run', async (
    event,
    workflowId: string,
    profileId: string,
    variables?: Record<string, string>,
    // Tier 7: optional resilience opts (global timeout + auto-screenshot dir)
    opts?: { maxDurationMs?: number; screenshotOnFailureDir?: string }
  ) => {
    return automation.executeWorkflow(workflowId, profileId, variables, event.sender, opts)
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
    return rows.map((r: any) => ({
      ...r,
      step_results: JSON.parse(r.step_results),
      variables: r.variables ? JSON.parse(r.variables) : null
    }))
  })

  // ── Phase 18: Export run history (CSV / JSON) ─────────────────────────
  // workflowId is optional — pass undefined/null to export across all workflows.
  ipcMain.handle(
    'workflows:runs:export',
    async (_event, workflowId: string | null | undefined, options: ExportRunsOptions) => {
      const opts: ExportRunsOptions = {
        format: options?.format === 'json' ? 'json' : 'csv',
        perStep: !!options?.perStep,
        includeVariables: options?.includeVariables !== false,
        status: options?.status,
        limit: Math.max(1, Math.min(Number(options?.limit ?? 500), 5000))
      }

      const rawRows = workflowId
        ? db.getWorkflowRuns(workflowId, opts.limit)
        : db.getRecentWorkflowRuns(opts.limit)

      const rows = opts.status ? rawRows.filter((r: any) => r.status === opts.status) : rawRows
      const content = opts.format === 'json'
        ? serializeRunsToJson(rows, opts)
        : serializeRunsToCsv(rows, opts)

      const defaultName = `workflow-runs-${workflowId ?? 'all'}-${new Date().toISOString().slice(0, 10)}.${opts.format}`
      const result = await dialog.showSaveDialog({
        title: 'Export workflow run history',
        defaultPath: defaultName,
        filters: opts.format === 'json'
          ? [{ name: 'JSON', extensions: ['json'] }]
          : [{ name: 'CSV', extensions: ['csv'] }]
      })
      if (result.canceled || !result.filePath) {
        return { canceled: true, rowCount: rows.length, content }
      }

      await writeFile(result.filePath, content, 'utf8')
      return { canceled: false, path: result.filePath, rowCount: rows.length, format: opts.format }
    }
  )

  // ── Tier 3: Workflow versioning ───────────────────────────────────────

  ipcMain.handle('workflows:versions', (_event, workflowId: string) => {
    return db.getWorkflowVersions(workflowId)
  })

  ipcMain.handle('workflows:versions:save', (_event, workflowId: string, label?: string) => {
    const row = db.getWorkflow(workflowId)
    if (!row) throw new Error(`Workflow ${workflowId} not found`)
    const id = uuidv4()
    db.saveWorkflowVersion({
      id,
      workflowId,
      name: row.name,
      description: row.description ?? '',
      steps: JSON.parse(row.steps),
      variables: row.variables ? JSON.parse(row.variables) : undefined,
      label: label ?? `Manual save ${new Date().toLocaleTimeString()}`
    })
    return db.getWorkflowVersion(id)
  })

  ipcMain.handle('workflows:versions:restore', (_event, versionId: string) => {
    const version = db.getWorkflowVersion(versionId)
    if (!version) throw new Error(`Version ${versionId} not found`)
    // Snapshot the current state before restoring so the user can undo the restore
    const current = db.getWorkflow(version.workflow_id)
    if (current) {
      db.saveWorkflowVersion({
        id: uuidv4(),
        workflowId: version.workflow_id,
        name: current.name,
        description: current.description ?? '',
        steps: JSON.parse(current.steps),
        variables: current.variables ? JSON.parse(current.variables) : undefined,
        label: `Before restore ${new Date().toLocaleTimeString()}`
      })
    }
    db.updateWorkflow(version.workflow_id, {
      steps: version.steps,
      variables: version.variables
    })
    return hydrateWorkflow(db.getWorkflow(version.workflow_id))
  })

  ipcMain.handle('workflows:versions:delete', (_event, versionId: string) => {
    db.deleteWorkflowVersion(versionId)
  })

  // ── Tier 2: Run history dashboard, metrics, dry-run, debugger ─────────

  ipcMain.handle('workflows:recentRuns', (_event, limit?: number) => {
    const rows = db.getRecentWorkflowRuns(limit ?? 100)
    return rows.map((r: any) => ({
      ...r,
      step_results: JSON.parse(r.step_results),
      variables: r.variables ? JSON.parse(r.variables) : null
    }))
  })

  ipcMain.handle('workflows:metrics', (_event, workflowId?: string) => {
    return db.getWorkflowRunMetrics(workflowId)
  })

  ipcMain.handle('workflows:metrics:actions', (_event, workflowId?: string, limit?: number) => {
    return db.getActionMetrics(workflowId, limit)
  })

  ipcMain.handle('workflows:dryRun', (_event, workflowId: string, variables?: Record<string, string>) => {
    return automation.dryRunWorkflow(workflowId, variables)
  })

  ipcMain.handle('workflows:debug:run', async (
    event,
    workflowId: string,
    profileId: string,
    breakpoints?: string[],
    variables?: Record<string, string>,
    pauseAtStart?: boolean
  ) => {
    return automation.executeWorkflow(workflowId, profileId, variables, event.sender, {
      breakpoints,
      pauseAtStart
    })
  })

  ipcMain.handle('workflows:debug:pause', (_event, workflowId: string, profileId: string) => {
    return automation.pauseWorkflow(workflowId, profileId)
  })

  ipcMain.handle('workflows:debug:resume', (_event, workflowId: string, profileId: string) => {
    return automation.resumeWorkflow(workflowId, profileId)
  })

  ipcMain.handle('workflows:debug:stepOver', (_event, workflowId: string, profileId: string) => {
    return automation.stepOverWorkflow(workflowId, profileId)
  })

  ipcMain.handle('workflows:debug:setBreakpoints', (_event, workflowId: string, profileId: string, stepIds: string[]) => {
    return automation.setBreakpoints(workflowId, profileId, stepIds)
  })

  ipcMain.handle('workflows:debug:state', (_event, workflowId: string, profileId: string) => {
    return automation.getDebugState(workflowId, profileId)
  })

  // ── Tier 5: Workflow execution hooks ─────────────────────────────────

  ipcMain.handle('workflows:hooks:on', (
    _event,
    workflowId: string,
    profileId: string,
    event: string,
    _handler: any
  ) => {
    const runKey = `${workflowId}:${profileId}`
    // Handler is a placeholder since we can't transmit functions over IPC.
    // Instead, the renderer calls this to register interest, then listens to
    // automation:hook-fired events that the main process emits.
    // Return a subscription id for later unsubscribe.
    return { subscribed: true, event }
  })

  // ── Phase 17.H: Platform-Specific Detection Hardening ──────────────────

  ipcMain.handle('hardener:validate', (_event, workflowId: string, profileId: string) => {
    return platformHardener.validatePreFlightById(workflowId, profileId)
  })

  ipcMain.handle('hardener:detectPlatform', (_event, url: string) => {
    return platformHardener.detectPlatformFromUrl(url)
  })

  ipcMain.handle('hardener:tuningHints', () => {
    return platformHardener.getAllTuningHints()
  })

  ipcMain.handle('hardener:tuningHint', (_event, platformId: string) => {
    return platformHardener.buildTuningHint(platformId)
  })

  /** Merge a HardenerFix into the profile's fingerprint and persist via
   *  the existing profiles:update pipeline. The renderer uses this from
   *  the pre-flight validator card's "Apply fix" buttons so a single
   *  round-trip mutates the profile and returns the updated row. */
  ipcMain.handle('hardener:applyFix', (_event, profileId: string, fix: unknown) => {
    const row: any = db.getProfile(profileId)
    if (!row) throw new NotFoundError(`Profile ${profileId} not found`)
    const currentFp = typeof row.fingerprint === 'string'
      ? JSON.parse(row.fingerprint)
      : row.fingerprint
    const patched = platformHardener.applyFix(currentFp, fix as any)
    db.updateProfile(profileId, { fingerprint: JSON.stringify(patched) })
    markPendingChange()
    return db.getProfile(profileId)
  })

  /** Analyze an ad-hoc runtime signal (used from the renderer when a
   *  user-triggered CAPTCHA page is detected via the DOM inspector). */
  ipcMain.handle('hardener:analyzeSignal', (_event, signal: unknown) => {
    return platformHardener.analyzeRuntimeSignal(signal as any)
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
      // Phase 19.1: Reject malformed cron updates the same way create does.
      validateCronExpression(data.cron)
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

  // ── Phase 17 — SEA Platform Catalog ────────────────────────────────
  ipcMain.handle('seaPlatforms:list', () => {
    return getSeaPlatforms()
  })

  ipcMain.handle('seaPlatforms:get', (_event, id: string) => {
    const p = getSeaPlatform(id)
    if (!p) throw new Error(`SEA platform ${id} not found`)
    return p
  })

  ipcMain.handle('seaPlatforms:templates', (_event, id: string) => {
    return getSeaPlatformTemplates(id)
  })

  ipcMain.handle('seaPlatforms:regions', () => {
    return getSeaRegions()
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

  // ── Remote Browser Nodes (Phase 14.A) ─────────────────────────────────────
  const nodes = getNodeManager()

  ipcMain.handle('nodes:list', () => nodes.list())
  ipcMain.handle('nodes:add', (_e, input: CreateNodeInput) => nodes.add(input))
  ipcMain.handle('nodes:remove', (_e, id: string) => nodes.remove(id))
  ipcMain.handle('nodes:test', (_e, id: string) => nodes.ping(id))
  ipcMain.handle('nodes:pickBest', () => nodes.pickBestNode())

  // ── Marketplace (Phase 15.A) ──────────────────────────────────────────────
  const mkt = getMarketplace()

  ipcMain.handle('marketplace:list', (_e, opts?: { category?: MarketplaceCategory; q?: string }) =>
    mkt.list(opts ?? {})
  )
  ipcMain.handle('marketplace:get', (_e, id: string) => mkt.get(id))
  ipcMain.handle('marketplace:install', (_e, id: string, customName?: string) =>
    mkt.install(id, customName)
  )

  // ── Webhooks (Phase 15.C) ─────────────────────────────────────────────────
  const wh = getWebhookManager()

  ipcMain.handle('webhooks:list',   () => wh.listWebhooks())
  ipcMain.handle('webhooks:add',    (_e, input: CreateWebhookInput) => wh.addWebhook(input))
  ipcMain.handle('webhooks:update', (_e, id: string, patch: Partial<WebhookConfig>) => wh.updateWebhook(id, patch))
  ipcMain.handle('webhooks:remove', (_e, id: string) => wh.removeWebhook(id))
  ipcMain.handle('webhooks:telegram:get',  () => wh.getTelegramConfig())
  ipcMain.handle('webhooks:telegram:save', (_e, cfg: TelegramConfig) => wh.saveTelegramConfig(cfg))
  ipcMain.handle('webhooks:dispatch', (_e, event: string, payload: Record<string, any>) =>
    wh.dispatch(event as any, payload)
  )

  // ── AI Assistant (Phase 16) ───────────────────────────────────────────────

  // 16.A — status & configuration
  ipcMain.handle('ai:status', () => getAiStatus())

  ipcMain.handle('ai:setApiKey', (_e, apiKey: string) => {
    setAiApiKey(apiKey)
    return getAiStatus()
  })

  ipcMain.handle('ai:setEnabled', (_e, enabled: boolean) => {
    setAiEnabled(enabled)
    return getAiStatus()
  })

  // 16.A — Natural Language Workflow Builder
  ipcMain.handle('ai:generateWorkflow', (_e, prompt: string, pageHtml?: string) =>
    generateWorkflow(prompt, pageHtml)
  )

  ipcMain.handle('ai:explainStep', (_e, step: AutomationStep) =>
    explainStep(step)
  )

  ipcMain.handle('ai:fixStep', (_e, step: AutomationStep, errorMessage: string) =>
    fixStep(step, errorMessage)
  )

  // 16.B — AI Detection Advisor
  ipcMain.handle('ai:analyzeDetection', (_e, vectors: DetectionVectorResult[], overallScore: number) =>
    analyzeDetection(vectors, overallScore)
  )

  // 16.C — Smart Selector Healing
  ipcMain.handle('ai:healSelector', (_e, originalSelector: string, pageHtml: string, context?: string) =>
    healSelector(originalSelector, pageHtml, context)
  )

  // 16.D — Behaviour Pattern Library
  ipcMain.handle('ai:behaviorArchetypes', () => getBehaviorArchetypes())

  ipcMain.handle('ai:behaviorArchetype', (_e, id: string) => getBehaviorArchetype(id))

  // ── Phase 21 — Behavior Correlation Detector ──────────────────────────────

  ipcMain.handle('correlation:scan', (_e, options?: BehaviorCorrelationOptions) =>
    runCorrelationScan(options ?? {})
  )

  ipcMain.handle('correlation:history', (_e, limit?: number) =>
    listCorrelationReports(limit ?? 25)
  )

  ipcMain.handle('correlation:get', (_e, id: string) => {
    const report = getCorrelationReport(id)
    if (!report) throw new Error(`Correlation report ${id} not found`)
    return report
  })

  ipcMain.handle('correlation:delete', (_e, id: string) => {
    deleteCorrelationReport(id)
    return { success: true }
  })

  ipcMain.handle(
    'correlation:recordSample',
    (_e, profileId: string, sample: BehaviorSample, sessionId?: string) => {
      recordBehaviorSample(profileId, sample, sessionId)
      return { success: true }
    }
  )

  ipcMain.handle('correlation:clearSamples', (_e, profileId: string) => {
    clearBehaviorSamplesForProfile(profileId)
    return { success: true }
  })

  // ── Phase 17 — Script-to-Workflow (Recording Analysis & Refinement) ────────

  const scriptAnalyzer = new ScriptAnalyzer()
  const recordingRefiner = new RecordingRefiner()

  // Session management
  ipcMain.handle('recording:sessions:list', (_e, profileId?: string) =>
    db.listRecordingSessions(profileId)
  )

  ipcMain.handle('recording:sessions:get', (_e, id: string) => {
    const session = db.getRecordingSession(id)
    if (!session) throw new Error(`Recording session ${id} not found`)
    return session
  })

  ipcMain.handle('recording:sessions:delete', (_e, id: string) => {
    db.deleteRecordingSession(id)
  })

  // Quick step preview without full analysis
  ipcMain.handle('recording:previewSteps', (_e, sessionId: string) => {
    const session = db.getRecordingSession(sessionId)
    if (!session) throw new Error(`Session ${sessionId} not found`)
    return scriptAnalyzer.eventsToSteps(session.events)
  })

  // Full pattern analysis
  ipcMain.handle('recording:analyze', async (_e, sessionId: string) => {
    const session = db.getRecordingSession(sessionId)
    if (!session) throw new Error(`Session ${sessionId} not found`)
    db.updateRecordingSession(sessionId, { status: 'analyzing' })
    try {
      const analysis = scriptAnalyzer.analyze({
        id: session.id,
        profileId: session.profileId,
        startedAt: session.startedAt,
        stoppedAt: session.stoppedAt,
        events: session.events,
        pageTitle: session.pageTitle,
        startUrl: session.startUrl,
        captureScreenshots: session.captureScreenshots,
        captureNetwork: session.captureNetwork,
        status: 'analyzing'
      })
      // Don't update status to 'refined' — that's done after AI refine
      return analysis
    } catch (err) {
      db.updateRecordingSession(sessionId, { status: 'stopped' })
      throw err
    }
  })

  // AI batch refinement
  ipcMain.handle('recording:refine', async (_e, sessionId: string, options?: RefineOptions) => {
    const session = db.getRecordingSession(sessionId)
    if (!session) throw new Error(`Session ${sessionId} not found`)
    // Re-analyze to get fresh analysis
    const analysis = scriptAnalyzer.analyze({
      id: session.id,
      profileId: session.profileId,
      startedAt: session.startedAt,
      stoppedAt: session.stoppedAt,
      events: session.events,
      pageTitle: session.pageTitle,
      startUrl: session.startUrl,
      captureScreenshots: session.captureScreenshots,
      captureNetwork: session.captureNetwork,
      status: 'analyzing'
    })
    const refined = await recordingRefiner.refine(analysis, options)
    db.updateRecordingSession(sessionId, { status: 'refined' })
    return refined
  })

  // Save refined steps as a new workflow
  ipcMain.handle('recording:saveAsWorkflow', async (_e, sessionId: string, name: string, description?: string) => {
    const session = db.getRecordingSession(sessionId)
    if (!session) throw new Error(`Session ${sessionId} not found`)
    const analysis = scriptAnalyzer.analyze({
      id: session.id,
      profileId: session.profileId,
      startedAt: session.startedAt,
      stoppedAt: session.stoppedAt,
      events: session.events,
      pageTitle: session.pageTitle,
      startUrl: session.startUrl,
      captureScreenshots: session.captureScreenshots,
      captureNetwork: session.captureNetwork,
      status: 'stopped'
    })
    const workflowId = uuidv4()
    const variables = Object.fromEntries(
      analysis.extractedVariables.filter((v) => v.autoApply).map((v) => [v.name, v.value])
    )
    db.createWorkflow({
      id: workflowId,
      name: name || analysis.suggestedWorkflow.name,
      description: description || analysis.suggestedWorkflow.description || '',
      steps: analysis.suggestedWorkflow.steps,
      variables
    })
    db.updateRecordingSession(sessionId, { status: 'saved' })
    return db.getWorkflow(workflowId)
  })

  // ── Phase 2.3: Cleanup Worker ──────────────────────────────────────────────

  ipcMain.handle('cleanup:status', () => {
    const { CleanupWorker } = require('../cleanup-worker')
    const cleanupWorker = CleanupWorker.getInstance()
    return cleanupWorker.getStatus()
  })

  ipcMain.handle('cleanup:retryFailed', () => {
    const { CleanupWorker } = require('../cleanup-worker')
    const cleanupWorker = CleanupWorker.getInstance()
    cleanupWorker.retryFailedCleanups()
    return { success: true }
  })

  ipcMain.handle('cleanup:clearFailed', () => {
    const { CleanupWorker } = require('../cleanup-worker')
    const cleanupWorker = CleanupWorker.getInstance()
    cleanupWorker.clearFailedCleanups()
    return { success: true }
  })
}
