import { eq, and, desc, count, sql, isNull } from 'drizzle-orm'
import { db } from '../../db/client.js'
import {
  teams, teamMembers, teamInvites, sharedProfiles,
  auditLogs, users, licenses,
} from '../../db/schema.js'
import { AppError } from '../../shared/errors.js'
import { PLAN_LIMITS } from '../license/service.js'
import { secureToken } from '../../shared/crypto.js'
import type {
  CreateTeamSchema, InviteMemberSchema, ShareProfileSchema,
  AuditQuerySchema,
} from './schema.js'
import type { z } from 'zod'

type CreateTeamInput     = z.infer<typeof CreateTeamSchema>
type InviteMemberInput   = z.infer<typeof InviteMemberSchema>
type ShareProfileInput   = z.infer<typeof ShareProfileSchema>
type AuditQueryInput     = z.infer<typeof AuditQuerySchema>

async function getTeamOrThrow(userId: string) {
  const [member] = await db
    .select({ team: teams })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(eq(teamMembers.userId, userId))
    .limit(1)

  if (!member) throw new AppError('TEAM_NOT_FOUND', 'You are not a member of any team')
  return member.team
}

async function getMemberLimit(userId: string): Promise<number> {
  const [license] = await db
    .select({ plan: licenses.plan })
    .from(licenses)
    .where(eq(licenses.userId, userId))
    .limit(1)

  const plan = (license?.plan ?? 'free') as keyof typeof PLAN_LIMITS
  return PLAN_LIMITS[plan].members
}

export const TeamService = {
  async create(userId: string, input: CreateTeamInput) {
    // User can only be in one team
    const existing = await db
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .where(eq(teamMembers.userId, userId))
      .limit(1)

    if (existing.length > 0) {
      throw new AppError('TEAM_ALREADY_EXISTS', 'You are already a member of a team')
    }

    const [team] = await db.insert(teams).values({
      name:    input.name,
      ownerId: userId,
    }).returning()

    // Add owner as admin member
    await db.insert(teamMembers).values({
      teamId: team.id,
      userId,
      role:   'admin',
    })

    return team
  },

  async get(userId: string) {
    return getTeamOrThrow(userId)
  },

  async update(userId: string, name: string) {
    const team = await getTeamOrThrow(userId)

    const [member] = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, userId)))
      .limit(1)

    if (!member || !['admin'].includes(member.role)) {
      throw new AppError('TEAM_PERMISSION_DENIED', 'Only admins can update team settings')
    }

    const [updated] = await db
      .update(teams)
      .set({ name, updatedAt: new Date() })
      .where(eq(teams.id, team.id))
      .returning()

    return updated
  },

  async delete(userId: string) {
    const team = await getTeamOrThrow(userId)

    if (team.ownerId !== userId) {
      throw new AppError('TEAM_PERMISSION_DENIED', 'Only the team owner can delete the team')
    }

    await db.delete(teams).where(eq(teams.id, team.id))
  },

  async getMembers(userId: string) {
    const team = await getTeamOrThrow(userId)

    return db
      .select({
        id:         teamMembers.id,
        userId:     teamMembers.userId,
        email:      users.email,
        name:       users.name,
        avatarUrl:  users.avatarUrl,
        role:       teamMembers.role,
        joinedAt:   teamMembers.joinedAt,
      })
      .from(teamMembers)
      .innerJoin(users, eq(users.id, teamMembers.userId))
      .where(eq(teamMembers.teamId, team.id))
  },

  async updateMemberRole(userId: string, targetUserId: string, role: string) {
    const team = await getTeamOrThrow(userId)

    // Only admin can change roles
    const [caller] = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, userId)))
      .limit(1)

    if (caller?.role !== 'admin') {
      throw new AppError('TEAM_PERMISSION_DENIED', 'Only admins can change member roles')
    }

    // Cannot demote owner
    if (targetUserId === team.ownerId && role !== 'admin') {
      throw new AppError('TEAM_PERMISSION_DENIED', 'Cannot change the owner\'s role')
    }

    const [updated] = await db
      .update(teamMembers)
      .set({ role })
      .where(and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, targetUserId)))
      .returning()

    if (!updated) throw new AppError('TEAM_MEMBER_NOT_FOUND', 'Member not found in this team')
    return updated
  },

  async removeMember(userId: string, targetUserId: string) {
    const team = await getTeamOrThrow(userId)

    const [caller] = await db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, userId)))
      .limit(1)

    if (caller?.role !== 'admin' && userId !== targetUserId) {
      throw new AppError('TEAM_PERMISSION_DENIED', 'Only admins can remove members')
    }

    if (targetUserId === team.ownerId) {
      throw new AppError('TEAM_PERMISSION_DENIED', 'Cannot remove the team owner')
    }

    await db.delete(teamMembers).where(
      and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, targetUserId))
    )
  },

  async invite(userId: string, input: InviteMemberInput) {
    const team = await getTeamOrThrow(userId)

    // Check member limit
    const maxMembers = await getMemberLimit(userId)
    if (maxMembers !== -1) {
      const [{ value: currentCount }] = await db
        .select({ value: count() })
        .from(teamMembers)
        .where(eq(teamMembers.teamId, team.id))

      if (currentCount >= maxMembers) {
        throw new AppError('TEAM_MEMBER_LIMIT', `Your plan allows up to ${maxMembers} team members`)
      }
    }

    const token     = secureToken(24)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    const [invite] = await db.insert(teamInvites).values({
      teamId:    team.id,
      email:     input.email,
      role:      input.role,
      invitedBy: userId,
      token,
      expiresAt,
    }).returning()

    // TODO: queue invite email with token link

    return invite
  },

  async getInvites(userId: string) {
    const team = await getTeamOrThrow(userId)
    return db.select().from(teamInvites).where(eq(teamInvites.teamId, team.id))
  },

  async cancelInvite(userId: string, inviteId: string) {
    const team = await getTeamOrThrow(userId)
    await db.delete(teamInvites).where(
      and(eq(teamInvites.id, inviteId), eq(teamInvites.teamId, team.id))
    )
  },

  async acceptInvite(token: string, userId: string) {
    const [invite] = await db
      .select()
      .from(teamInvites)
      .where(and(eq(teamInvites.token, token), eq(teamInvites.status, 'pending')))
      .limit(1)

    if (!invite) throw new AppError('TEAM_INVITE_NOT_FOUND', 'Invite not found')
    if (invite.expiresAt < new Date()) {
      throw new AppError('TEAM_INVITE_EXPIRED', 'This invite has expired')
    }

    await db.transaction(async (tx) => {
      await tx.insert(teamMembers).values({
        teamId: invite.teamId,
        userId,
        role:   invite.role,
      }).onConflictDoNothing()

      await tx.update(teamInvites)
        .set({ status: 'accepted' })
        .where(eq(teamInvites.id, invite.id))
    })
  },

  async shareProfile(userId: string, input: ShareProfileInput) {
    const team = await getTeamOrThrow(userId)

    for (const memberId of input.member_ids) {
      await db.insert(sharedProfiles).values({
        teamId:      team.id,
        profileId:   input.profile_id,
        profileName: input.profile_name,
        sharedBy:    userId,
        memberId,
        permission:  input.permission,
      }).onConflictDoUpdate({
        target: [sharedProfiles.teamId, sharedProfiles.profileId, sharedProfiles.memberId],
        set: { permission: input.permission, sharedAt: new Date() },
      })
    }
  },

  async getSharedProfiles(userId: string) {
    const team = await getTeamOrThrow(userId)
    return db.select().from(sharedProfiles).where(eq(sharedProfiles.teamId, team.id))
  },

  async unshareProfile(userId: string, profileId: string, memberId: string) {
    const team = await getTeamOrThrow(userId)
    await db.delete(sharedProfiles).where(
      and(
        eq(sharedProfiles.teamId, team.id),
        eq(sharedProfiles.profileId, profileId),
        eq(sharedProfiles.memberId, memberId),
      )
    )
  },

  async getAuditLog(userId: string, query: AuditQueryInput) {
    const team = await getTeamOrThrow(userId)
    const offset = (query.page - 1) * query.limit

    const conditions = [eq(auditLogs.teamId, team.id)]
    if (query.user_id) conditions.push(eq(auditLogs.userId, query.user_id))
    if (query.action)  conditions.push(eq(auditLogs.action, query.action))

    const [entries, [{ value: total }]] = await Promise.all([
      db.select().from(auditLogs)
        .where(and(...conditions))
        .orderBy(desc(auditLogs.createdAt))
        .limit(query.limit)
        .offset(offset),
      db.select({ value: count() }).from(auditLogs).where(and(...conditions)),
    ])

    return { entries, meta: { total, page: query.page, limit: query.limit } }
  },

  async addAuditEntry(teamId: string, entry: {
    userId?: string; userName?: string; action: string;
    targetId?: string; targetName?: string; ipAddress?: string;
  }) {
    await db.insert(auditLogs).values({ teamId, ...entry })
  },
}
