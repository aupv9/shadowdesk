import { apiRequest } from './api-client'
import type {
  Team, TeamMember, TeamInvite, TeamRole,
  SharedProfile, AuditLogEntry
} from '../shared/types'

// ── Team CRUD ────────────────────────────────────────────────────────────────

export async function createTeam(name: string): Promise<Team> {
  return apiRequest<Team>('/team', {
    method: 'POST',
    body: { name }
  })
}

export async function getTeam(): Promise<Team | null> {
  try {
    return await apiRequest<Team>('/team')
  } catch {
    return null
  }
}

export async function updateTeamName(name: string): Promise<Team> {
  return apiRequest<Team>('/team', {
    method: 'PUT',
    body: { name }
  })
}

export async function deleteTeam(): Promise<void> {
  await apiRequest('/team', { method: 'DELETE' })
}

// ── Members ──────────────────────────────────────────────────────────────────

export async function getMembers(): Promise<TeamMember[]> {
  return apiRequest<TeamMember[]>('/team/members')
}

export async function updateMemberRole(userId: string, role: TeamRole): Promise<TeamMember> {
  return apiRequest<TeamMember>(`/team/members/${userId}`, {
    method: 'PUT',
    body: { role }
  })
}

export async function removeMember(userId: string): Promise<void> {
  await apiRequest(`/team/members/${userId}`, { method: 'DELETE' })
}

// ── Invitations ──────────────────────────────────────────────────────────────

export async function inviteMember(email: string, role: TeamRole): Promise<TeamInvite> {
  return apiRequest<TeamInvite>('/team/invites', {
    method: 'POST',
    body: { email, role }
  })
}

export async function getInvites(): Promise<TeamInvite[]> {
  return apiRequest<TeamInvite[]>('/team/invites')
}

export async function cancelInvite(inviteId: string): Promise<void> {
  await apiRequest(`/team/invites/${inviteId}`, { method: 'DELETE' })
}

export async function acceptInvite(inviteId: string): Promise<void> {
  await apiRequest(`/team/invites/${inviteId}/accept`, { method: 'POST' })
}

// ── Shared Profiles ──────────────────────────────────────────────────────────

export async function shareProfile(
  profileId: string,
  memberIds: string[],
  permission: 'read' | 'write'
): Promise<void> {
  await apiRequest('/team/profiles/share', {
    method: 'POST',
    body: { profile_id: profileId, member_ids: memberIds, permission }
  })
}

export async function getSharedProfiles(): Promise<SharedProfile[]> {
  return apiRequest<SharedProfile[]>('/team/profiles/shared')
}

export async function unshareProfile(profileId: string, memberId: string): Promise<void> {
  await apiRequest(`/team/profiles/share`, {
    method: 'DELETE',
    body: { profile_id: profileId, member_id: memberId }
  })
}

// ── Audit Log (GET /team/audit) ─────────────────────────────────────────────

export async function getAuditLog(params?: {
  page?: number
  limit?: number
  user_id?: string
  action?: string
}): Promise<{ entries: AuditLogEntry[]; total: number }> {
  const query = new URLSearchParams()
  if (params?.page) query.set('page', String(params.page))
  if (params?.limit) query.set('limit', String(params.limit))
  if (params?.user_id) query.set('user_id', params.user_id)
  if (params?.action) query.set('action', params.action)

  const qs = query.toString()
  return apiRequest(`/team/audit${qs ? `?${qs}` : ''}`)
}

/**
 * Post an audit entry. Server records audit automatically via team controllers,
 * so this is a local fallback for client-side events.
 */
export async function postAuditEntry(entry: {
  action: string
  target_id?: string
  target_name?: string
  metadata?: Record<string, unknown>
}): Promise<void> {
  try {
    // Store locally via the database audit_log table
    const { Database } = require('./database') as typeof import('./database')
    const db = Database.getInstance()
    const { randomBytes } = require('crypto')
    const id = require('crypto').randomBytes(8).toString('hex')
    db.addAuditEntry({
      id,
      user_id: '',
      user_name: '',
      action: entry.action,
      target_id: entry.target_id,
      target_name: entry.target_name
    })
  } catch {
    // Best-effort — give up silently.
  }
}
