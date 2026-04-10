import { v4 as uuid } from 'uuid'
import { getDatabase } from '../../config/database'
import { forbidden, notFound, conflict } from '../../utils/errors'
import type { Team, TeamMember } from '../../types'

export type TeamRole = 'owner' | 'admin' | 'member'

export class TeamService {
  // ── Team CRUD ──────────────────────────────────────────────────────────

  async createTeam(userId: string, name: string): Promise<{ team: Team; member: TeamMember }> {
    const db = getDatabase()
    const teamId = uuid()
    const memberId = uuid()
    const now = new Date()

    await db.transaction(async (trx) => {
      await trx('teams').insert({
        id: teamId,
        owner_id: userId,
        name,
        created_at: now,
        updated_at: now
      })

      await trx('team_members').insert({
        id: memberId,
        team_id: teamId,
        user_id: userId,
        role: 'owner',
        joined_at: now
      })
    })

    const team = (await this.getTeamById(teamId))!
    const member: TeamMember = {
      id: memberId,
      team_id: teamId,
      user_id: userId,
      role: 'owner',
      joined_at: now.toISOString()
    }

    return { team, member }
  }

  async getTeam(userId: string): Promise<Team | null> {
    const db = getDatabase()

    // Find team where user is a member
    const row = await db('teams')
      .join('team_members', 'teams.id', 'team_members.team_id')
      .where('team_members.user_id', userId)
      .whereNull('teams.deleted_at')
      .select('teams.*')
      .first()

    return row ? this.formatTeam(row) : null
  }

  async getTeamById(teamId: string): Promise<Team | null> {
    const db = getDatabase()
    const row = await db('teams').where({ id: teamId }).whereNull('deleted_at').first()
    return row ? this.formatTeam(row) : null
  }

  async updateTeamName(teamId: string, userId: string, name: string): Promise<Team> {
    await this.requireRole(teamId, userId, ['owner', 'admin'])

    const db = getDatabase()
    await db('teams').where({ id: teamId }).update({ name, updated_at: new Date() })

    const team = await this.getTeamById(teamId)
    if (!team) throw notFound('Team not found')
    return team
  }

  async deleteTeam(teamId: string, userId: string): Promise<void> {
    await this.requireRole(teamId, userId, ['owner'])

    const db = getDatabase()
    await db('teams').where({ id: teamId }).update({
      deleted_at: new Date(),
      updated_at: new Date()
    })
  }

  // ── Members ────────────────────────────────────────────────────────────

  async getMembers(teamId: string, userId: string): Promise<TeamMember[]> {
    await this.requireMembership(teamId, userId)

    const db = getDatabase()
    const rows = await db('team_members')
      .join('users', 'team_members.user_id', 'users.id')
      .where('team_members.team_id', teamId)
      .select(
        'team_members.id',
        'team_members.team_id',
        'team_members.user_id',
        'team_members.role',
        'team_members.joined_at',
        'users.email as user_email',
        'users.full_name as user_name'
      )
      .orderBy('team_members.joined_at', 'asc')

    return rows.map((r) => ({
      id: r.id,
      team_id: r.team_id,
      user_id: r.user_id,
      role: r.role,
      joined_at: r.joined_at,
      user_email: r.user_email,
      user_name: r.user_name
    }))
  }

  async updateMemberRole(
    teamId: string,
    targetUserId: string,
    newRole: TeamRole,
    updatedBy: string
  ): Promise<TeamMember> {
    const updaterRole = await this.getMemberRole(teamId, updatedBy)
    if (!updaterRole) throw forbidden('You are not a member of this team')

    // Only owner can promote to owner or demote from owner
    const targetRole = await this.getMemberRole(teamId, targetUserId)
    if (!targetRole) throw notFound('Member not found in this team')

    if (targetRole === 'owner' && updaterRole !== 'owner') {
      throw forbidden('Only the owner can change the owner role')
    }
    if (newRole === 'owner' && updaterRole !== 'owner') {
      throw forbidden('Only the owner can transfer ownership')
    }
    if (updaterRole === 'member') {
      throw forbidden('Members cannot change roles')
    }

    // If transferring ownership, demote current owner to admin
    const db = getDatabase()
    if (newRole === 'owner') {
      await db.transaction(async (trx) => {
        await trx('team_members')
          .where({ team_id: teamId, user_id: updatedBy })
          .update({ role: 'admin' })
        await trx('team_members')
          .where({ team_id: teamId, user_id: targetUserId })
          .update({ role: 'owner' })
        await trx('teams')
          .where({ id: teamId })
          .update({ owner_id: targetUserId, updated_at: new Date() })
      })
    } else {
      await db('team_members')
        .where({ team_id: teamId, user_id: targetUserId })
        .update({ role: newRole })
    }

    const member = await db('team_members')
      .where({ team_id: teamId, user_id: targetUserId })
      .first()

    return this.formatMember(member)
  }

  async removeMember(teamId: string, targetUserId: string, removedBy: string): Promise<void> {
    const targetRole = await this.getMemberRole(teamId, targetUserId)
    if (!targetRole) throw notFound('Member not found in this team')

    if (targetRole === 'owner') {
      throw conflict('Cannot remove the team owner. Transfer ownership first.')
    }

    // Self-removal is always allowed; otherwise must be owner/admin
    if (targetUserId !== removedBy) {
      await this.requireRole(teamId, removedBy, ['owner', 'admin'])
    }

    const db = getDatabase()
    await db('team_members')
      .where({ team_id: teamId, user_id: targetUserId })
      .delete()
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  async getMemberRole(teamId: string, userId: string): Promise<TeamRole | null> {
    const db = getDatabase()
    const row = await db('team_members')
      .where({ team_id: teamId, user_id: userId })
      .first()
    return row ? row.role : null
  }

  async requireMembership(teamId: string, userId: string): Promise<TeamRole> {
    const role = await this.getMemberRole(teamId, userId)
    if (!role) throw forbidden('You are not a member of this team')
    return role
  }

  async requireRole(teamId: string, userId: string, roles: TeamRole[]): Promise<TeamRole> {
    const role = await this.requireMembership(teamId, userId)
    if (!roles.includes(role)) {
      throw forbidden(`This action requires one of these roles: ${roles.join(', ')}`)
    }
    return role
  }

  async getTeamForUser(userId: string): Promise<{ team: Team; role: TeamRole } | null> {
    const db = getDatabase()
    const row = await db('team_members')
      .join('teams', 'team_members.team_id', 'teams.id')
      .where('team_members.user_id', userId)
      .whereNull('teams.deleted_at')
      .select('teams.*', 'team_members.role')
      .first()

    if (!row) return null
    return { team: this.formatTeam(row), role: row.role }
  }

  async getMemberCount(teamId: string): Promise<number> {
    const db = getDatabase()
    const [{ count }] = await db('team_members').where({ team_id: teamId }).count('* as count')
    return parseInt(count as string, 10)
  }

  private formatTeam(row: any): Team {
    return {
      id: row.id,
      owner_id: row.owner_id,
      name: row.name,
      created_at: row.created_at,
      updated_at: row.updated_at
    }
  }

  private formatMember(row: any): TeamMember {
    return {
      id: row.id,
      team_id: row.team_id,
      user_id: row.user_id,
      role: row.role,
      joined_at: row.joined_at
    }
  }
}

export const teamService = new TeamService()
