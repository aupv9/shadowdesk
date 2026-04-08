import { Queue, Worker, type Job } from 'bullmq'
import { env } from '../../config.js'
import { db } from '../../db/client.js'
import { webhooks, webhookDeliveries } from '../../db/schema.js'
import { eq } from 'drizzle-orm'
import { buildWebhookSignature } from '../../shared/crypto.js'
import { nanoid } from 'nanoid'

export interface WebhookJobData {
  webhookId: string
  event:     string
  payload:   Record<string, unknown>
}

const connection = { url: env.REDIS_URL }

// Queue — enqueue from service
export const webhookQueue = new Queue<WebhookJobData>('webhook-delivery', {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 30_000 }, // 30s, 1m, 2m, 4m, 8m
    removeOnComplete: { age: 7 * 24 * 3600 },         // keep 7 days
    removeOnFail:     { age: 30 * 24 * 3600 },         // keep 30 days for debugging
  },
})

// Worker — delivery logic
export function startWebhookWorker() {
  const worker = new Worker<WebhookJobData>(
    'webhook-delivery',
    async (job: Job<WebhookJobData>) => {
      const { webhookId, event, payload } = job.data

      const [webhook] = await db
        .select()
        .from(webhooks)
        .where(eq(webhooks.id, webhookId))
        .limit(1)

      if (!webhook || !webhook.enabled) return  // silently skip

      const deliveryId = nanoid()
      const timestamp  = Math.floor(Date.now() / 1000)
      const body       = JSON.stringify({ id: deliveryId, event, timestamp, data: payload })

      const headers: Record<string, string> = {
        'Content-Type':              'application/json',
        'X-ShadowDesk-Event':        event,
        'X-ShadowDesk-Delivery':     deliveryId,
        'X-ShadowDesk-Timestamp':    String(timestamp),
        'User-Agent':                'ShadowDesk-Webhook/1.0',
      }

      if (webhook.secret) {
        headers['X-ShadowDesk-Signature'] = buildWebhookSignature(webhook.secret, timestamp, body)
      }

      const controller = new AbortController()
      const timeout    = setTimeout(() => controller.abort(), 10_000) // 10s

      let responseStatus: number | null = null
      let responseBody:   string | null = null

      try {
        const res = await fetch(webhook.url, {
          method:  'POST',
          headers,
          body,
          signal:  controller.signal,
        })

        responseStatus = res.status
        responseBody   = await res.text().catch(() => null)

        // Record delivery
        await db.insert(webhookDeliveries).values({
          webhookId,
          event,
          payload,
          responseStatus,
          responseBody: responseBody?.slice(0, 2000),  // cap at 2KB
          attempt: (job.attemptsMade ?? 0) + 1,
        })

        // Update last triggered
        await db.update(webhooks).set({
          lastTriggeredAt: new Date(),
          lastStatus:      responseStatus,
          updatedAt:       new Date(),
        }).where(eq(webhooks.id, webhookId))

        // Retry on 5xx
        if (responseStatus >= 500) {
          throw new Error(`Server error: ${responseStatus}`)
        }

      } finally {
        clearTimeout(timeout)
      }
    },
    { connection, concurrency: 10 }
  )

  worker.on('failed', (job, err) => {
    console.error(`Webhook job ${job?.id} failed:`, err.message)
  })

  return worker
}
