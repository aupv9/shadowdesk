import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { env } from '../config/env'
import { internalError } from './errors'
import { logger } from './logger'

/**
 * Object storage adapter backed by Supabase Storage.
 *
 * Used for binary blobs that don't belong in Postgres: user avatars,
 * support-ticket attachments, and cloud-profile bundles. Relational data
 * stays in Postgres (Knex); only the blobs live in Supabase buckets.
 *
 * Configuration is optional — if SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are
 * unset, upload calls throw a clear `storage_not_configured` error so the
 * failure is obvious in development rather than silently corrupting data.
 */

let client: SupabaseClient | null = null

export function isStorageConfigured(): boolean {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY)
}

function getClient(): SupabaseClient {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw internalError(
      'Supabase Storage is not configured (set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)',
      'storage_not_configured'
    )
  }
  if (!client) {
    client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  }
  return client
}

/** Upload a buffer to a bucket and return its public URL. Overwrites on conflict. */
export async function uploadBlob(
  bucket: string,
  path: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const supabase = getClient()

  const { error } = await supabase.storage.from(bucket).upload(path, buffer, {
    contentType,
    upsert: true
  })

  if (error) {
    logger.error('Supabase upload failed', { bucket, path, error: error.message })
    throw internalError(`Storage upload failed: ${error.message}`, 'storage_upload_failed')
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

/** Delete a blob. Best-effort — never throws if storage isn't configured. */
export async function deleteBlob(bucket: string, path: string): Promise<void> {
  if (!isStorageConfigured()) return
  const supabase = getClient()
  const { error } = await supabase.storage.from(bucket).remove([path])
  if (error) {
    logger.warn('Supabase delete failed', { bucket, path, error: error.message })
  }
}
