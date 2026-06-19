import { v4 as uuid } from 'uuid'
import { getDatabase } from '../../config/database'
import type { RemoteConfig, FeatureFlag, Announcement, FingerprintPresetUpdate } from '../../types'

export class ConfigService {
  /** Build the full client config: feature flags, settings, active announcements. */
  async getClientConfig(userId: string): Promise<RemoteConfig> {
    const db = getDatabase()

    const flagRows = await db('feature_flags')
    const flags: FeatureFlag[] = flagRows.map((f) => ({
      key: f.key,
      enabled: Boolean(f.enabled),
      variant: f.variant ?? undefined,
      metadata: f.metadata ?? undefined
    }))

    const settingRows = await db('remote_settings')
    const settings: Record<string, unknown> = {}
    let minimumVersion: string | null = null
    for (const row of settingRows) {
      if (row.key === 'minimum_version') {
        minimumVersion = typeof row.value === 'string' ? row.value : (row.value ?? null)
      } else {
        settings[row.key] = row.value
      }
    }

    const now = new Date()
    const annRows = await db('announcements')
      .where('starts_at', '<=', now)
      .andWhere((b) => b.whereNull('ends_at').orWhere('ends_at', '>=', now))
      .orderBy('starts_at', 'desc')

    const dismissedRows = await db('announcement_dismissals')
      .where({ user_id: userId })
      .select('announcement_id')
    const dismissed = new Set(dismissedRows.map((d) => d.announcement_id))

    const announcements: Announcement[] = annRows
      .filter((a) => !dismissed.has(a.id))
      .map((a) => ({
        id: a.id,
        type: a.type,
        title: a.title,
        message: a.message,
        action_url: a.action_url ?? undefined,
        action_label: a.action_label ?? undefined,
        dismissible: Boolean(a.dismissible),
        starts_at: a.starts_at,
        ends_at: a.ends_at ?? null
      }))

    return {
      flags,
      settings,
      announcements,
      minimum_version: minimumVersion,
      fetched_at: new Date().toISOString()
    }
  }

  async getPresetUpdates(): Promise<FingerprintPresetUpdate[]> {
    const db = getDatabase()
    const rows = await db('preset_updates').orderBy('published_at', 'desc')
    return rows.map((r) => ({
      preset_key: r.preset_key,
      version: r.version,
      changes: r.changes ?? {},
      description: r.description ?? '',
      published_at: r.published_at
    }))
  }

  async dismissAnnouncement(userId: string, announcementId: string): Promise<void> {
    const db = getDatabase()
    await db('announcement_dismissals')
      .insert({ id: uuid(), announcement_id: announcementId, user_id: userId, dismissed_at: new Date() })
      .onConflict(['announcement_id', 'user_id'])
      .ignore()
  }
}

export const configService = new ConfigService()
