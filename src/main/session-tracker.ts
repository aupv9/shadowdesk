import { v4 as uuidv4 } from 'uuid'
import { Database } from './database'

export interface SessionRecord {
  id: string
  profile_id: string
  profile_name: string
  started_at: string
  ended_at: string | null
  duration_ms: number
  pages_visited: number
  proxy_used: string | null
  status: 'active' | 'completed' | 'crashed'
}

export class SessionTracker {
  private static instance: SessionTracker
  private activeSessions = new Map<string, { id: string; startedAt: number; pages: number }>()

  static getInstance(): SessionTracker {
    if (!SessionTracker.instance) {
      SessionTracker.instance = new SessionTracker()
    }
    return SessionTracker.instance
  }

  /**
   * Called when a browser profile is launched.
   * Returns the session ID for later reference.
   */
  startSession(profileId: string, profileName: string, proxyLabel?: string | null): string {
    const db = Database.getInstance()
    const sessionId = uuidv4()
    const now = new Date().toISOString()

    db.createSession({
      id: sessionId,
      profile_id: profileId,
      profile_name: profileName,
      started_at: now,
      proxy_used: proxyLabel ?? null
    })

    this.activeSessions.set(profileId, {
      id: sessionId,
      startedAt: Date.now(),
      pages: 0
    })

    return sessionId
  }

  /**
   * Called when a browser profile is closed normally.
   */
  endSession(profileId: string): void {
    const active = this.activeSessions.get(profileId)
    if (!active) return

    const db = Database.getInstance()
    const durationMs = Date.now() - active.startedAt
    const now = new Date().toISOString()

    db.endSession(active.id, {
      ended_at: now,
      duration_ms: durationMs,
      pages_visited: active.pages,
      status: 'completed'
    })

    this.activeSessions.delete(profileId)
  }

  /**
   * Called when a browser disconnects unexpectedly.
   */
  crashSession(profileId: string): void {
    const active = this.activeSessions.get(profileId)
    if (!active) return

    const db = Database.getInstance()
    const durationMs = Date.now() - active.startedAt
    const now = new Date().toISOString()

    db.endSession(active.id, {
      ended_at: now,
      duration_ms: durationMs,
      pages_visited: active.pages,
      status: 'crashed'
    })

    this.activeSessions.delete(profileId)
  }

  /**
   * Increment page visit count for an active session.
   */
  recordPageVisit(profileId: string): void {
    const active = this.activeSessions.get(profileId)
    if (active) {
      active.pages++
    }
  }

  /**
   * Get all currently active session profile IDs.
   */
  getActiveProfileIds(): string[] {
    return Array.from(this.activeSessions.keys())
  }

  /**
   * Mark any remaining active sessions as crashed (e.g. on app quit).
   */
  markAllActiveCrashed(): void {
    for (const profileId of this.activeSessions.keys()) {
      this.crashSession(profileId)
    }
  }
}
