import { app } from 'electron'
import { apiRequest } from './api-client'
import { Database } from './database'
import { isAuthenticated } from './auth'
import { getMachineId } from './license'

/**
 * Phase 2 — Analytics & Telemetry Service
 *
 * Reports anonymized usage metrics and detection scores to the Common SaaS
 * backend for the admin dashboard. All data is opt-in and can be disabled
 * via settings. No PII is included — only aggregate counters and scores.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface UsageSnapshot {
  machine_id: string
  app_version: string
  profile_count: number
  active_session_count: number
  proxy_count: number
  workflow_count: number
  detection_avg_score: number | null
  os_platform: string
  timestamp: string
}

export interface DetectionScoreReport {
  profile_id: string
  profile_name: string
  overall_score: number
  vector_count: number
  passed_count: number
  warned_count: number
  failed_count: number
  tested_at: string
}

export interface FeatureUsageEvent {
  feature: string
  action: string
  metadata?: Record<string, unknown>
  timestamp: string
}

export interface AnalyticsDashboardData {
  total_profiles: number
  active_sessions: number
  avg_detection_score: number | null
  detection_trend: Array<{ date: string; score: number }>
  feature_usage: Array<{ feature: string; count: number }>
  profile_creation_trend: Array<{ date: string; count: number }>
  proxy_health: { healthy: number; unhealthy: number; untested: number }
  top_presets: Array<{ preset: string; count: number }>
}

// ── Local buffer for batching events ─────────────────────────────────────────

const eventBuffer: FeatureUsageEvent[] = []
const MAX_BUFFER_SIZE = 50
let flushTimer: ReturnType<typeof setInterval> | null = null
const FLUSH_INTERVAL_MS = 5 * 60_000 // 5 minutes

// ── Public API ───────────────────────────────────────────────────────────────

/** Build a usage snapshot from local DB state using existing public methods. */
export function buildUsageSnapshot(activeSessions: number): UsageSnapshot {
  const db = Database.getInstance()

  const profiles = db.getAllProfiles()
  const proxies = db.getAllProxies()
  const workflows = db.getAllWorkflows()
  const summary = db.getDetectionTestSummary()

  return {
    machine_id: getMachineId(),
    app_version: app.getVersion(),
    profile_count: profiles.length,
    active_session_count: activeSessions,
    proxy_count: proxies.length,
    workflow_count: workflows.length,
    detection_avg_score: summary.averageScore || null,
    os_platform: process.platform,
    timestamp: new Date().toISOString()
  }
}

/** Report usage snapshot to the backend. */
export async function reportUsage(activeSessions: number): Promise<void> {
  if (!isAuthenticated()) return

  const snapshot = buildUsageSnapshot(activeSessions)
  try {
    await apiRequest('/analytics/usage', {
      method: 'POST',
      body: snapshot
    })
  } catch {
    // Best-effort — never throw
  }
}

/** Report a detection test score to the backend. */
export async function reportDetectionScore(report: DetectionScoreReport): Promise<void> {
  if (!isAuthenticated()) return

  try {
    await apiRequest('/analytics/detection-scores', {
      method: 'POST',
      body: report
    })
  } catch {
    // Best-effort
  }
}

/** Track a feature usage event (buffered, batched). */
export function trackFeatureUsage(feature: string, action: string, metadata?: Record<string, unknown>): void {
  eventBuffer.push({
    feature,
    action,
    metadata,
    timestamp: new Date().toISOString()
  })

  if (eventBuffer.length >= MAX_BUFFER_SIZE) {
    flushEvents()
  }
}

/** Flush buffered feature events to the backend. */
export async function flushEvents(): Promise<void> {
  if (!isAuthenticated() || eventBuffer.length === 0) return

  const batch = eventBuffer.splice(0)
  try {
    await apiRequest('/analytics/events', {
      method: 'POST',
      body: { events: batch }
    })
  } catch {
    // Put events back on failure
    eventBuffer.unshift(...batch)
  }
}

/** Fetch analytics dashboard data from the backend. */
export async function getAnalyticsDashboard(): Promise<AnalyticsDashboardData> {
  return apiRequest<AnalyticsDashboardData>('/analytics/dashboard')
}

/** Fetch local analytics summary (computed from local DB using public methods). */
export function getLocalAnalytics(): AnalyticsDashboardData {
  const db = Database.getInstance()

  const profiles = db.getAllProfiles()
  const proxies = db.getAllProxies()
  const summary = db.getDetectionTestSummary()
  const detectionResults = db.getDetectionTestResults()

  // Proxy health breakdown
  const healthy = proxies.filter((p: any) => p.is_healthy === 1).length
  const unhealthy = proxies.filter((p: any) => p.is_healthy === 0).length
  const untested = proxies.filter((p: any) => p.is_healthy == null).length

  // Detection score trend (compute from results in memory)
  const trendMap = new Map<string, { total: number; count: number }>()
  for (const r of detectionResults) {
    if (!r.testedAt) continue
    const date = r.testedAt.slice(0, 10)
    const entry = trendMap.get(date) ?? { total: 0, count: 0 }
    entry.total += r.overallScore ?? 0
    entry.count += 1
    trendMap.set(date, entry)
  }
  const detectionTrend = Array.from(trendMap.entries())
    .map(([date, { total, count }]) => ({ date, score: Math.round(total / count) }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30)

  // Profile creation trend (compute from profile data)
  const creationMap = new Map<string, number>()
  for (const p of profiles) {
    if (!p.created_at) continue
    const date = p.created_at.slice(0, 10)
    creationMap.set(date, (creationMap.get(date) ?? 0) + 1)
  }
  const profileTrend = Array.from(creationMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30)

  // Top fingerprint presets
  const presetMap = new Map<string, number>()
  for (const p of profiles) {
    const fp = typeof p.fingerprint === 'string' ? (() => { try { return JSON.parse(p.fingerprint) } catch { return null } })() : p.fingerprint
    const preset = fp?.preset ?? 'custom'
    presetMap.set(preset, (presetMap.get(preset) ?? 0) + 1)
  }
  const topPresets = Array.from(presetMap.entries())
    .map(([preset, count]) => ({ preset, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  return {
    total_profiles: profiles.length,
    active_sessions: 0,
    avg_detection_score: summary.averageScore || null,
    detection_trend: detectionTrend,
    feature_usage: [],
    profile_creation_trend: profileTrend,
    proxy_health: { healthy, unhealthy, untested },
    top_presets: topPresets
  }
}

/** Start periodic usage reporting. */
export function startAnalyticsDaemon(): void {
  if (flushTimer) return
  flushTimer = setInterval(() => {
    flushEvents()
  }, FLUSH_INTERVAL_MS)
}

/** Stop periodic usage reporting. */
export function stopAnalyticsDaemon(): void {
  if (flushTimer) {
    clearInterval(flushTimer)
    flushTimer = null
  }
  // Flush remaining events
  flushEvents()
}
