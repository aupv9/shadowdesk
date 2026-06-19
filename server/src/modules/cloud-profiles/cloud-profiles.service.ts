import { v4 as uuid } from 'uuid'
import { getDatabase } from '../../config/database'
import { notFound, forbidden } from '../../utils/errors'
import type { CloudProfile, CloudProfileDetail, BackupResult, CloudProfileListResult } from '../../types'

const STORAGE_LIMIT_BYTES = 5 * 1024 * 1024 * 1024 // 5 GB default quota

export interface BackupInput {
  local_id: string
  name: string
  fingerprint: string
  fingerprint_hash: string
  preset: string
  proxy_config: { type: string; country?: string } | null
  cookies: string | null
  notes: string | null
  tags: string[]
}

export class CloudProfileService {
  async list(
    userId: string,
    opts: { page: number; limit: number; search?: string; tag?: string }
  ): Promise<CloudProfileListResult> {
    const db = getDatabase()
    const scoped = () => {
      let q = db('cloud_profiles').where({ user_id: userId })
      if (opts.search) q = q.whereILike('name', `%${opts.search}%`)
      if (opts.tag) q = q.whereRaw('tags @> ?::jsonb', [JSON.stringify([opts.tag])])
      return q
    }

    const rows = await scoped()
      .orderBy('updated_at', 'desc')
      .limit(opts.limit)
      .offset((opts.page - 1) * opts.limit)
    const totalRow = await scoped().count({ count: '*' }).first()
    const sumRow = await db('cloud_profiles').where({ user_id: userId }).sum({ used: 'size_bytes' }).first()

    return {
      profiles: rows.map((r) => this.format(r)),
      total: Number(totalRow?.count ?? 0),
      storage_used_bytes: Number(sumRow?.used ?? 0),
      storage_limit_bytes: STORAGE_LIMIT_BYTES
    }
  }

  async backup(userId: string, input: BackupInput): Promise<BackupResult> {
    const db = getDatabase()
    const now = new Date()
    const sizeBytes =
      Buffer.byteLength(input.fingerprint || '', 'utf8') + Buffer.byteLength(input.cookies || '', 'utf8')

    // Re-backing-up the same local profile overwrites the prior cloud copy.
    const existing = input.local_id
      ? await db('cloud_profiles').where({ user_id: userId, local_id: input.local_id }).first()
      : null

    const record = {
      name: input.name,
      fingerprint_hash: input.fingerprint_hash,
      preset: input.preset,
      proxy_config: input.proxy_config ? JSON.stringify(input.proxy_config) : null,
      tags: JSON.stringify(input.tags ?? []),
      notes: input.notes,
      fingerprint: input.fingerprint,
      cookies: input.cookies,
      size_bytes: sizeBytes,
      updated_at: now
    }

    let id: string
    if (existing) {
      id = existing.id
      await db('cloud_profiles').where({ id }).update(record)
    } else {
      id = uuid()
      await db('cloud_profiles').insert({
        id,
        user_id: userId,
        local_id: input.local_id ?? null,
        created_at: now,
        ...record
      })
    }

    return { cloud_id: id, fingerprint_hash: input.fingerprint_hash, backed_up_at: now.toISOString(), size_bytes: sizeBytes }
  }

  async getDetail(userId: string, id: string): Promise<CloudProfileDetail> {
    const row = await this.requireOwned(userId, id)
    return {
      ...this.format(row),
      fingerprint: row.fingerprint,
      cookies: row.cookies ?? null,
      user_data_snapshot: false
    }
  }

  async updateTags(userId: string, id: string, tags: string[]): Promise<CloudProfile> {
    const db = getDatabase()
    await this.requireOwned(userId, id)
    await db('cloud_profiles').where({ id }).update({ tags: JSON.stringify(tags), updated_at: new Date() })
    const row = await db('cloud_profiles').where({ id }).first()
    return this.format(row)
  }

  async remove(userId: string, id: string): Promise<void> {
    const db = getDatabase()
    await this.requireOwned(userId, id)
    await db('cloud_profiles').where({ id }).delete()
  }

  async bulkDelete(userId: string, ids: string[]): Promise<void> {
    const db = getDatabase()
    await db('cloud_profiles').where({ user_id: userId }).whereIn('id', ids).delete()
  }

  async usage(userId: string): Promise<{ used_bytes: number; limit_bytes: number; profile_count: number }> {
    const db = getDatabase()
    const sumRow = await db('cloud_profiles').where({ user_id: userId }).sum({ used: 'size_bytes' }).first()
    const countRow = await db('cloud_profiles').where({ user_id: userId }).count({ count: '*' }).first()
    return {
      used_bytes: Number(sumRow?.used ?? 0),
      limit_bytes: STORAGE_LIMIT_BYTES,
      profile_count: Number(countRow?.count ?? 0)
    }
  }

  private async requireOwned(userId: string, id: string): Promise<any> {
    const db = getDatabase()
    const row = await db('cloud_profiles').where({ id }).first()
    if (!row) throw notFound('Cloud profile not found')
    if (row.user_id !== userId) throw forbidden('Not your cloud profile')
    return row
  }

  private format(row: any): CloudProfile {
    return {
      id: row.id,
      local_id: row.local_id ?? null,
      name: row.name,
      fingerprint_hash: row.fingerprint_hash,
      preset: row.preset,
      proxy_config: row.proxy_config ?? null,
      tags: row.tags ?? [],
      notes: row.notes ?? null,
      backed_up_at: row.updated_at,
      updated_at: row.updated_at,
      size_bytes: row.size_bytes ?? 0
    }
  }
}

export const cloudProfileService = new CloudProfileService()
