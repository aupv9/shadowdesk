import { v4 as uuid } from 'uuid'
import { getDatabase } from '../../config/database'
import type { AnalyticsDashboardData } from '../../types'

interface UsageInput {
  machine_id: string
  app_version: string
  profile_count?: number
  active_session_count?: number
  proxy_count?: number
  workflow_count?: number
  detection_avg_score?: number | null
  os_platform?: string | null
}

interface DetectionInput {
  profile_id: string
  profile_name?: string | null
  overall_score: number
  vector_count?: number
  passed_count?: number
  warned_count?: number
  failed_count?: number
  tested_at?: string
}

interface EventInput {
  feature: string
  action: string
  metadata?: Record<string, unknown>
  timestamp?: string
}

export class AnalyticsService {
  async recordUsage(userId: string, s: UsageInput): Promise<void> {
    const db = getDatabase()
    await db('usage_snapshots').insert({
      id: uuid(),
      user_id: userId,
      machine_id: s.machine_id,
      app_version: s.app_version,
      profile_count: s.profile_count ?? 0,
      active_session_count: s.active_session_count ?? 0,
      proxy_count: s.proxy_count ?? 0,
      workflow_count: s.workflow_count ?? 0,
      detection_avg_score: s.detection_avg_score ?? null,
      os_platform: s.os_platform ?? null,
      created_at: new Date()
    })
  }

  async recordDetectionScore(userId: string, r: DetectionInput): Promise<void> {
    const db = getDatabase()
    await db('detection_scores').insert({
      id: uuid(),
      user_id: userId,
      profile_id: r.profile_id,
      profile_name: r.profile_name ?? null,
      overall_score: r.overall_score,
      vector_count: r.vector_count ?? 0,
      passed_count: r.passed_count ?? 0,
      warned_count: r.warned_count ?? 0,
      failed_count: r.failed_count ?? 0,
      tested_at: r.tested_at ? new Date(r.tested_at) : null,
      created_at: new Date()
    })
  }

  async recordEvents(userId: string, events: EventInput[]): Promise<void> {
    if (!events.length) return
    const db = getDatabase()
    const rows = events.map((e) => ({
      id: uuid(),
      user_id: userId,
      feature: e.feature,
      action: e.action,
      metadata: e.metadata ? JSON.stringify(e.metadata) : null,
      created_at: e.timestamp ? new Date(e.timestamp) : new Date()
    }))
    await db('feature_events').insert(rows)
  }

  /** Aggregate stored telemetry into the dashboard shape (best-effort). */
  async dashboard(userId: string): Promise<AnalyticsDashboardData> {
    const db = getDatabase()

    const snap = await db('usage_snapshots').where({ user_id: userId }).orderBy('created_at', 'desc').first()
    const scores = await db('detection_scores').where({ user_id: userId }).select('overall_score', 'created_at')
    const events = await db('feature_events').where({ user_id: userId }).select('feature')

    const avg = scores.length
      ? Math.round(scores.reduce((sum: number, s: any) => sum + Number(s.overall_score || 0), 0) / scores.length)
      : null

    const trendMap = new Map<string, { total: number; count: number }>()
    for (const s of scores) {
      const date = new Date(s.created_at).toISOString().slice(0, 10)
      const e = trendMap.get(date) ?? { total: 0, count: 0 }
      e.total += Number(s.overall_score || 0)
      e.count += 1
      trendMap.set(date, e)
    }
    const detection_trend = Array.from(trendMap.entries())
      .map(([date, { total, count }]) => ({ date, score: Math.round(total / count) }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30)

    const featMap = new Map<string, number>()
    for (const e of events) featMap.set(e.feature, (featMap.get(e.feature) ?? 0) + 1)
    const feature_usage = Array.from(featMap.entries())
      .map(([feature, count]) => ({ feature, count }))
      .sort((a, b) => b.count - a.count)

    return {
      total_profiles: snap?.profile_count ?? 0,
      active_sessions: snap?.active_session_count ?? 0,
      avg_detection_score: avg,
      detection_trend,
      feature_usage,
      profile_creation_trend: [],
      proxy_health: { healthy: 0, unhealthy: 0, untested: 0 },
      top_presets: []
    }
  }
}

export const analyticsService = new AnalyticsService()
