import { Request, Response } from 'express'
import { teamService } from './team.service'
import { invitesService } from './invites.service'
import { sharedProfilesService } from './shared-profiles.service'
import { auditService } from './audit.service'
import {
  validate,
  createTeamSchema,
  updateTeamSchema,
  inviteMemberSchema,
  updateMemberSchema,
  shareProfileSchema
} from '../../utils/validators'
import { unauthorized } from '../../utils/errors'
import { logger } from '../../utils/logger'

function userId(req: Request): string {
  if (!req.userId) throw unauthorized('User not authenticated')
  return req.userId
}

export class TeamController {
  // ── Team CRUD ──────────────────────────────────────────────────────────

  async createTeam(req: Request, res: Response): Promise<void> {
    const uid = userId(req)
    const { name } = validate<{ name: string }>(req.body, createTeamSchema)

    const result = await teamService.createTeam(uid, name)

    await auditService.log({
      teamId: result.team.id,
      userId: uid,
      action: 'team.created',
      resourceType: 'team',
      resourceId: result.team.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    })

    logger.info('Team created', { teamId: result.team.id, userId: uid })
    res.status(201).json(result.team)
  }

  async getTeam(req: Request, res: Response): Promise<void> {
    const uid = userId(req)
    const team = await teamService.getTeam(uid)
    res.json(team)
  }

  async updateTeamName(req: Request, res: Response): Promise<void> {
    const uid = userId(req)
    const { name } = validate<{ name: string }>(req.body, updateTeamSchema)

    const teamData = await teamService.getTeam(uid)
    if (!teamData) {
      res.status(404).json({ error: 'not_found', message: 'No team found' })
      return
    }

    const team = await teamService.updateTeamName(teamData.id, uid, name)

    await auditService.log({
      teamId: team.id,
      userId: uid,
      action: 'team.updated',
      resourceType: 'team',
      resourceId: team.id,
      changes: { name },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    })

    logger.info('Team updated', { teamId: team.id, userId: uid })
    res.json(team)
  }

  async deleteTeam(req: Request, res: Response): Promise<void> {
    const uid = userId(req)
    const teamData = await teamService.getTeam(uid)
    if (!teamData) {
      res.status(404).json({ error: 'not_found', message: 'No team found' })
      return
    }

    await teamService.deleteTeam(teamData.id, uid)

    await auditService.log({
      teamId: teamData.id,
      userId: uid,
      action: 'team.deleted',
      resourceType: 'team',
      resourceId: teamData.id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    })

    logger.info('Team deleted', { teamId: teamData.id, userId: uid })
    res.status(204).send()
  }

  // ── Members ────────────────────────────────────────────────────────────

  async getMembers(req: Request, res: Response): Promise<void> {
    const uid = userId(req)
    const teamData = await teamService.getTeam(uid)
    if (!teamData) {
      res.json([])
      return
    }

    const members = await teamService.getMembers(teamData.id, uid)
    res.json(members)
  }

  async updateMemberRole(req: Request, res: Response): Promise<void> {
    const uid = userId(req)
    const targetUserId = req.params.userId
    const { role } = validate<{ role: 'owner' | 'admin' | 'member' }>(req.body, updateMemberSchema)

    const teamData = await teamService.getTeam(uid)
    if (!teamData) {
      res.status(404).json({ error: 'not_found', message: 'No team found' })
      return
    }

    const member = await teamService.updateMemberRole(teamData.id, targetUserId, role, uid)

    await auditService.log({
      teamId: teamData.id,
      userId: uid,
      action: 'member.role_changed',
      resourceType: 'member',
      resourceId: targetUserId,
      changes: { role },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    })

    logger.info('Member role updated', { teamId: teamData.id, targetUserId, role })
    res.json(member)
  }

  async removeMember(req: Request, res: Response): Promise<void> {
    const uid = userId(req)
    const targetUserId = req.params.userId

    const teamData = await teamService.getTeam(uid)
    if (!teamData) {
      res.status(404).json({ error: 'not_found', message: 'No team found' })
      return
    }

    await teamService.removeMember(teamData.id, targetUserId, uid)

    await auditService.log({
      teamId: teamData.id,
      userId: uid,
      action: 'member.removed',
      resourceType: 'member',
      resourceId: targetUserId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    })

    logger.info('Member removed', { teamId: teamData.id, targetUserId })
    res.status(204).send()
  }

  // ── Invitations ────────────────────────────────────────────────────────

  async sendInvite(req: Request, res: Response): Promise<void> {
    const uid = userId(req)
    const { email, role } = validate<{ email: string; role: 'admin' | 'member' }>(
      req.body,
      inviteMemberSchema
    )

    const teamData = await teamService.getTeam(uid)
    if (!teamData) {
      res.status(404).json({ error: 'not_found', message: 'No team found' })
      return
    }

    const invite = await invitesService.sendInvite(teamData.id, email, role, uid)

    await auditService.log({
      teamId: teamData.id,
      userId: uid,
      action: 'invite.sent',
      resourceType: 'invite',
      resourceId: invite.id,
      changes: { email, role },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    })

    logger.info('Invite sent', { teamId: teamData.id, email })
    res.status(201).json(invite)
  }

  async getInvites(req: Request, res: Response): Promise<void> {
    const uid = userId(req)
    const teamData = await teamService.getTeam(uid)
    if (!teamData) {
      res.json([])
      return
    }

    const invites = await invitesService.getInvites(teamData.id, uid)
    res.json(invites)
  }

  async cancelInvite(req: Request, res: Response): Promise<void> {
    const uid = userId(req)
    const inviteId = req.params.inviteId

    const teamData = await teamService.getTeam(uid)
    if (!teamData) {
      res.status(404).json({ error: 'not_found', message: 'No team found' })
      return
    }

    await invitesService.cancelInvite(inviteId, teamData.id, uid)

    await auditService.log({
      teamId: teamData.id,
      userId: uid,
      action: 'invite.cancelled',
      resourceType: 'invite',
      resourceId: inviteId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    })

    logger.info('Invite cancelled', { teamId: teamData.id, inviteId })
    res.status(204).send()
  }

  async acceptInvite(req: Request, res: Response): Promise<void> {
    const uid = userId(req)
    const inviteId = req.params.inviteId

    const member = await invitesService.acceptInvite(inviteId, uid)

    await auditService.log({
      teamId: member.team_id,
      userId: uid,
      action: 'invite.accepted',
      resourceType: 'invite',
      resourceId: inviteId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    })

    logger.info('Invite accepted', { teamId: member.team_id, userId: uid })
    res.json(member)
  }

  // ── Shared Profiles ────────────────────────────────────────────────────

  async shareProfile(req: Request, res: Response): Promise<void> {
    const uid = userId(req)
    const { profile_id, member_ids, permission } = validate<{
      profile_id: string
      member_ids: string[]
      permission: 'read' | 'write'
    }>(req.body, shareProfileSchema)

    const teamData = await teamService.getTeam(uid)
    if (!teamData) {
      res.status(404).json({ error: 'not_found', message: 'No team found' })
      return
    }

    const shares = await sharedProfilesService.shareProfile(
      teamData.id,
      profile_id,
      member_ids,
      permission,
      uid
    )

    await auditService.log({
      teamId: teamData.id,
      userId: uid,
      action: 'profile.shared',
      resourceType: 'profile',
      resourceId: profile_id,
      changes: { member_ids, permission },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    })

    logger.info('Profile shared', { teamId: teamData.id, profileId: profile_id })
    res.status(201).json(shares)
  }

  async getSharedProfiles(req: Request, res: Response): Promise<void> {
    const uid = userId(req)
    const teamData = await teamService.getTeam(uid)
    if (!teamData) {
      res.json([])
      return
    }

    const profiles = await sharedProfilesService.getSharedProfiles(teamData.id, uid)
    res.json(profiles)
  }

  async unshareProfile(req: Request, res: Response): Promise<void> {
    const uid = userId(req)
    const { profile_id, member_id } = req.body

    const teamData = await teamService.getTeam(uid)
    if (!teamData) {
      res.status(404).json({ error: 'not_found', message: 'No team found' })
      return
    }

    await sharedProfilesService.unshareProfile(teamData.id, profile_id, member_id, uid)

    await auditService.log({
      teamId: teamData.id,
      userId: uid,
      action: 'profile.unshared',
      resourceType: 'profile',
      resourceId: profile_id,
      changes: { member_id },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    })

    logger.info('Profile unshared', { teamId: teamData.id, profileId: profile_id })
    res.status(204).send()
  }

  // ── Audit Log ──────────────────────────────────────────────────────────

  async getAuditLog(req: Request, res: Response): Promise<void> {
    const uid = userId(req)
    const teamData = await teamService.getTeam(uid)
    if (!teamData) {
      res.json({ entries: [], total: 0 })
      return
    }

    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 50
    const filterUserId = req.query.user_id as string | undefined
    const action = req.query.action as string | undefined

    const result = await auditService.getAuditLog(teamData.id, uid, {
      page,
      limit,
      userId: filterUserId,
      action
    })

    res.json(result)
  }
}

export const teamController = new TeamController()
