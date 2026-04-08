import type { FastifyInstance } from 'fastify'
import { LicenseService } from './service.js'
import { requireAuth } from '../../shared/middleware/auth.js'
import { rateLimits } from '../../shared/middleware/rate-limit.js'
import { ActivateLicenseSchema, DeactivateDeviceSchema } from './schema.js'

export async function licenseRoutes(app: FastifyInstance) {

  // GET /licenses/current
  app.get('/current', { preHandler: requireAuth }, async (req, reply) => {
    const machineId = (req.query as { machine_id?: string }).machine_id
    const license = await LicenseService.getCurrent(req.user.sub, machineId)
    return reply.send({ data: license })
  })

  // POST /licenses/activate
  app.post('/activate', {
    preHandler: requireAuth,
    config: { rateLimit: rateLimits.licenseActivate },
  }, async (req, reply) => {
    const input = ActivateLicenseSchema.parse(req.body)
    const license = await LicenseService.activate(req.user.sub, input)
    return reply.send({ data: license })
  })

  // POST /licenses/deactivate  (current machine)
  app.post('/deactivate', { preHandler: requireAuth }, async (req, reply) => {
    const { machine_id } = DeactivateDeviceSchema.parse(req.body)
    await LicenseService.deactivateCurrent(req.user.sub, machine_id)
    return reply.status(204).send()
  })

  // GET /licenses/devices
  app.get('/devices', { preHandler: requireAuth }, async (req, reply) => {
    const devices = await LicenseService.getDevices(req.user.sub)
    return reply.send({ data: devices })
  })

  // DELETE /licenses/devices/:machineId
  app.delete('/devices/:machineId', { preHandler: requireAuth }, async (req, reply) => {
    const { machineId } = req.params as { machineId: string }
    await LicenseService.removeDevice(req.user.sub, machineId)
    return reply.status(204).send()
  })
}
