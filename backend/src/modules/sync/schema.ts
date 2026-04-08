import { z } from 'zod'

export const PushSyncSchema = z.object({
  data:          z.string().min(1),   // base64-encoded AES-256-GCM ciphertext
  checksum:      z.string().length(64), // SHA256 hex of plaintext
  profile_count: z.number().int().min(0),
})

export type PushSyncInput = z.infer<typeof PushSyncSchema>
