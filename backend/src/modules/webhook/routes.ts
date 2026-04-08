import type { FastifyInstance } from 'fastify'
import { WebhookService } from './service.js'
import { requireAuth } from '../../shared/middleware/auth.js'
import { rateLimits } from '../../shared/middleware/rate-limit.js'
import { CreateWebhookSchema, UpdateWebhookSchema } from './schema.js'

export async function webhookRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth)

  app.get('/', async (req, reply) => {
    const webhooks = await WebhookService.list(req.user.sub)
    return reply.send({ data: webhooks })
  })

  app.post('/', async (req, reply) => {
    const input = CreateWebhookSchema.parse(req.body)
    const webhook = await WebhookService.create(req.user.sub, input)
    return reply.status(201).send({ data: webhook })
  })

  app.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const webhook = await WebhookService.get(req.user.sub, id)
    return reply.send({ data: webhook })
  })

  app.put('/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const input = UpdateWebhookSchema.parse(req.body)
    const webhook = await WebhookService.update(req.user.sub, id, input)
    return reply.send({ data: webhook })
  })

  app.delete('/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    await WebhookService.delete(req.user.sub, id)
    return reply.status(204).send()
  })

  app.post('/:id/test', {
    config: { rateLimit: rateLimits.webhookTest },
  }, async (req, reply) => {
    const { id } = req.params as { id: string }
    await WebhookService.sendTest(req.user.sub, id)
    return reply.send({ data: { message: 'Test event queued' } })
  })

  app.get('/:id/deliveries', async (req, reply) => {
    const { id } = req.params as { id: string }
    const deliveries = await WebhookService.getDeliveries(req.user.sub, id)
    return reply.send({ data: deliveries })
  })
}
