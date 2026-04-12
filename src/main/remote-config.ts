import { app } from 'electron'
import { BrowserWindow } from 'electron'
import { apiRequest } from './api-client'
import { isAuthenticated } from './auth'
import { getMachineId } from './license'

/**
 * Phase 2 — Remote Configuration & Feature Flags
 *
 * Fetches feature flags and remote settings from the Common SaaS backend.
 * This allows server-side control of:
 * - Feature rollouts (gradual, beta, A/B testing)
 * - Client-side limits and thresholds
 * - Maintenance mode announcements
 * - Fingerprint preset updates
 * - Minimum version enforcement
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface FeatureFlag {
  key: string
  enabled: boolean
  variant?: string
  metadata?: Record<string, unknown>
}

export interface RemoteConfig {
  flags: FeatureFlag[]
  settings: Record<string, unknown>
  announcements: Announcement[]
  minimum_version: string | null
  fetched_at: string
}

export interface Announcement {
  id: string
  type: 'info' | 'warning' | 'critical' | 'maintenance'
  title: string
  message: string
  action_url?: string
  action_label?: string
  dismissible: boolean
  starts_at: string
  ends_at?: string | null
}

export interface FingerprintPresetUpdate {
  preset_key: string
  version: number
  changes: Record<string, unknown>
  description: string
  published_at: string
}

// ── In-memory cache ──────────────────────────────────────────────────────────

let cachedConfig: RemoteConfig | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null
let mainWindow: BrowserWindow | null = null
const POLL_INTERVAL_MS = 10 * 60_000 // 10 minutes
const CACHE_TTL_MS = 5 * 60_000 // 5 minutes

// ── Public API ───────────────────────────────────────────────────────────────

/** Fetch remote config from the backend. Caches for CACHE_TTL_MS. */
export async function fetchRemoteConfig(): Promise<RemoteConfig> {
  if (cachedConfig) {
    const age = Date.now() - new Date(cachedConfig.fetched_at).getTime()
    if (age < CACHE_TTL_MS) return cachedConfig
  }

  try {
    const config = await apiRequest<RemoteConfig>('/config/client', {
      method: 'POST',
      body: {
        app_version: app.getVersion(),
        machine_id: getMachineId(),
        platform: process.platform
      }
    })
    config.fetched_at = new Date().toISOString()
    cachedConfig = config

    // Notify renderer of config update
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('remoteConfig:update', config)
    }

    return config
  } catch {
    // Return cached or empty config on failure
    return cachedConfig ?? {
      flags: [],
      settings: {},
      announcements: [],
      minimum_version: null,
      fetched_at: new Date().toISOString()
    }
  }
}

/** Check if a feature flag is enabled. */
export async function isFeatureEnabled(key: string): Promise<boolean> {
  const config = await fetchRemoteConfig()
  const flag = config.flags.find((f) => f.key === key)
  return flag?.enabled ?? false
}

/** Get a specific feature flag with variant info. */
export async function getFeatureFlag(key: string): Promise<FeatureFlag | null> {
  const config = await fetchRemoteConfig()
  return config.flags.find((f) => f.key === key) ?? null
}

/** Get all feature flags. */
export async function getAllFlags(): Promise<FeatureFlag[]> {
  const config = await fetchRemoteConfig()
  return config.flags
}

/** Get a remote setting value by key path (dot notation). */
export async function getRemoteSetting<T = unknown>(key: string): Promise<T | null> {
  const config = await fetchRemoteConfig()
  const parts = key.split('.')
  let current: unknown = config.settings
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return null
    current = (current as Record<string, unknown>)[part]
  }
  return (current as T) ?? null
}

/** Get active announcements (within their time window). */
export async function getActiveAnnouncements(): Promise<Announcement[]> {
  const config = await fetchRemoteConfig()
  const now = new Date()
  return config.announcements.filter((a) => {
    const starts = new Date(a.starts_at)
    const ends = a.ends_at ? new Date(a.ends_at) : null
    return starts <= now && (!ends || ends >= now)
  })
}

/** Check if the current app version meets the minimum required version. */
export async function checkMinimumVersion(): Promise<{ ok: boolean; minimum: string | null; current: string }> {
  const config = await fetchRemoteConfig()
  const current = app.getVersion()

  if (!config.minimum_version) {
    return { ok: true, minimum: null, current }
  }

  const ok = compareVersions(current, config.minimum_version) >= 0
  return { ok, minimum: config.minimum_version, current }
}

/** Fetch available fingerprint preset updates from the server. */
export async function getPresetUpdates(): Promise<FingerprintPresetUpdate[]> {
  try {
    return await apiRequest<FingerprintPresetUpdate[]>('/config/preset-updates')
  } catch {
    return []
  }
}

/** Dismiss an announcement (report to backend). */
export async function dismissAnnouncement(announcementId: string): Promise<void> {
  try {
    await apiRequest(`/config/announcements/${announcementId}/dismiss`, {
      method: 'POST'
    })
  } catch {
    // Best-effort
  }
}

// ── Daemon ────────────────────────────────────────────────────────────────────

/** Start polling for remote config updates. */
export function startRemoteConfigDaemon(window: BrowserWindow): void {
  mainWindow = window
  if (pollTimer) return

  // Initial fetch
  fetchRemoteConfig()

  pollTimer = setInterval(() => {
    if (isAuthenticated()) {
      fetchRemoteConfig()
    }
  }, POLL_INTERVAL_MS)
}

/** Stop polling. */
export function stopRemoteConfigDaemon(): void {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

/** Invalidate cache so next fetch hits the server. */
export function invalidateConfigCache(): void {
  cachedConfig = null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Compare two semver strings. Returns -1, 0, or 1. */
function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const va = pa[i] ?? 0
    const vb = pb[i] ?? 0
    if (va < vb) return -1
    if (va > vb) return 1
  }
  return 0
}
