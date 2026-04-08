import { eq } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { syncBundles, syncLogs, licenses } from '../../db/schema.js'
import { AppError } from '../../shared/errors.js'
import type { PushSyncInput } from './schema.js'

// Plan check helper
async function assertSyncEnabled(userId: string) {
  const [license] = await db
    .select({ plan: licenses.plan, status: licenses.status })
    .from(licenses)
    .where(eq(licenses.userId, userId))
    .limit(1)

  const plan = license?.plan ?? 'free'
  const syncEnabled: Record<string, boolean> = {
    free: false, starter: true, professional: true, enterprise: true,
  }

  if (!syncEnabled[plan]) {
    throw new AppError('SYNC_NOT_ENABLED', 'Cloud sync requires a Starter plan or higher')
  }
}

export const SyncService = {
  async push(userId: string, input: PushSyncInput): Promise<void> {
    await assertSyncEnabled(userId)

    const dataBuffer = Buffer.from(input.data, 'base64')

    const [existing] = await db
      .select({ id: syncBundles.id, version: syncBundles.version })
      .from(syncBundles)
      .where(eq(syncBundles.userId, userId))
      .limit(1)

    if (existing) {
      await db.update(syncBundles).set({
        data:         dataBuffer,
        checksum:     input.checksum,
        profileCount: input.profile_count,
        version:      existing.version + 1,
        updatedAt:    new Date(),
      }).where(eq(syncBundles.id, existing.id))
    } else {
      await db.insert(syncBundles).values({
        userId,
        data:         dataBuffer,
        checksum:     input.checksum,
        profileCount: input.profile_count,
      })
    }

    await db.insert(syncLogs).values({
      userId,
      direction:    'push',
      profileCount: input.profile_count,
      status:       'success',
    })
  },

  async pull(userId: string): Promise<{ data: string; checksum: string; profile_count: number; version: number }> {
    await assertSyncEnabled(userId)

    const [bundle] = await db
      .select()
      .from(syncBundles)
      .where(eq(syncBundles.userId, userId))
      .limit(1)

    if (!bundle) {
      throw new AppError('SYNC_NO_DATA', 'No sync data found for this account')
    }

    await db.insert(syncLogs).values({
      userId,
      direction:    'pull',
      profileCount: bundle.profileCount,
      status:       'success',
    })

    return {
      data:          Buffer.from(bundle.data).toString('base64'),
      checksum:      bundle.checksum,
      profile_count: bundle.profileCount,
      version:       bundle.version,
    }
  },

  async getManifest(userId: string) {
    await assertSyncEnabled(userId)

    const [bundle] = await db
      .select({
        version:      syncBundles.version,
        profileCount: syncBundles.profileCount,
        checksum:     syncBundles.checksum,
        updatedAt:    syncBundles.updatedAt,
      })
      .from(syncBundles)
      .where(eq(syncBundles.userId, userId))
      .limit(1)

    if (!bundle) {
      return { version: 0, profile_count: 0, checksum: null, last_modified: null }
    }

    return {
      version:       bundle.version,
      profile_count: bundle.profileCount,
      checksum:      bundle.checksum,
      last_modified: bundle.updatedAt,
    }
  },

  async deleteData(userId: string): Promise<void> {
    await assertSyncEnabled(userId)
    await db.delete(syncBundles).where(eq(syncBundles.userId, userId))
  },
}
