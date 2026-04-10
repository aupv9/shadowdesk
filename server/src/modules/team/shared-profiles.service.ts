import { v4 as uuid } from 'uuid'
import { getDatabase } from '../../config/database'
import { notFound, conflict, forbidden } from '../../utils/errors'
import { teamService } from './team.service'
import type { SharedProfile } from '../../types'

export class SharedProfilesService {
  async shareProfile(
    teamId: string,
    profileId: string,
    memberIds: string[],
    permission: 'read' | 'write',
    sharedByUserId: string
  ): Promise<SharedProfile[]> {
    await teamService.requireMembership(teamId, sharedByUserId)

    const db = getDatabase()
    const now = new Date()
    const results: SharedProfile[] = []

    for (const memberId of memberIds) {
      // Verify target is a team member
      const memberRole = await teamService.getMemberRole(teamId, memberId)
      if (!memberRole) {
        throw notFound(`User ${memberId} is not a member of this team`)
      }

      // Skip if sharing with self
      if (memberId === sharedByUserId) continue

      // Check for existing share
      const existing = await db('shared_profiles')
        .where({ profile_id: profileId, shared_by_user_id: sharedByUserId, shared_to_user_id: memberId })
        .first()

      if (existing) {
        // Update permission if different
        if (existing.permission !== permission) {
          await db('shared_profiles')
            .where({ id: existing.id })
            .update({ permission, updated_at: now })
        }
        results.push({
          profile_id: profileId,
          profile_name: existing.profile_name || '',
          shared_by_user_id: sharedByUserId,
          shared_to_user_id: memberId,
          permission,
          shared_at: existing.shared_at
        })
        continue
      }

      const shareId = uuid()
      await db('shared_profiles').insert({
        id: shareId,
        team_id: teamId,
        profile_id: profileId,
        profile_name: '',
        shared_by_user_id: sharedByUserId,
        shared_to_user_id: memberId,
        permission,
        shared_at: now,
        created_at: now,
        updated_at: now
      })

      results.push({
        profile_id: profileId,
        profile_name: '',
        shared_by_user_id: sharedByUserId,
        shared_to_user_id: memberId,
        permission,
        shared_at: now.toISOString()
      })
    }

    return results
  }

  async getSharedProfiles(teamId: string, userId: string): Promise<SharedProfile[]> {
    await teamService.requireMembership(teamId, userId)

    const db = getDatabase()
    const rows = await db('shared_profiles')
      .where({ team_id: teamId })
      .where(function () {
        this.where('shared_by_user_id', userId).orWhere('shared_to_user_id', userId)
      })
      .orderBy('shared_at', 'desc')

    return rows.map((r) => ({
      profile_id: r.profile_id,
      profile_name: r.profile_name || '',
      shared_by_user_id: r.shared_by_user_id,
      shared_to_user_id: r.shared_to_user_id,
      permission: r.permission,
      shared_at: r.shared_at
    }))
  }

  async unshareProfile(
    teamId: string,
    profileId: string,
    memberId: string,
    requestedByUserId: string
  ): Promise<void> {
    const db = getDatabase()

    const share = await db('shared_profiles')
      .where({ team_id: teamId, profile_id: profileId, shared_to_user_id: memberId })
      .first()

    if (!share) throw notFound('Shared profile not found')

    // Only the sharer, team owner, or the shared-to member can unshare
    const requesterRole = await teamService.getMemberRole(teamId, requestedByUserId)
    if (
      share.shared_by_user_id !== requestedByUserId &&
      share.shared_to_user_id !== requestedByUserId &&
      requesterRole !== 'owner'
    ) {
      throw forbidden('You do not have permission to unshare this profile')
    }

    await db('shared_profiles')
      .where({ team_id: teamId, profile_id: profileId, shared_to_user_id: memberId })
      .delete()
  }
}

export const sharedProfilesService = new SharedProfilesService()
