import { create } from 'zustand'
import type { Team, TeamMember, TeamInvite, SharedProfile, AuditLogEntry } from '../types'

interface TeamStore {
  team: Team | null
  members: TeamMember[]
  invites: TeamInvite[]
  sharedProfiles: SharedProfile[]
  auditLog: AuditLogEntry[]
  auditTotal: number
  loading: boolean
  error: string | null

  fetchTeam:        () => Promise<void>
  createTeam:       (name: string) => Promise<void>
  updateTeamName:   (name: string) => Promise<void>
  deleteTeam:       () => Promise<void>
  fetchMembers:     () => Promise<void>
  updateMemberRole: (userId: string, role: string) => Promise<void>
  removeMember:     (userId: string) => Promise<void>
  inviteMember:     (email: string, role: string) => Promise<void>
  fetchInvites:     () => Promise<void>
  cancelInvite:     (inviteId: string) => Promise<void>
  shareProfile:     (profileId: string, memberIds: string[], permission: string) => Promise<void>
  fetchSharedProfiles: () => Promise<void>
  unshareProfile:   (profileId: string, memberId: string) => Promise<void>
  fetchAuditLog:    (params?: { page?: number; limit?: number }) => Promise<void>
}

export const useTeamStore = create<TeamStore>((set) => ({
  team: null,
  members: [],
  invites: [],
  sharedProfiles: [],
  auditLog: [],
  auditTotal: 0,
  loading: false,
  error: null,

  fetchTeam: async () => {
    set({ loading: true, error: null })
    try {
      const team = await window.api.team.get()
      set({ team, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  createTeam: async (name) => {
    set({ loading: true, error: null })
    try {
      const team = await window.api.team.create(name)
      set({ team, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
      throw e
    }
  },

  updateTeamName: async (name) => {
    const team = await window.api.team.updateName(name)
    set({ team })
  },

  deleteTeam: async () => {
    await window.api.team.delete()
    set({ team: null, members: [], invites: [], sharedProfiles: [] })
  },

  fetchMembers: async () => {
    try {
      const members = await window.api.team.members()
      set({ members })
    } catch { /* ignore */ }
  },

  updateMemberRole: async (userId, role) => {
    const updated = await window.api.team.updateMemberRole(userId, role)
    set((s) => ({ members: s.members.map((m) => m.user_id === userId ? updated : m) }))
  },

  removeMember: async (userId) => {
    await window.api.team.removeMember(userId)
    set((s) => ({ members: s.members.filter((m) => m.user_id !== userId) }))
  },

  inviteMember: async (email, role) => {
    const invite = await window.api.team.invite(email, role)
    set((s) => ({ invites: [invite, ...s.invites] }))
  },

  fetchInvites: async () => {
    try {
      const invites = await window.api.team.invites()
      set({ invites })
    } catch { /* ignore */ }
  },

  cancelInvite: async (inviteId) => {
    await window.api.team.cancelInvite(inviteId)
    set((s) => ({ invites: s.invites.filter((i) => i.id !== inviteId) }))
  },

  shareProfile: async (profileId, memberIds, permission) => {
    await window.api.team.shareProfile(profileId, memberIds, permission)
  },

  fetchSharedProfiles: async () => {
    try {
      const sharedProfiles = await window.api.team.sharedProfiles()
      set({ sharedProfiles })
    } catch { /* ignore */ }
  },

  unshareProfile: async (profileId, memberId) => {
    await window.api.team.unshareProfile(profileId, memberId)
    set((s) => ({
      sharedProfiles: s.sharedProfiles.filter(
        (sp) => !(sp.profile_id === profileId && sp.shared_by === memberId)
      )
    }))
  },

  fetchAuditLog: async (params) => {
    try {
      const { entries, total } = await window.api.team.auditLog(params)
      set({ auditLog: entries, auditTotal: total })
    } catch { /* ignore */ }
  }
}))
