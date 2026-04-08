import { eq, and, desc } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { webhooks, webhookDeliveries, licenses } from '../../db/schema.js'
import { AppError } from '../../shared/errors.js'
import { webhookQueue } from './queue.js'
import type { CreateWebhookInput, UpdateWebhookInput, WebhookEvent } from './schema.js'

const PLAN_WEBHOOK_LIMITS: Record<string, number> = {
  free: 1, starter: 5, professional: 20, enterprise: -1,
}

async function getWebhookLimit(userId: string): Promise<number> {
  const [license] = await db
    .select({ plan: licenses.plan })
    .from(licenses)
    .where(eq(licenses.userId, userId))
    .limit(1)
  return PLAN_WEBHOOK_LIMITS[license?.plan ?? 'free'] ?? 1
}

export const WebhookService = {
  async list(userId: string) {
    return db.select().from(webhooks).where(eq(webhooks.userId, userId))
  },

  async get(userId: string, webhookId: string) {
    const [webhook] = await db
      .select()
      .from(webhooks)
      .where(and(eq(webhooks.id, webhookId), eq(webhooks.userId, userId)))
      .limit(1)

    if (!webhook) throw new AppError('WEBHOOK_NOT_FOUND', 'Webhook not found')
    return webhook
  },

  async create(userId: string, input: CreateWebhookInput) {
    const limit = await getWebhookLimit(userId)
    if (limit !== -1) {
      const existing = await db.select().from(webhooks).where(eq(webhooks.userId, userId))
      if (existing.length >= limit) {
        throw new AppError('WEBHOOK_LIMIT_EXCEEDED', `Your plan allows up to ${limit} webhook(s)`)
      }
    }

    const [webhook] = await db.insert(webhooks).values({
      userId,
      name:   input.name,
      url:    input.url,
      events: input.events,
      secret: input.secret ?? null,
    }).returning()

    return webhook
  },

  async update(userId: string, webhookId: string, input: UpdateWebhookInput) {
    const webhook = await WebhookService.get(userId, webhookId)

    const [updated] = await db.update(webhooks).set({
      ...(input.name    !== undefined && { name: input.name }),
      ...(input.url     !== undefined && { url: input.url }),
      ...(input.events  !== undefined && { events: input.events }),
      ...(input.secret  !== undefined && { secret: input.secret }),
      ...(input.enabled !== undefined && { enabled: input.enabled }),
      updatedAt: new Date(),
    }).where(eq(webhooks.id, webhook.id)).returning()

    return updated
  },

  async delete(userId: string, webhookId: string) {
    await WebhookService.get(userId, webhookId)
    await db.delete(webhooks).where(eq(webhooks.id, webhookId))
  },

  async sendTest(userId: string, webhookId: string) {
    const webhook = await WebhookService.get(userId, webhookId)
    await webhookQueue.add('test', {
      webhookId: webhook.id,
      event:     'profile.launched',
      payload:   { test: true, profile_id: 'test-profile-id', profile_name: 'Test Profile' },
    })
  },

  async getDeliveries(userId: string, webhookId: string) {
    await WebhookService.get(userId, webhookId)
    return db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.webhookId, webhookId))
      .orderBy(desc(webhookDeliveries.deliveredAt))
      .limit(100)
  },

  // Called by other modules to dispatch events
  async dispatch(userId: string, event: WebhookEvent, payload: Record<string, unknown>) {
    const userWebhooks = await db
      .select({ id: webhooks.id })
      .from(webhooks)
      .where(and(eq(webhooks.userId, userId), eq(webhooks.enabled, true)))

    for (const webhook of userWebhooks) {
      const [full] = await db.select().from(webhooks).where(eq(webhooks.id, webhook.id)).limit(1)
      if (full?.events.includes(event)) {
        await webhookQueue.add(event, { webhookId: webhook.id, event, payload })
      }
    }
  },
}
