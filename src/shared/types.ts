// ─── Fingerprint Types ────────────────────────────────────────────────────────

export interface FingerprintConfig {
  preset: string // e.g. 'win10-chrome120'
  os: OsConfig
  browser: BrowserConfig
  screen: ScreenConfig
  hardware: HardwareConfig
  locale: LocaleConfig
  webrtc: WebRtcConfig
  canvas: CanvasConfig
  webgl: WebGlConfig
  audio: AudioConfig
  fonts: FontConfig
  media: MediaConfig
  plugins: PluginConfig
  speech: SpeechConfig
}

export interface OsConfig {
  platform: 'Win32' | 'MacIntel' | 'Linux x86_64'
  version: string // e.g. '10.0.0', '14.0.0'
}

export interface BrowserConfig {
  userAgent: string
  platform: string
  vendor: string
  version: string // Chrome major version
  languages: string[]
}

export interface ScreenConfig {
  width: number
  height: number
  availWidth: number
  availHeight: number
  colorDepth: number
  pixelRatio: number
}

export interface HardwareConfig {
  deviceMemory: 1 | 2 | 4 | 8 | 16 | 32
  hardwareConcurrency: 2 | 4 | 6 | 8 | 12 | 16
  maxTouchPoints: number
}

export interface LocaleConfig {
  language: string // BCP47 e.g. 'en-US'
  languages: string[]
  timezone: string // IANA e.g. 'Asia/Ho_Chi_Minh'
}

export interface WebRtcConfig {
  enabled: boolean
  mode: 'disabled' | 'fake' | 'real'
}

export interface CanvasConfig {
  mode: 'noise' | 'block' | 'real'
  noiseSeed: number
}

export interface WebGlConfig {
  vendor: string // e.g. 'Google Inc. (NVIDIA)'
  renderer: string // e.g. 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 ...)'
  noiseSeed: number
}

export interface AudioConfig {
  mode: 'noise' | 'block' | 'real'
  noiseSeed: number
}

export interface FontConfig {
  mode: 'whitelist' | 'real'
  whitelist: string[] // font names to expose
}

export interface MediaConfig {
  audioInputs: number
  audioOutputs: number
  videoInputs: number
}

export interface PluginConfig {
  mode: 'realistic' | 'empty' | 'real'
}

export interface SpeechConfig {
  mode: 'filter' | 'real'
}

// ─── Proxy Types ──────────────────────────────────────────────────────────────

export interface ProxyConfig {
  id: string
  name: string
  type: 'http' | 'https' | 'socks5'
  host: string
  port: number
  username?: string
  password?: string
  country?: string
}

// ─── Profile Types ────────────────────────────────────────────────────────────

export interface Profile {
  id: string
  name: string
  group_id?: string
  group_name?: string
  group_color?: string
  fingerprint: FingerprintConfig
  proxy_id?: string
  proxy_label?: string
  cookies?: string
  notes?: string
  last_used_at?: string
  created_at: string
  user_data_path?: string
  status: 'active' | 'archived'
  rotation_mode?: 'none' | 'random' | 'round-robin'
  rotation_index?: number
}

export interface ProfileGroup {
  id: string
  name: string
  color: string
  created_at: string
}

// ─── IPC Channel Types ────────────────────────────────────────────────────────

export type IpcChannels = {
  'profiles:list': { req: void; res: Profile[] }
  'profiles:create': { req: CreateProfileInput; res: Profile }
  'profiles:delete': { req: string; res: void }
  'profiles:launch': { req: string; res: void }
  'profiles:close': { req: string; res: void }
  'profiles:active': { req: void; res: string[] }

  'proxies:list': { req: void; res: ProxyConfig[] }
  'proxies:create': { req: CreateProxyInput; res: ProxyConfig }
  'proxies:delete': { req: string; res: void }
  'proxies:test': { req: string; res: { latency_ms: number; healthy: boolean } }
}

export interface CreateProfileInput {
  name: string
  preset: string
  proxy_id?: string
  notes?: string
}

export interface CreateProxyInput {
  name: string
  type: 'http' | 'https' | 'socks5'
  host: string
  port: number
  username?: string
  password?: string
}

// ─── Auth Types ──────────────────────────────────────────────────────────────

export interface User {
  id: string
  email: string
  name: string
  avatar_url?: string
  team_id?: string
  role?: TeamRole
  created_at: string
}

export interface AuthTokens {
  access_token: string
  refresh_token: string
  expires_at: number // unix timestamp
}

export interface AuthState {
  user: User | null
  authenticated: boolean
  loading: boolean
}

export interface LoginInput {
  email: string
  password: string
}

export interface RegisterInput {
  email: string
  password: string
  name: string
}

// ─── License Types ───────────────────────────────────────────────────────────

export type LicensePlan = 'free' | 'starter' | 'professional' | 'enterprise'

export interface License {
  id: string
  plan: LicensePlan
  max_profiles: number
  max_team_members: number
  cloud_sync_enabled: boolean
  valid_until: string
  machine_id: string
  activated_at: string
}

export const PLAN_LIMITS: Record<LicensePlan, { profiles: number; members: number; sync: boolean }> = {
  free:         { profiles: 5,    members: 1,   sync: false },
  starter:      { profiles: 50,   members: 3,   sync: true },
  professional: { profiles: 500,  members: 15,  sync: true },
  enterprise:   { profiles: -1,   members: -1,  sync: true }  // -1 = unlimited
}

export interface LicenseState {
  license: License | null
  plan: LicensePlan
  usage: { profiles: number; members: number }
  loading: boolean
}

// ─── Team Types ──────────────────────────────────────────────────────────────

export type TeamRole = 'admin' | 'editor' | 'viewer'

export interface Team {
  id: string
  name: string
  owner_id: string
  created_at: string
}

export interface TeamMember {
  id: string
  user_id: string
  email: string
  name: string
  role: TeamRole
  joined_at: string
  avatar_url?: string
}

export interface TeamInvite {
  id: string
  email: string
  role: TeamRole
  invited_by: string
  created_at: string
  expires_at: string
  status: 'pending' | 'accepted' | 'expired'
}

export interface SharedProfile {
  profile_id: string
  profile_name: string
  shared_by: string
  permission: 'read' | 'write'
  shared_at: string
}

export interface AuditLogEntry {
  id: string
  user_id: string
  user_name: string
  action: 'profile:launch' | 'profile:create' | 'profile:delete' | 'profile:export' | 'team:invite' | 'team:remove' | 'settings:update'
  target_id?: string
  target_name?: string
  timestamp: string
  ip_address?: string
}

// ─── Cloud Sync Types ────────────────────────────────────────────────────────

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline' | 'disabled'

export interface SyncState {
  status: SyncStatus
  last_synced_at: string | null
  pending_changes: number
  error_message?: string
}

export interface SyncManifest {
  version: number
  profile_ids: string[]
  last_modified: string
  checksum: string
}

// ─── Automation / RPA Types ─────────────────────────────────────────────────

export type AutomationActionType =
  | 'navigate'
  | 'click'
  | 'type'
  | 'wait'
  | 'waitForSelector'
  | 'screenshot'
  | 'extractText'
  | 'scroll'
  | 'select'
  | 'keyPress'
  | 'evaluate'
  | 'conditional'
  | 'loop'

export interface AutomationStep {
  id: string
  action: AutomationActionType
  label?: string
  params: Record<string, any>
  // For conditional: { selector: string, thenSteps: string[], elseSteps: string[] }
  // For loop: { times: number, steps: string[] }
}

export interface AutomationWorkflow {
  id: string
  name: string
  description?: string
  steps: AutomationStep[]
  created_at: string
  updated_at: string
}

export interface AutomationStepResult {
  stepId: string
  action: AutomationActionType
  success: boolean
  duration_ms: number
  output?: any
  error?: string
}

export interface AutomationRunResult {
  workflowId: string
  profileId: string
  status: 'completed' | 'failed' | 'stopped'
  startedAt: string
  completedAt: string
  stepResults: AutomationStepResult[]
  error?: string
}

export interface CreateWorkflowInput {
  name: string
  description?: string
  steps: AutomationStep[]
}

export interface UpdateWorkflowInput {
  name?: string
  description?: string
  steps?: AutomationStep[]
}
