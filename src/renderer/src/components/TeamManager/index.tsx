import React, { useEffect, useState } from 'react'
import {
  Users, UserPlus, Shield, Trash2, Crown, Eye, Edit3,
  Mail, Clock, X, RefreshCw, AlertTriangle, ScrollText
} from 'lucide-react'
import { useTeamStore } from '../../stores/teamStore'
import { useAuthStore } from '../../stores/authStore'
import type { TeamRole } from '../../types'

const ROLE_LABELS: Record<TeamRole, { label: string; icon: React.ElementType; color: string }> = {
  admin:  { label: 'Admin',  icon: Shield, color: 'text-amber-400' },
  editor: { label: 'Editor', icon: Edit3,  color: 'text-blue-400' },
  viewer: { label: 'Viewer', icon: Eye,    color: 'text-slate-400' }
}

export function TeamManager() {
  const auth = useAuthStore()
  const team = useTeamStore()

  const [teamName, setTeamName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<TeamRole>('editor')
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [showAudit, setShowAudit] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (auth.authenticated) {
      team.fetchTeam()
    }
  }, [auth.authenticated])

  useEffect(() => {
    if (team.team) {
      team.fetchMembers()
      team.fetchInvites()
    }
  }, [team.team?.id])

  const handleCreateTeam = async () => {
    if (!teamName.trim()) return
    setCreating(true)
    setError(null)
    try {
      await team.createTeam(teamName.trim())
      setTeamName('')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setCreating(false)
    }
  }

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return
    setError(null)
    try {
      await team.inviteMember(inviteEmail.trim(), inviteRole)
      setInviteEmail('')
      setShowInviteForm(false)
    } catch (e: any) {
      setError(e.message)
    }
  }

  const handleLoadAudit = () => {
    setShowAudit(true)
    team.fetchAuditLog({ limit: 50 })
  }

  if (!auth.authenticated) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-6 py-4 border-b border-slate-800">
          <h1 className="text-lg font-semibold text-white">Team</h1>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Sign in to manage your team</p>
            <p className="text-slate-500 text-xs mt-1">Go to Account to sign in or create an account</p>
          </div>
        </div>
      </div>
    )
  }

  if (!team.team) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-6 py-4 border-b border-slate-800">
          <h1 className="text-lg font-semibold text-white">Team</h1>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-sm">
            <Users className="w-12 h-12 text-ghost-600 mx-auto mb-3" />
            <h2 className="text-white font-medium mb-1">Create a Workspace</h2>
            <p className="text-slate-400 text-sm mb-4">
              Invite team members to share profiles and collaborate
            </p>
            {error && (
              <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-red-500/10 text-red-400 text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Workspace name"
                className="input flex-1"
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateTeam() }}
              />
              <button
                onClick={handleCreateTeam}
                disabled={creating || !teamName.trim()}
                className="btn-primary flex items-center gap-2 text-sm"
              >
                {creating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                Create
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">{team.team.name}</h1>
          <p className="text-xs text-slate-500">{team.members.length} members</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleLoadAudit}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <ScrollText className="w-4 h-4" />
            Audit Log
          </button>
          <button
            onClick={() => setShowInviteForm(true)}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <UserPlus className="w-4 h-4" />
            Invite
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-3xl">
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 text-red-400 text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
            <button onClick={() => setError(null)} className="ml-auto">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Invite Form */}
        {showInviteForm && (
          <div className="card">
            <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Invite Member
            </h2>
            <div className="flex gap-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@company.com"
                className="input flex-1"
                onKeyDown={(e) => { if (e.key === 'Enter') handleInvite() }}
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as TeamRole)}
                className="input w-28"
              >
                <option value="admin">Admin</option>
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
              <button onClick={handleInvite} disabled={!inviteEmail.trim()} className="btn-primary text-sm">
                Send
              </button>
              <button
                onClick={() => setShowInviteForm(false)}
                className="px-2 text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Members */}
        <div className="card">
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Users className="w-4 h-4" />
            Members
          </h2>
          <div className="space-y-2">
            {team.members.map((member) => {
              const roleInfo = ROLE_LABELS[member.role] ?? ROLE_LABELS.viewer
              const RoleIcon = roleInfo.icon
              return (
                <div key={member.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-medium text-slate-300">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">{member.name}</div>
                      <div className="text-xs text-slate-400">{member.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={`flex items-center gap-1.5 text-xs font-medium ${roleInfo.color}`}>
                      <RoleIcon className="w-3.5 h-3.5" />
                      {roleInfo.label}
                    </div>
                    {member.user_id !== auth.user?.id && (
                      <div className="flex items-center gap-1">
                        <select
                          value={member.role}
                          onChange={(e) => team.updateMemberRole(member.user_id, e.target.value)}
                          className="input text-xs py-1 px-2 bg-slate-700"
                        >
                          <option value="admin">Admin</option>
                          <option value="editor">Editor</option>
                          <option value="viewer">Viewer</option>
                        </select>
                        <button
                          onClick={() => team.removeMember(member.user_id)}
                          className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                          title="Remove member"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                    {member.user_id === team.team?.owner_id && (
                      <Crown className="w-4 h-4 text-amber-400" title="Owner" />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Pending Invites */}
        {team.invites.length > 0 && (
          <div className="card">
            <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Pending Invites
            </h2>
            <div className="space-y-2">
              {team.invites.filter((i) => i.status === 'pending').map((invite) => (
                <div key={invite.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50">
                  <div>
                    <div className="text-sm text-white">{invite.email}</div>
                    <div className="text-xs text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Expires {new Date(invite.expires_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">{invite.role}</span>
                    <button
                      onClick={() => team.cancelInvite(invite.id)}
                      className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                      title="Cancel invite"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Audit Log */}
        {showAudit && (
          <div className="card">
            <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <ScrollText className="w-4 h-4" />
              Activity Audit Log
            </h2>
            {team.auditLog.length === 0 ? (
              <p className="text-sm text-slate-500">No activity recorded yet</p>
            ) : (
              <div className="space-y-1.5 max-h-80 overflow-y-auto">
                {team.auditLog.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-800 last:border-0">
                    <div>
                      <span className="text-slate-300 font-medium">{entry.user_name}</span>
                      <span className="text-slate-500 mx-1.5">{entry.action}</span>
                      {entry.target_name && (
                        <span className="text-slate-400">{entry.target_name}</span>
                      )}
                    </div>
                    <span className="text-slate-600 shrink-0 ml-3">
                      {new Date(entry.timestamp).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
