// User types
export interface User {
  id: string
  email: string
  full_name?: string
  email_verified: boolean
  email_verified_at?: string
  status: 'active' | 'suspended' | 'deleted'
  created_at: string
  updated_at: string
}

export interface UserWithPassword extends User {
  password_hash: string
}

// Team types
export interface Team {
  id: string
  owner_id: string
  name: string
  created_at: string
  updated_at: string
}

export interface TeamMember {
  id: string
  team_id: string
  user_id: string
  role: 'owner' | 'admin' | 'member'
  joined_at: string
}

export interface TeamInvite {
  id: string
  team_id: string
  invited_by_user_id: string
  email: string
  role: 'admin' | 'member'
  token: string
  expires_at: string
  accepted_at?: string
  created_at: string
}

export interface SharedProfile {
  profile_id: string
  profile_name: string
  shared_by_user_id: string
  shared_to_user_id: string
  permission: 'read' | 'write'
  shared_at: string
}

export interface TeamMemberWithUser extends TeamMember {
  user_email?: string
  user_name?: string
}

// License types
export interface License {
  id: string
  user_id: string
  license_key: string
  plan: 'free' | 'pro' | 'enterprise'
  max_profiles: number
  max_team_members: number
  cloud_sync_enabled: boolean
  activated_at?: string
  valid_until?: string
  status: 'active' | 'suspended' | 'expired'
  created_at: string
  updated_at: string
}

export interface LicenseDevice {
  id: string
  license_id: string
  machine_id: string
  machine_name?: string
  activated_at: string
  last_used_at?: string
  is_current?: boolean
}

// Sync types
export interface SyncBundle {
  id: string
  user_id: string
  data: Buffer
  checksum: string
  profile_count: number
  bundle_version: number
  created_at: string
  updated_at: string
}

export interface SyncManifest {
  profile_ids: string[]
  profile_count: number
  last_synced_at: string
}

// Audit types
export interface AuditLogEntry {
  id: string
  team_id?: string
  user_id: string
  action: string
  resource_type?: string
  resource_id?: string
  changes?: Record<string, unknown>
  ip_address?: string
  user_agent?: string
  status: 'success' | 'failure'
  error_message?: string
  created_at: string
}
