import { z } from 'zod'

export const WEBHOOK_EVENTS = [
  'profile.created', 'profile.launched', 'profile.closed',
  'detection.completed', 'schedule.completed', 'license.expiring',
] as const

export type WebhookEvent = typeof WEBHOOK_EVENTS[number]

export const CreateWebhookSchema = z.object({
  name:   z.string().min(1).max(100),
  url:    z.string().url(),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1),
  secret: z.string().min(16).optional(),
})

export const UpdateWebhookSchema = z.object({
  name:    z.string().min(1).max(100).optional(),
  url:     z.string().url().optional(),
  events:  z.array(z.enum(WEBHOOK_EVENTS)).min(1).optional(),
  secret:  z.string().min(16).optional().nullable(),
  enabled: z.boolean().optional(),
})

export type CreateWebhookInput = z.infer<typeof CreateWebhookSchema>
export type UpdateWebhookInput = z.infer<typeof UpdateWebhookSchema>
