import { v4 as uuidv4 } from 'uuid'
import { Database } from './database'
import type {
  CrossProfileSyncGroup,
  SyncEvent,
  CreateSyncGroupInput,
  SyncStrategyType
} from '../shared/types'

/**
 * Phase 19.3 — Cross-Profile Behavior Synchronization
 *
 * Manages sync groups of profiles that share behavioral insights:
 * - cookie_share:    Copy cookie/session state between profiles
 * - behavior_mirror: Clone behavior archetype settings across profiles
 * - detection_share: Share detection test insights (which vectors fail)
 *                    so all profiles in a group benefit from one profile's test
 */
export class CrossProfileSyncService {
  private static instance: CrossProfileSyncService

  static getInstance(): CrossProfileSyncService {
    if (!CrossProfileSyncService.instance) {
      CrossProfileSyncService.instance = new CrossProfileSyncService()
    }
    return CrossProfileSyncService.instance
  }

  /** Create a new sync group */
  createGroup(input: CreateSyncGroupInput): CrossProfileSyncGroup {
    const db = Database.getInstance()
    const group: CrossProfileSyncGroup = {
      id: uuidv4(),
      name: input.name,
      profile_ids: input.profileIds,
      strategy: input.strategy,
      enabled: true,
      last_synced_at: null,
      created_at: new Date().toISOString()
    }

    db.createCrossProfileSyncGroup(group)
    return group
  }

  /** List all sync groups */
  listGroups(): CrossProfileSyncGroup[] {
    return Database.getInstance().listCrossProfileSyncGroups()
  }

  /** Get a single sync group */
  getGroup(groupId: string): CrossProfileSyncGroup | null {
    return Database.getInstance().getCrossProfileSyncGroup(groupId)
  }

  /** Update a sync group */
  updateGroup(
    groupId: string,
    patch: Partial<Pick<CrossProfileSyncGroup, 'name' | 'profile_ids' | 'strategy' | 'enabled'>>
  ): CrossProfileSyncGroup | null {
    const db = Database.getInstance()
    db.updateCrossProfileSyncGroup(groupId, patch)
    return db.getCrossProfileSyncGroup(groupId)
  }

  /** Delete a sync group */
  deleteGroup(groupId: string): void {
    Database.getInstance().deleteCrossProfileSyncGroup(groupId)
  }

  /**
   * Execute synchronization for a group.
   * The source profile's data is copied to all target profiles in the group.
   */
  async syncGroup(groupId: string, sourceProfileId: string): Promise<SyncEvent> {
    const db = Database.getInstance()
    const group = db.getCrossProfileSyncGroup(groupId)
    if (!group) throw new Error(`Sync group ${groupId} not found`)
    if (!group.enabled) throw new Error('Sync group is disabled')

    const targetIds = (group.profile_ids as string[]).filter((id: string) => id !== sourceProfileId)
    if (targetIds.length === 0) {
      throw new Error('No target profiles to sync to')
    }

    let dataSynced = ''

    switch (group.strategy) {
      case 'cookie_share':
        dataSynced = this.syncCookies(sourceProfileId, targetIds)
        break
      case 'behavior_mirror':
        dataSynced = this.syncBehavior(sourceProfileId, targetIds)
        break
      case 'detection_share':
        dataSynced = this.syncDetectionInsights(sourceProfileId, targetIds)
        break
    }

    const event: SyncEvent = {
      id: uuidv4(),
      group_id: groupId,
      source_profile_id: sourceProfileId,
      target_profile_ids: targetIds,
      strategy: group.strategy,
      data_synced: dataSynced,
      synced_at: new Date().toISOString()
    }

    db.addCrossProfileSyncEvent(event)
    db.updateCrossProfileSyncGroup(groupId, {
      last_synced_at: event.synced_at
    })

    return event
  }

  private syncCookies(sourceId: string, targetIds: string[]): string {
    const db = Database.getInstance()
    const source = db.getProfile(sourceId) as any
    if (!source) throw new Error(`Source profile ${sourceId} not found`)

    const cookies = source.cookies || '[]'
    let synced = 0

    for (const targetId of targetIds) {
      const target = db.getProfile(targetId) as any
      if (!target) continue
      db.updateProfile(targetId, { cookies })
      synced++
    }

    return `Synced cookies to ${synced} profiles`
  }

  private syncBehavior(sourceId: string, targetIds: string[]): string {
    const db = Database.getInstance()
    const source = db.getProfile(sourceId) as any
    if (!source) throw new Error(`Source profile ${sourceId} not found`)

    const fp = typeof source.fingerprint === 'string'
      ? JSON.parse(source.fingerprint)
      : source.fingerprint

    const behaviorConfig = fp?.behavior || null
    if (!behaviorConfig) {
      return 'No behavior config found on source profile'
    }

    let synced = 0
    for (const targetId of targetIds) {
      const target = db.getProfile(targetId) as any
      if (!target) continue

      const targetFp = typeof target.fingerprint === 'string'
        ? JSON.parse(target.fingerprint)
        : target.fingerprint

      targetFp.behavior = { ...behaviorConfig }
      db.updateProfile(targetId, {
        fingerprint: JSON.stringify(targetFp)
      })
      synced++
    }

    return `Synced behavior config to ${synced} profiles`
  }

  private syncDetectionInsights(sourceId: string, targetIds: string[]): string {
    const db = Database.getInstance()
    const sourceResults = db.getDetectionTestResults(sourceId)

    if (sourceResults.length === 0) {
      return 'No detection results to share'
    }

    // Get the latest test result from the source
    const latest = sourceResults[0]
    const failedVectors = latest.vectors
      ? (typeof latest.vectors === 'string' ? JSON.parse(latest.vectors as string) : latest.vectors)
          .filter((v: any) => !v.passed)
          .map((v: any) => v.name)
      : []

    return `Shared detection insights: ${failedVectors.length} failing vectors identified from ${sourceResults.length} test runs`
  }

  /** Get sync history for a group */
  getSyncHistory(groupId: string, limit: number = 20): SyncEvent[] {
    return Database.getInstance().getCrossProfileSyncEvents(groupId, limit)
  }
}
