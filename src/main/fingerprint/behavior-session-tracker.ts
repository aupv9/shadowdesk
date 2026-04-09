/**
 * P3: Session-to-Session Behavior Drift Tracking
 *
 * Monitors if a profile's behavior is drifting (becoming more consistent)
 * across sessions, which would indicate automation to sophisticated detectors.
 *
 * Tracks:
 * - Mouse movement patterns (velocity, direction, acceleration)
 * - Typing cadence (WPM, inter-keystroke timing variance)
 * - Scroll patterns (speed, duration, pause timing)
 * - Overall "bot score" across sessions
 *
 * Detection: If behavior becomes TOO CONSISTENT across 5+ sessions,
 * recommend rotating profiles or increasing randomization.
 */

import { Database } from '../database'
import { v4 as uuidv4 } from 'uuid'

export interface BehaviorSessionMetrics {
  sessionId: string
  profileId: string
  timestamp: string

  // Mouse metrics
  mouseVelocityAvg: number      // pixels/ms
  mouseAccelerationVariance: number
  mouseDirectionChanges: number

  // Typing metrics
  typingWPM: number
  typingVariance: number        // std dev of inter-keystroke intervals
  typingPauseFrequency: number

  // Scroll metrics
  scrollSpeedAvg: number        // pixels/ms
  scrollPauseCount: number
  scrollDirectionChanges: number

  // Composite score
  botConsistencyScore: number   // 0-100: 0=natural, 100=bot-like
}

export interface BehaviorDriftReport {
  profileId: string
  sessionCount: number
  driftTrend: 'stable' | 'drifting_consistent' | 'drifting_inconsistent'
  riskLevel: 'low' | 'medium' | 'high'
  consistencyScore: number      // 0-100
  recommendations: string[]
  historicalScores: number[]
}

/**
 * Simulated session metrics for demonstration
 * In production, these would be collected via CDP/event tracking
 */
export function generateSessionMetrics(
  sessionId: string,
  profileId: string,
  sessionNumber: number
): BehaviorSessionMetrics {
  // Deterministic RNG seeded by session number
  const rng = seededRng(hashCode(profileId) ^ sessionNumber)

  return {
    sessionId,
    profileId,
    timestamp: new Date().toISOString(),

    // Mouse: slightly decreasing variance = drifting toward consistency
    mouseVelocityAvg: 150 + rng() * 50,
    mouseAccelerationVariance: 30 - sessionNumber * 1.5, // decreases with time
    mouseDirectionChanges: Math.floor(45 + rng() * 20),

    // Typing: becoming more consistent = suspicious
    typingWPM: 70 + rng() * 20,
    typingVariance: 15 - sessionNumber * 0.5, // variance decreases
    typingPauseFrequency: 3 + rng() * 2,

    // Scroll: becoming more regular = bot-like
    scrollSpeedAvg: 200 + rng() * 100,
    scrollPauseCount: 12 - Math.floor(sessionNumber * 0.5), // fewer pauses = bot-like
    scrollDirectionChanges: Math.floor(8 + rng() * 4),

    // Composite score (higher = more bot-like)
    botConsistencyScore: 20 + sessionNumber * 3 + rng() * 20
  }
}

/**
 * Analyze behavior drift across multiple sessions
 */
export function analyzeBehaviorDrift(
  profileId: string,
  sessionMetrics: BehaviorSessionMetrics[]
): BehaviorDriftReport {
  const sortedMetrics = [...sessionMetrics].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )

  const consistencyScores = sortedMetrics.map(m => m.botConsistencyScore)
  const avgConsistency = consistencyScores.reduce((a, b) => a + b, 0) / consistencyScores.length

  // Calculate trend
  let driftTrend: 'stable' | 'drifting_consistent' | 'drifting_inconsistent' = 'stable'
  let driftingConsistent = 0

  for (let i = 1; i < consistencyScores.length; i++) {
    const prev = consistencyScores[i - 1]
    const curr = consistencyScores[i]

    // If consistency is increasing (getting more bot-like)
    if (curr > prev + 2) driftingConsistent++
  }

  if (driftingConsistent >= consistencyScores.length * 0.6) {
    driftTrend = 'drifting_consistent'
  } else if (driftingConsistent <= consistencyScores.length * 0.2) {
    driftTrend = 'drifting_inconsistent'
  }

  // Risk assessment
  let riskLevel: 'low' | 'medium' | 'high' = 'low'
  const recommendations: string[] = []

  if (driftTrend === 'drifting_consistent') {
    riskLevel = avgConsistency > 60 ? 'high' : 'medium'
    recommendations.push('Behavior is becoming TOO CONSISTENT - rotate profiles')
    recommendations.push('Increase behavior.mouseJitter randomization')
    recommendations.push('Enable timing.rafJitter and timing.performanceClamp')
  } else if (avgConsistency > 50) {
    riskLevel = 'medium'
    recommendations.push('Consider reducing session frequency (launch patterns)')
    recommendations.push('Vary browsing patterns across sessions')
  }

  if (sortedMetrics.length > 20) {
    recommendations.push('Profile has >20 sessions - consider creating new profiles')
  }

  return {
    profileId,
    sessionCount: sortedMetrics.length,
    driftTrend,
    riskLevel,
    consistencyScore: Math.round(avgConsistency),
    recommendations,
    historicalScores: consistencyScores
  }
}

/**
 * Store session metrics to database (stub)
 * In production, integrates with detection-test.ts database
 */
export function storeSessionMetrics(metrics: BehaviorSessionMetrics): void {
  console.log('[Behavior Tracker] Session metrics stored:', {
    profileId: metrics.profileId,
    sessionId: metrics.sessionId,
    botScore: metrics.botConsistencyScore
  })

  const db = Database.getInstance()
  db.saveBehaviorSession({
    id: uuidv4(),
    profile_id: metrics.profileId,
    session_id: metrics.sessionId,
    timestamp: metrics.timestamp,
    mouse_velocity_avg: metrics.mouseVelocityAvg,
    mouse_acceleration_variance: metrics.mouseAccelerationVariance,
    mouse_direction_changes: metrics.mouseDirectionChanges,
    typing_wpm: metrics.typingWPM,
    typing_variance: metrics.typingVariance,
    typing_pause_frequency: metrics.typingPauseFrequency,
    scroll_speed_avg: metrics.scrollSpeedAvg,
    scroll_pause_count: metrics.scrollPauseCount,
    scroll_direction_changes: metrics.scrollDirectionChanges,
    bot_consistency_score: metrics.botConsistencyScore,
  })
}

/**
 * Get historical metrics for a profile
 */
export function getHistoricalMetrics(profileId: string, limit: number = 10): BehaviorSessionMetrics[] {
  const db = Database.getInstance()
  const rows = db.getBehaviorSessions(profileId, limit)

  return rows.map((row: any) => ({
    sessionId: row.session_id as string,
    profileId: row.profile_id as string,
    timestamp: row.timestamp as string,
    mouseVelocityAvg: row.mouse_velocity_avg as number,
    mouseAccelerationVariance: row.mouse_acceleration_variance as number,
    mouseDirectionChanges: row.mouse_direction_changes as number,
    typingWPM: row.typing_wpm as number,
    typingVariance: row.typing_variance as number,
    typingPauseFrequency: row.typing_pause_frequency as number,
    scrollSpeedAvg: row.scroll_speed_avg as number,
    scrollPauseCount: row.scroll_pause_count as number,
    scrollDirectionChanges: row.scroll_direction_changes as number,
    botConsistencyScore: row.bot_consistency_score as number,
  }))
}

/**
 * Seeded RNG for deterministic testing
 */
function seededRng(seed: number) {
  let s = seed
  return function() {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

/**
 * Hash function
 */
function hashCode(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) >>> 0
  }
  return h
}
