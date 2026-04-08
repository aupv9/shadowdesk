import type { FastifyInstance } from 'fastify'
import { TeamService } from './service.js'
import { requireAuth } from '../../shared/middleware/auth.js'
import {
  CreateTeamSchema, UpdateTeamSchema, InviteMemberSchema,
  UpdateMemberRoleSchema, ShareProfileSchema, UnshareProfileSchema,
  AuditQuerySchema,
} from './schema.js'

export async function teamRoutes(app: FastifyInstance) {
  // All team routes require auth
  app.addHook('preHandler', requireAuth)

  // Team CRUD
  app.post('/', async (req, reply) => {
    const input = CreateTeamSchema.parse(req.body)
    const team = await TeamService.create(req.user.sub, input)
    return reply.status(201).send({ data: team })
  })

  app.get('/', async (req, reply) => {
    const team = await TeamService.get(req.user.sub)
    return reply.send({ data: team })
  })

  app.put('/', async (req, reply) => {
    const { name } = UpdateTeamSchema.parse(req.body)
    const team = await TeamService.update(req.user.sub, name)
    return reply.send({ data: team })
  })

  app.delete('/', async (req, reply) => {
    await TeamService.delete(req.user.sub)
    return reply.status(204).send()
  })

  // Members
  app.get('/members', async (req, reply) => {
    const members = await TeamService.getMembers(req.user.sub)
    return reply.send({ data: members })
  })

  app.put('/members/:userId', async (req, reply) => {
    const { userId } = req.params as { userId: string }
    const { role } = UpdateMemberRoleSchema.parse(req.body)
    const member = await TeamService.updateMemberRole(req.user.sub, userId, role)
    return reply.send({ data: member })
  })

  app.delete('/members/:userId', async (req, reply) => {
    const { userId } = req.params as { userId: string }
    await TeamService.removeMember(req.user.sub, userId)
    return reply.status(204).send()
  })

  // Invitations
  app.post('/invites', async (req, reply) => {
    const input = InviteMemberSchema.parse(req.body)
    const invite = await TeamService.invite(req.user.sub, input)
    return reply.status(201).send({ data: invite })
  })

  app.get('/invites', async (req, reply) => {
    const invites = await TeamService.getInvites(req.user.sub)
    return reply.send({ data: invites })
  })

  app.delete('/invites/:inviteId', async (req, reply) => {
    const { inviteId } = req.params as { inviteId: string }
    await TeamService.cancelInvite(req.user.sub, inviteId)
    return reply.status(204).send()
  })

  // Accept invite (public — user may not be logged in yet, but we require auth for simplicity)
  app.post('/invites/:token/accept', async (req, reply) => {
    const { token } = req.params as { token: string }
    await TeamService.acceptInvite(token, req.user.sub)
    return reply.status(204).send()
  })

  // Profile sharing
  app.post('/profiles/share', async (req, reply) => {
    const input = ShareProfileSchema.parse(req.body)
    await TeamService.shareProfile(req.user.sub, input)
    return reply.status(204).send()
  })

  app.get('/profiles/shared', async (req, reply) => {
    const profiles = await TeamService.getSharedProfiles(req.user.sub)
    return reply.send({ data: profiles })
  })

  app.delete('/profiles/share', async (req, reply) => {
    const { profile_id, member_id } = UnshareProfileSchema.parse(req.body)
    await TeamService.unshareProfile(req.user.sub, profile_id, member_id)
    return reply.status(204).send()
  })

  // Audit log
  app.get('/audit', async (req, reply) => {
    const query = AuditQuerySchema.parse(req.query)
    const result = await TeamService.getAuditLog(req.user.sub, query)
    return reply.send(result)
  })
}
