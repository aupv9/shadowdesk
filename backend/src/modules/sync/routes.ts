import type { FastifyInstance } from 'fastify'
import { SyncService } from './service.js'
import { requireAuth } from '../../shared/middleware/auth.js'
import { PushSyncSchema } from './schema.js'

export async function syncRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth)

  // POST /sync/push
  app.post('/push', async (req, reply) => {
    const input = PushSyncSchema.parse(req.body)
    await SyncService.push(req.user.sub, input)
    return reply.status(204).send()
  })

  // GET /sync/pull
  app.get('/pull', async (req, reply) => {
    const bundle = await SyncService.pull(req.user.sub)
    return reply.send({ data: bundle })
  })

  // GET /sync/manifest
  app.get('/manifest', async (req, reply) => {
    const manifest = await SyncService.getManifest(req.user.sub)
    return reply.send({ data: manifest })
  })

  // DELETE /sync/data  (wipe cloud data)
  app.delete('/data', async (req, reply) => {
    await SyncService.deleteData(req.user.sub)
    return reply.status(204).send()
  })
}
