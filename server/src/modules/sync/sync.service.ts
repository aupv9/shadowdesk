import { v4 as uuid } from 'uuid'
import { getDatabase } from '../../config/database'
import { notFound } from '../../utils/errors'
import type { SyncBundle, SyncManifest } from '../../types'

export class SyncService {
  async pushProfiles(userId: string, data: Buffer, checksum: string, profileCount: number): Promise<void> {
    const db = getDatabase()

    // Check if sync bundle exists
    const existing = await db('sync_bundles').where({ user_id: userId }).first()

    if (existing) {
      // Update existing bundle
      await db('sync_bundles').where({ id: existing.id }).update({
        data,
        checksum,
        profile_count: profileCount,
        updated_at: new Date()
      })
    } else {
      // Create new bundle
      await db('sync_bundles').insert({
        id: uuid(),
        user_id: userId,
        data,
        checksum,
        profile_count: profileCount,
        bundle_version: 1,
        created_at: new Date(),
        updated_at: new Date()
      })
    }

    // Log sync history
    await db('sync_history').insert({
      id: uuid(),
      user_id: userId,
      direction: 'push',
      profile_count: profileCount,
      status: 'success',
      created_at: new Date()
    })
  }

  async pullProfiles(userId: string): Promise<{ data: Buffer; checksum: string }> {
    const db = getDatabase()

    const bundle = await db('sync_bundles').where({ user_id: userId }).first()
    if (!bundle) {
      throw notFound('No sync data available')
    }

    // Log sync history
    await db('sync_history').insert({
      id: uuid(),
      user_id: userId,
      direction: 'pull',
      profile_count: bundle.profile_count,
      status: 'success',
      created_at: new Date()
    })

    return {
      data: bundle.data,
      checksum: bundle.checksum
    }
  }

  async getSyncManifest(userId: string): Promise<SyncManifest | null> {
    const db = getDatabase()

    const bundle = await db('sync_bundles').where({ user_id: userId }).first()
    if (!bundle) {
      return null
    }

    return {
      profile_ids: [], // In a real implementation, parse from bundle
      profile_count: bundle.profile_count,
      last_synced_at: bundle.updated_at
    }
  }

  async getSyncHistory(userId: string, limit = 20): Promise<any[]> {
    const db = getDatabase()

    return db('sync_history')
      .where({ user_id: userId })
      .orderBy('created_at', 'desc')
      .limit(limit)
  }
}

export const syncService = new SyncService()
