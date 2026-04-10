import { v4 as uuid } from 'uuid'
import { getDatabase } from '../../config/database'
import { generateToken } from '../../utils/crypto'
import { notFound, conflict, badRequest, forbidden } from '../../utils/errors'
import { teamService, TeamRole } from './team.service'
import type { TeamInvite, TeamMember } from '../../types'

const INVITE_EXPIRY_DAYS = 7

export class InvitesService {
  async sendInvite(
    teamId: string,
    email: string,
    role: 'admin' | 'member',
    invitedByUserId: string
  ): Promise<TeamInvite> {
    // Verify inviter has permission
    await teamService.requireRole(teamId, invitedByUserId, ['owner', 'admin'])

    const db = getDatabase()

    // Check if user is already a member
    const existingUser = await db('users').where({ email: email.toLowerCase() }).first()
    if (existingUser) {
      const existingMember = await db('team_members')
        .where({ team_id: teamId, user_id: existingUser.id })
        .first()
      if (existingMember) {
        throw conflict('This user is already a member of the team')
      }
    }

    // Check for existing pending invite
    const existingInvite = await db('team_invites')
      .where({ team_id: teamId, email: email.toLowerCase() })
      .whereNull('accepted_at')
      .where('expires_at', '>', new Date())
      .first()

    if (existingInvite) {
      throw conflict('An active invitation already exists for this email')
    }

    // Check team member limit via license (simplified — caller validates this)
    const memberCount = await teamService.getMemberCount(teamId)
    // We'll check license limits in the controller layer

    const inviteId = uuid()
    const token = generateToken(32)
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS)

    await db('team_invites').insert({
      id: inviteId,
      team_id: teamId,
      invited_by_user_id: invitedByUserId,
      email: email.toLowerCase(),
      role,
      token,
      expires_at: expiresAt,
      created_at: new Date()
    })

    return this.getInviteById(inviteId)
  }

  async getInvites(teamId: string, userId: string): Promise<TeamInvite[]> {
    await teamService.requireRole(teamId, userId, ['owner', 'admin'])

    const db = getDatabase()
    const rows = await db('team_invites')
      .where({ team_id: teamId })
      .whereNull('accepted_at')
      .where('expires_at', '>', new Date())
      .orderBy('created_at', 'desc')

    return rows.map((r) => this.formatInvite(r))
  }

  async cancelInvite(inviteId: string, teamId: string, userId: string): Promise<void> {
    await teamService.requireRole(teamId, userId, ['owner', 'admin'])

    const db = getDatabase()
    const invite = await db('team_invites').where({ id: inviteId, team_id: teamId }).first()
    if (!invite) throw notFound('Invite not found')
    if (invite.accepted_at) throw conflict('Invite has already been accepted')

    await db('team_invites').where({ id: inviteId }).delete()
  }

  async acceptInvite(inviteId: string, userId: string): Promise<TeamMember> {
    const db = getDatabase()

    const invite = await db('team_invites').where({ id: inviteId }).first()
    if (!invite) throw notFound('Invite not found')
    if (invite.accepted_at) throw conflict('Invite has already been accepted')
    if (new Date(invite.expires_at) < new Date()) {
      throw badRequest('Invite has expired')
    }

    // Verify the accepting user's email matches the invite
    const user = await db('users').where({ id: userId }).first()
    if (!user) throw notFound('User not found')
    if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
      throw forbidden('This invite was sent to a different email address')
    }

    // Check not already a member
    const existing = await db('team_members')
      .where({ team_id: invite.team_id, user_id: userId })
      .first()
    if (existing) {
      throw conflict('You are already a member of this team')
    }

    const memberId = uuid()
    const now = new Date()

    await db.transaction(async (trx) => {
      // Mark invite as accepted
      await trx('team_invites').where({ id: inviteId }).update({ accepted_at: now })

      // Add user to team
      await trx('team_members').insert({
        id: memberId,
        team_id: invite.team_id,
        user_id: userId,
        role: invite.role,
        joined_at: now
      })
    })

    return {
      id: memberId,
      team_id: invite.team_id,
      user_id: userId,
      role: invite.role,
      joined_at: now.toISOString()
    }
  }

  async getInviteById(inviteId: string): Promise<TeamInvite> {
    const db = getDatabase()
    const row = await db('team_invites').where({ id: inviteId }).first()
    if (!row) throw notFound('Invite not found')
    return this.formatInvite(row)
  }

  private formatInvite(row: any): TeamInvite {
    return {
      id: row.id,
      team_id: row.team_id,
      invited_by_user_id: row.invited_by_user_id,
      email: row.email,
      role: row.role,
      token: row.token,
      expires_at: row.expires_at,
      accepted_at: row.accepted_at ?? undefined,
      created_at: row.created_at
    }
  }
}

export const invitesService = new InvitesService()
