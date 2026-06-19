import { v4 as uuid } from 'uuid'
import { getDatabase } from '../../config/database'
import { notFound, forbidden } from '../../utils/errors'
import { generateToken, hashToken } from '../../utils/crypto'
import type { ApiKeyInfo, ApiKeyUsage } from '../../types'

export interface CreateApiKeyInput {
  name: string
  scopes: string[]
  expires_in?: number
}

/** Generate a fresh API key, returning the plaintext, its hash and a display prefix. */
function generateApiKey(): { key: string; hash: string; prefix: string } {
  const key = `gbk_${generateToken(24)}`
  return { key, hash: hashToken(key), prefix: key.slice(0, 12) }
}

function periodStart(period: string): Date {
  const days = period === 'day' ? 1 : period === 'month' ? 30 : period === 'year' ? 365 : 7
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

export class ApiKeyService {
  async list(userId: string): Promise<ApiKeyInfo[]> {
    const db = getDatabase()
    const rows = await db('api_keys')
      .where({ user_id: userId })
      .whereNull('revoked_at')
      .orderBy('created_at', 'desc')
    return rows.map((r) => this.format(r))
  }

  async create(userId: string, input: CreateApiKeyInput): Promise<ApiKeyInfo> {
    const db = getDatabase()
    const { key, hash, prefix } = generateApiKey()
    const id = uuid()
    const now = new Date()
    const expiresAt = input.expires_in ? new Date(now.getTime() + input.expires_in * 86400000) : null

    await db('api_keys').insert({
      id,
      user_id: userId,
      name: input.name,
      key_hash: hash,
      prefix,
      scopes: JSON.stringify(input.scopes),
      expires_at: expiresAt,
      created_at: now
    })

    const row = await db('api_keys').where({ id }).first()
    // `key` (plaintext) is returned exactly once, on creation.
    return { ...this.format(row), key }
  }

  async rotate(userId: string, keyId: string): Promise<ApiKeyInfo> {
    const db = getDatabase()
    const existing = await this.requireOwned(userId, keyId)
    const { key, hash, prefix } = generateApiKey()
    await db('api_keys').where({ id: existing.id }).update({ key_hash: hash, prefix, revoked_at: null })
    const row = await db('api_keys').where({ id: existing.id }).first()
    return { ...this.format(row), key }
  }

  async remove(userId: string, keyId: string): Promise<void> {
    const db = getDatabase()
    const existing = await this.requireOwned(userId, keyId)
    await db('api_keys').where({ id: existing.id }).delete()
  }

  async usage(userId: string, keyId: string, period: string): Promise<ApiKeyUsage> {
    const db = getDatabase()
    await this.requireOwned(userId, keyId)
    const since = periodStart(period)
    const totalRow = await db('api_key_usage')
      .where({ api_key_id: keyId })
      .andWhere('created_at', '>=', since)
      .count({ count: '*' })
      .first()

    return {
      key_id: keyId,
      total_requests: Number(totalRow?.count ?? 0),
      period,
      breakdown: {}
    }
  }

  private async requireOwned(userId: string, keyId: string): Promise<any> {
    const db = getDatabase()
    const row = await db('api_keys').where({ id: keyId }).first()
    if (!row) throw notFound('API key not found')
    if (row.user_id !== userId) throw forbidden('Not your API key')
    return row
  }

  private format(row: any): ApiKeyInfo {
    return {
      id: row.id,
      name: row.name,
      scopes: row.scopes ?? [],
      created_at: row.created_at,
      expires_at: row.expires_at ?? null,
      last_used_at: row.last_used_at ?? null
    }
  }
}

export const apiKeyService = new ApiKeyService()
