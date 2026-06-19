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

// Workflow types
export interface CreateWorkflowRequest {
  name: string
  description?: string
  steps: Record<string, any>[]
  variables?: Record<string, any>
  tags?: string[]
  status?: 'draft' | 'published' | 'archived'
}

export interface UpdateWorkflowRequest {
  name?: string
  description?: string
  steps?: Record<string, any>[]
  variables?: Record<string, any>
  tags?: string[]
  status?: 'draft' | 'published' | 'archived'
}

export interface ExecuteWorkflowRequest {
  profile_id?: string
  variables?: Record<string, any>
}

export interface CreateScheduleRequest {
  workflow_id: string
  profile_id?: string
  cron_expression: string
  timezone?: string
  max_runs?: number
}

export interface UpdateScheduleRequest {
  cron_expression?: string
  timezone?: string
  max_runs?: number
  status?: 'active' | 'paused'
}

export interface Workflow {
  id: string
  user_id: string
  name: string
  description?: string
  steps: Record<string, any>[]
  variables?: Record<string, any>
  tags?: string[]
  status: 'draft' | 'published' | 'archived'
  created_at: string
  updated_at: string
}

export interface WorkflowExecution {
  id: string
  workflow_id: string
  user_id: string
  profile_id?: string
  variables?: Record<string, any>
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  result?: Record<string, any>
  error?: string
  started_at?: string
  completed_at?: string
  created_at: string
}

export interface WorkflowSchedule {
  id: string
  workflow_id: string
  user_id: string
  profile_id?: string
  cron_expression: string
  timezone: string
  max_runs?: number
  runs_count: number
  status: 'active' | 'paused'
  last_execution_at?: string
  next_execution_at?: string
  created_at: string
  updated_at: string
}

// ─── User Profile (Common SaaS) ───────────────────────────────────────────────
export interface UserProfile {
  user_id: string
  display_name?: string | null
  avatar_url?: string | null
  bio?: string | null
  timezone?: string | null
  language?: string | null
  metadata?: Record<string, unknown>
  updated_at?: string
}

// ─── Notifications ─────────────────────────────────────────────────────────────
export interface AppNotification {
  id: string
  type: 'license_expiry' | 'team_invite' | 'detection_alert' | 'system' | 'billing'
  title: string
  message: string
  read: boolean
  created_at: string
  action_url?: string
  metadata?: Record<string, unknown>
}

// ─── Remote Config / Feature Flags ─────────────────────────────────────────────
export interface FeatureFlag {
  key: string
  enabled: boolean
  variant?: string
  metadata?: Record<string, unknown>
}

export interface Announcement {
  id: string
  type: 'info' | 'warning' | 'critical' | 'maintenance'
  title: string
  message: string
  action_url?: string
  action_label?: string
  dismissible: boolean
  starts_at: string
  ends_at?: string | null
}

export interface RemoteConfig {
  flags: FeatureFlag[]
  settings: Record<string, unknown>
  announcements: Announcement[]
  minimum_version: string | null
  fetched_at: string
}

export interface FingerprintPresetUpdate {
  preset_key: string
  version: number
  changes: Record<string, unknown>
  description: string
  published_at: string
}

// ─── API Keys ──────────────────────────────────────────────────────────────────
export interface ApiKeyInfo {
  id: string
  key?: string // Only present on create/rotate
  name: string
  scopes: string[]
  created_at: string
  expires_at?: string | null
  last_used_at?: string | null
}

export interface ApiKeyUsage {
  key_id: string
  total_requests: number
  period: string
  breakdown?: Record<string, number>
}

// ─── Analytics ───────────────────────────────────────────────────────────────
export interface AnalyticsDashboardData {
  total_profiles: number
  active_sessions: number
  avg_detection_score: number | null
  detection_trend: Array<{ date: string; score: number }>
  feature_usage: Array<{ feature: string; count: number }>
  profile_creation_trend: Array<{ date: string; count: number }>
  proxy_health: { healthy: number; unhealthy: number; untested: number }
  top_presets: Array<{ preset: string; count: number }>
}

// ─── Cloud Profiles ────────────────────────────────────────────────────────────
export interface CloudProfile {
  id: string
  local_id: string | null
  name: string
  fingerprint_hash: string
  preset: string
  proxy_config: { type: string; country?: string } | null
  tags: string[]
  notes: string | null
  backed_up_at: string
  updated_at: string
  size_bytes: number
}

export interface CloudProfileDetail extends CloudProfile {
  fingerprint: string // JSON string
  cookies: string | null
  user_data_snapshot: boolean
}

export interface BackupResult {
  cloud_id: string
  fingerprint_hash: string
  backed_up_at: string
  size_bytes: number
}

export interface CloudProfileListResult {
  profiles: CloudProfile[]
  total: number
  storage_used_bytes: number
  storage_limit_bytes: number
}

// ─── Support ────────────────────────────────────────────────────────────────────
export type TicketCategory =
  | 'bug'
  | 'feature_request'
  | 'billing'
  | 'account'
  | 'detection'
  | 'proxy'
  | 'general'
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent'
export type TicketStatus = 'open' | 'in_progress' | 'waiting_reply' | 'resolved' | 'closed'

export interface SupportTicket {
  id: string
  subject: string
  category: TicketCategory
  priority: TicketPriority
  status: TicketStatus
  created_at: string
  updated_at: string
  last_reply_at: string | null
  message_count: number
}

export interface TicketAttachment {
  id: string
  filename: string
  size_bytes: number
  content_type: string
  url: string
}

export interface TicketMessage {
  id: string
  ticket_id: string
  author_type: 'user' | 'support' | 'system'
  author_name: string
  content: string
  attachments: TicketAttachment[]
  created_at: string
}

// ─── Billing (stub) ─────────────────────────────────────────────────────────────
export interface PaymentMethodSummary {
  type: 'card' | 'bank_transfer' | 'paypal'
  last4?: string
  brand?: string
  exp_month?: number
  exp_year?: number
}

export interface UpcomingInvoice {
  amount_due: number
  currency: string
  next_payment_date: string
  line_items: Array<{ description: string; quantity: number; unit_amount: number; amount: number }>
}

export interface BillingOverview {
  subscription_id: string | null
  plan_id: string | null
  plan_name: string | null
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid' | 'none'
  current_period_start: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  trial_end: string | null
  payment_method: PaymentMethodSummary | null
  upcoming_invoice: UpcomingInvoice | null
}

export interface Invoice {
  id: string
  number: string
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible'
  amount_due: number
  amount_paid: number
  currency: string
  created_at: string
  paid_at: string | null
  pdf_url: string | null
  hosted_url: string | null
}

export interface CheckoutSession {
  checkout_url: string
  session_id: string
}

export interface PricingPlan {
  id: string
  name: string
  description: string
  price_monthly: number
  price_yearly: number
  currency: string
  features: Record<string, unknown>
  limits: {
    max_profiles: number
    max_team_members: number
    max_workflows: number
    cloud_sync: boolean
    api_access: boolean
    priority_support: boolean
  }
  popular?: boolean
}

export interface UsageMeter {
  meter_id: string
  name: string
  current_usage: number
  limit: number | null
  unit: string
  reset_at: string | null
}
