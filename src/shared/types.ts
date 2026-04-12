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
  network?: NetworkConfig
  geolocation?: GeolocationConfig
  // Phase 6
  behavior?: BehaviorConfig
  timing?: TimingConfig
  // Phase 8
  phase8?: Phase8Config
}

export interface GeolocationConfig {
  latitude: number
  longitude: number
  accuracy: number
}

export interface OsConfig {
  platform: 'Win32' | 'MacIntel' | 'Linux x86_64' | 'Linux armv8l' | 'iPhone' | 'iPad'
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
  hardwareConcurrency: 2 | 4 | 6 | 8 | 10 | 12 | 16 | 20 | 24
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

export interface NetworkConfig {
  connectionType: '4g' | '3g' | 'wifi' | 'slow'
}

// Phase 6: Behavior simulation config
// Phase 17: Extended with fine-grained parameters exposed in the
// Behavioral Config UI. All advanced fields are optional so older
// profiles continue to work unchanged — the scripts pick sensible
// defaults derived from the legacy boolean toggles.
export interface BehaviorConfig {
  // Mouse movement simulation: adds micro-jitter on pointer events
  mouseJitter: boolean
  // Typing cadence: randomizes keydown/keyup event timing
  typingNoise: boolean
  // Scroll inertia: simulates natural momentum on wheel events
  scrollInertia: boolean

  // ── Phase 17: Advanced mouse jitter tuning ──────────────────────────────
  /** Gaussian sigma (px) applied to clientX/Y on pointer events. 0.1–2.0 */
  mouseJitterSigma?: number
  /** Intensity preset label — used by the UI to describe the current sigma */
  mouseJitterIntensity?: 'off' | 'subtle' | 'moderate' | 'heavy'

  // ── Phase 17: Typing cadence tuning ────────────────────────────────────
  /** Target typing speed in words-per-minute. 40–180 */
  typingWpm?: number
  /** Percentage variance around typingWpm (e.g. 15 = ±15%). 0–50 */
  typingVariancePct?: number
  /** Key-hold duration jitter sigma in ms. 1–15 */
  typingHoldSigmaMs?: number

  // ── Phase 17: Scroll inertia tuning ────────────────────────────────────
  /** Decay multiplier applied on each wheel event (0.7–0.98). */
  scrollDecay?: number
  /** Noise sigma in px added to each delta on scroll inertia. 0–5 */
  scrollNoisePx?: number
}

// Phase 6: Timing attack defense config
// Phase 17: Extended with advanced knobs — rAF jitter sigma, SAB/Atomics
// noise toggle. Legacy fields are unchanged.
export interface TimingConfig {
  // Reduce Date.now() precision to 100ms blocks
  dateNoisePrecision: 50 | 100 | 250
  // Add jitter to requestAnimationFrame timestamps (±noise ms)
  rafJitter: boolean
  // Clamp performance.now() to same precision as Date.now
  performanceClamp: boolean

  // ── Phase 17 ───────────────────────────────────────────────────────────
  /** Gaussian sigma (ms) added to rAF timestamps when rafJitter is on. 0.1–5 */
  rafJitterSigmaMs?: number
  /** Inject jitter into Atomics.wait() return timing (SAB-based timers) */
  atomicsWaitNoise?: boolean
}

// ── Phase 17: Behavioral Config UI — shared presets ────────────────────────
/** Builtin presets shown in the Behavioral Config UI */
export type BehaviorPresetId = 'off' | 'subtle' | 'balanced' | 'heavy' | 'stealth'

export interface BehaviorPreset {
  id: BehaviorPresetId
  name: string
  description: string
  behavior: BehaviorConfig
  timing: TimingConfig
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
  latency_ms?: number
  is_healthy?: number
  last_checked_at?: string
  created_at?: string
}

// ─── Phase 20 — Proxy Provider Marketplace ──────────────────────────────────
// (Tracked under user-facing "Phase 17 — Proxy API Integration" label)
//
// Adapters for built-in residential / datacenter proxy providers so users
// can plug in their existing Smartproxy / BrightData / Oxylabs accounts and
// generate working proxy entries on demand without manual host:port setup.

export type ProxyProviderType = 'smartproxy' | 'brightdata' | 'oxylabs' | 'custom'

export type ProxyPoolType = 'residential' | 'datacenter' | 'mobile' | 'isp'

export type ProxySessionType = 'rotating' | 'sticky'

/** Static catalog entry — describes a known provider's capabilities. */
export interface ProxyProviderCatalogEntry {
  type: ProxyProviderType
  name: string
  website: string
  description: string
  pools: ProxyPoolType[]
  /** Public docs URL where the user fetches credentials */
  docsUrl: string
  /** Default rotating endpoint hostname */
  defaultEndpoint: string
  /** Default port for HTTP gateway */
  defaultPort: number
  /** Whether the provider exposes a REST API for usage / sub-user management */
  hasUsageApi: boolean
  /** SEA-region pool support flag (Vietnam, Thailand, Indonesia, Philippines) */
  supportsSeaRegions: boolean
}

/** A user-configured account for a single provider. */
export interface ProxyProviderAccount {
  id: string
  type: ProxyProviderType
  label: string
  /** Endpoint hostname override (defaults to catalog entry) */
  endpoint: string
  port: number
  /** Default pool to draw from when generating proxies */
  defaultPool: ProxyPoolType
  /** Default session type for generated proxies */
  defaultSession: ProxySessionType
  /** Last-known account status */
  status: 'unverified' | 'active' | 'invalid' | 'error'
  lastTestedAt?: string | null
  lastError?: string | null
  /** Cached usage snapshot from last refresh */
  usage?: ProxyProviderUsage | null
  createdAt: string
  updatedAt: string
}

/** Sensitive credentials — never sent to renderer. */
export interface ProxyProviderCredentialsInput {
  username: string
  password: string
  /** Optional REST API key (BrightData / Smartproxy dashboards) */
  apiKey?: string
  /** Optional zone or sub-user identifier (BrightData zones, Oxylabs sub-users) */
  zone?: string
}

/** Renderer-safe view (no secrets, just metadata) */
export interface ProxyProviderAccountView extends ProxyProviderAccount {
  hasCredentials: boolean
  hasApiKey: boolean
  catalog: ProxyProviderCatalogEntry
}

/** Snapshot of remaining bandwidth / requests reported by the provider. */
export interface ProxyProviderUsage {
  /** GiB available on the plan */
  bandwidthGbTotal?: number
  /** GiB consumed so far */
  bandwidthGbUsed?: number
  /** Requests included in plan */
  requestsTotal?: number
  /** Requests consumed */
  requestsUsed?: number
  /** Plan name reported by provider (e.g. "Residential Pro") */
  planName?: string
  /** ISO timestamp when usage was last fetched */
  refreshedAt: string
}

/** Result of testing a provider's credentials. */
export interface ProxyProviderTestResult {
  ok: boolean
  /** Latency in ms for the test request */
  latencyMs?: number
  /** Public IP returned by the test endpoint */
  exitIp?: string
  /** Error message when ok=false */
  error?: string
}

/** Options when generating proxies from a provider. */
export interface ProxyGenerationOptions {
  /** Number of proxy entries to generate */
  count: number
  /** Country code (ISO 3166-1 alpha-2) — e.g. "VN", "TH", "ID" */
  country?: string
  /** Pool type override */
  pool?: ProxyPoolType
  /** Session strategy override */
  session?: ProxySessionType
  /** Optional state / city filter (provider-specific) */
  region?: string
  /** Sticky-session lifetime in minutes (when session=sticky) */
  stickyMinutes?: number
}

/** Proxy entries generated by a provider before being persisted. */
export interface GeneratedProxy {
  name: string
  type: 'http' | 'socks5'
  host: string
  port: number
  username: string
  password: string
  country?: string
  /** Provider account id this proxy belongs to */
  providerAccountId: string
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
  // Phase 11.2 / 11.3
  drift_enabled?: number | boolean
  last_drift_at?: string | null
  warmed_up?: number | boolean
  // Account C5: per-profile selective sync opt-out
  sync_excluded?: number | boolean
}

// Phase 10.2 — Workflow scheduling
export interface WorkflowSchedule {
  id: string
  name: string
  workflow_id: string
  profile_ids: string[]
  cron: string
  enabled: boolean
  last_run_at: string | null
  next_run_at: string | null
  created_at: string
}

// Phase 10.3 — Per-profile browser extensions
export interface ProfileExtension {
  id: string
  profile_id: string
  name: string
  path: string
  enabled: boolean
  created_at?: string
}

// Phase 11.2 — Profile warm-up
export interface WarmUpResult {
  visited: { url: string; success: boolean; ms: number; error?: string }[]
  durationMs: number
}

// ── Smart Warm-Up Engine (7-day organic ramp) ──────────────────────────────
//
// The Smart Warm-Up Engine graduates a fresh profile from "cold" to
// "ready for automation" over a 7-day schedule. Each day runs one warm-up
// session with a distinct **stage**:
//
//   1. benign           — neutral browsing (search engines, news, wiki)
//   2. benign           — same, slightly more dwell + scrolling
//   3. interests        — topical content (youtube, reddit) tuned to the target region
//   4. interests        — light engagement (hovers, category clicks)
//   5. platform-adjacent— navigate the actual SEA platform *without* logging in
//   6. platform-active  — deeper platform navigation (search, scroll, product views)
//   7. ready            — final dry-run session mirroring the real automation flow
//
// The plan's `fake_account_age_days` backdates the profile's `created_at`
// column so it looks like the profile has existed for N days before the
// warm-up started — a useful vector against platforms that throttle
// "newly-seen" browsers.

export type WarmUpStage =
  | 'benign'
  | 'interests'
  | 'platform-adjacent'
  | 'platform-active'
  | 'ready'

export type WarmUpPlanStatus =
  | 'pending'    // created, day 1 not yet run
  | 'running'    // at least one session executed, plan in progress
  | 'completed'  // all 7 days finished
  | 'paused'     // user paused
  | 'failed'     // terminal failure (too many failed sessions)
  | 'cancelled'  // user cancelled

export type WarmUpRegion = 'VN' | 'TH' | 'ID' | 'MY' | 'PH' | 'SG' | 'global'

export interface WarmUpPlan {
  id: string
  profile_id: string
  profile_name?: string
  region: WarmUpRegion
  /** Platform ids (ids from sea-platforms.ts) this plan ramps toward. */
  target_platforms: string[]
  total_days: number          // almost always 7, configurable
  current_day: number         // 0 = not started; 1..total_days = day completed
  status: WarmUpPlanStatus
  /** Fake account-age backdating — this many days are subtracted from created_at. */
  fake_account_age_days: number
  /** The ISO date the plan was created (real, not backdated). */
  created_at: string
  started_at: string | null
  completed_at: string | null
  last_session_at: string | null
  next_run_at: string | null
  /** Free-form notes. */
  notes?: string
}

export interface WarmUpInteraction {
  type:
    | 'navigate'
    | 'scroll'
    | 'mouse-move'
    | 'hover'
    | 'click'
    | 'search'
    | 'dwell'
    | 'type'
  target?: string     // URL / selector / query
  ms: number          // how long it took
  ok: boolean
  error?: string
}

export interface WarmUpSession {
  id: string
  plan_id: string
  profile_id: string
  day: number            // 1..total_days
  stage: WarmUpStage
  /** URLs the session visited, in order. */
  visited: string[]
  /** Organic interactions synthesized during the session. */
  interactions: WarmUpInteraction[]
  /** Net engagement score 0..100 computed from interactions. */
  engagement_score: number
  duration_ms: number
  /** Whether the session was considered successful (used to advance the plan). */
  success: boolean
  error?: string
  started_at: string
  completed_at: string | null
}

export interface CreateWarmUpPlanInput {
  profile_id: string
  region?: WarmUpRegion
  target_platforms?: string[]
  total_days?: number
  fake_account_age_days?: number
  /** If true, apply fake account-age backdating immediately to the profile row. */
  apply_fake_age_now?: boolean
}

export interface WarmUpPlanProgress {
  plan: WarmUpPlan
  sessions: WarmUpSession[]
  /** Day index 1..total_days the engine will run next (or null if complete). */
  next_day: number | null
  /** Whether the next session is due right now (based on schedule spacing). */
  next_due: boolean
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

/**
 * Partial update for an existing proxy. Every field is optional; omitted
 * fields are left untouched by the backend. Passing `null` for an optional
 * credential field explicitly clears it.
 */
export interface UpdateProxyInput {
  name?: string
  type?: 'http' | 'https' | 'socks5'
  host?: string
  port?: number
  username?: string | null
  password?: string | null
  country?: string | null
}

// ─── Auth Types ──────────────────────────────────────────────────────────────

export interface User {
  id: string
  email: string
  /** Display name — mapped from server's `full_name` field. */
  name: string
  avatar_url?: string
  team_id?: string
  role?: TeamRole
  created_at: string
  /** Email verification status from server. */
  email_verified?: boolean
  email_verified_at?: string | null
  /** Server status: active | suspended | deleted */
  status?: string
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

// ─── Server API Types ───────────────────────────────────────────────────────

/**
 * Server error response format:
 * { error: "code", message: "...", code: 400, timestamp: "..." }
 */
export interface ServerApiError {
  error: string
  message: string
  code: number
  timestamp: string
  requestId?: string
}

// Keep legacy aliases for backward compatibility with renderer code
export type CommonApiError = ServerApiError
export interface CommonApiResponse<T> {
  data?: T
  total?: number
  page?: number
  limit?: number
  pages?: number
}

/**
 * Server auth response for login/register:
 * { user: {...}, tokens: { access_token, refresh_token, expires_at } }
 */
export interface CommonAuthResponse {
  user: {
    id: string
    email: string
    full_name: string | null
    email_verified: boolean
    status: string
    created_at: string
    updated_at: string
  }
  tokens: {
    access_token: string
    refresh_token: string
    expires_at: number
  }
}

/** API Key as returned by the Common SaaS API. */
export interface ApiKeyInfo {
  id: string
  key?: string        // Only present on create/rotate
  name: string
  scopes: string[]
  created_at: string
  expires_at?: string | null
  last_used_at?: string | null
}

export interface ApiKeyCreateInput {
  name: string
  scopes: string[]
  expires_in?: number // days
}

export interface ApiKeyUsage {
  key_id: string
  total_requests: number
  period: string
  breakdown?: Record<string, number>
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
  // L9: trial badge — populated by backend when the current paid plan
  // is part of a trial period rather than a paid subscription.
  is_trial?: boolean
  trial_ends_at?: string | null
  // E1: multi-machine seat counters. Both fields are optional so older
  // backends keep working — the renderer only shows the seat row when
  // both numbers are present.
  seats_used?: number
  seats_max?: number
}

// E1: Per-machine activation record returned by /licenses/devices.
export interface LicenseDevice {
  machine_id: string
  label?: string | null
  os?: string | null
  last_seen_at: string | null
  activated_at: string
  is_current: boolean
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

export interface SyncLogEntry {
  id: string
  direction: 'push' | 'pull'
  profile_count: number
  status: 'success' | 'error'
  synced_at: string
  error_message?: string | null
}

export interface SyncConflict {
  profile_id: string
  profile_name: string
  local_updated_at: string | null
  remote_updated_at: string | null
}

export interface SyncPullResult {
  imported: number
  conflicts: SyncConflict[]
}

// S3: Local-vs-remote diff summary computed before push/pull so the user
// can preview what's about to change. Counts profiles only — extensions
// and other artifacts are tracked separately.
export interface SyncDiff {
  // Local profile ids that are not in the cloud manifest yet (would be uploaded)
  local_only: { id: string; name: string }[]
  // Remote profile ids that are missing locally (would be downloaded)
  remote_only: string[]
  // Profile ids present in both — could be modified on either side
  shared: number
  // Sum totals so the renderer can show "5 → cloud · 2 ← local · 12 in sync"
  // without re-computing.
  local_count: number
  remote_count: number
}

// ─── Typed Variables (Phase 1 — Workflow Gaps) ──────────────────────────────

/** Supported variable types for the automation engine typed-variable system. */
export type VariableType = 'string' | 'number' | 'boolean' | 'array' | 'object'

/** Declaration for a workflow variable — defines its name, type, and default. */
export interface VariableDefinition {
  name: string
  type: VariableType
  description?: string
  default?: any
  required?: boolean
}

/** A runtime typed variable holding a value and its type metadata. */
export interface TypedVariable {
  value: any
  type: VariableType
  /** The step ID that last wrote this variable. */
  sourceStep?: string
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
  | 'hover'
  | 'rightClick'
  | 'doubleClick'
  | 'waitForNavigation'
  | 'setAttribute'
  | 'httpRequest'
  // Phase 12.B.3 — File transfer
  | 'upload'
  | 'download'
  // Phase 12.B.1 — Captcha solving
  | 'solveCaptcha'
  | 'injectCaptchaToken'
  // Phase 12.C.3 — Encrypted credential vault
  | 'useCredential'
  // Tier 3 RPA — Assertion framework
  | 'assert'
  // Tier 4 RPA — Multi-tab management
  | 'openTab'
  | 'switchTab'
  | 'closeTab'
  | 'getTabs'
  // Tier 4 RPA — Proxy rotation mid-workflow
  | 'switchProxy'
  // Tier 4 RPA — Text-based click (DOM XPath + coordinate fallback)
  | 'clickByText'
  // Tier 5 RPA — Storage inspection
  | 'getStorage'
  | 'setStorage'
  | 'clearStorage'
  | 'queryIndexedDB'
  // Tier 1 RPA — Workflow chaining, parallel steps, control flow
  | 'callWorkflow'
  | 'parallelSteps'
  | 'jumpToStep'
  // Tier 1 RPA — Network interception
  | 'interceptRequest'
  | 'clearIntercepts'
  // Tier 1 RPA — Cookie management
  | 'getCookies'
  | 'setCookies'
  | 'deleteCookies'
  // Tier 6 RPA — Data-driven automation & file handling
  | 'forEachRow'
  | 'readFile'
  | 'writeFile'
  | 'waitForDownload'
  // Tier 7 RPA — Error recovery & resilience
  | 'tryCatch'
  // Tier 9 RPA — Advanced element interactions
  | 'dragAndDrop'
  | 'keyCombo'
  | 'selectContextMenu'
  | 'setRangeInput'
  | 'scrollIntoView'
  | 'switchFrame'
  // Phase 18 RPA — Data pipelines & advanced control flow
  | 'extractJson'
  | 'forEachElement'
  | 'whileLoop'
  | 'waitForRequest'
  | 'waitForResponse'
  | 'paginate'
  // Phase 4 — Enhanced flow control
  | 'break'       // Exit the current loop (loop, whileLoop, forEachRow, forEachElement)
  | 'continue'    // Skip to next iteration of the current loop
  | 'switch'      // Multi-way branching based on expression/variable value

export interface AutomationStep {
  id: string
  action: AutomationActionType
  label?: string
  params: Record<string, any>
  /** Retry up to N times on failure before marking the step failed */
  retries?: number
  /** Delay in ms between retries (default 1000) */
  retryDelay?: number
  /** Tier 7: Backoff strategy between retries. Default 'fixed'. */
  retryBackoff?: 'fixed' | 'linear' | 'exponential'
  /** Phase 2: Add jitter to retry delays to avoid thundering herd. Default false. */
  retryJitter?: boolean
  /** Phase 2: Maximum delay cap in ms for exponential backoff. Default 30000. */
  retryMaxDelay?: number
  /** Tier 7: Only retry when error message matches one of these substrings/regex.
   *  If absent, retries on any error. */
  retryOn?: string[]
  /** Tier 7: On final failure, jump to the step with this id (skipping the
   *  rest of the current step list). The targeted step is reached even if
   *  it sits later in the parent. Mark step as soft-failed (recorded as
   *  failed but doesn't bubble up the failure status). */
  onErrorGoto?: string
  /** Tier 7: Per-step timeout (ms). When set, the action is racing against
   *  this timer and will be marked failed if it exceeds. */
  timeoutMs?: number
  /** Phase 1 Typed Variables: Explicitly declare the output type of saveAs.
   *  When omitted, the engine infers the type from the action & value. */
  saveAsType?: VariableType
  // For conditional: { conditionType?, selector, expected?, script?, thenSteps, elseSteps }
  // For loop: { times: number, steps: AutomationStep[] }
  // For tryCatch: { tryBlock: AutomationStep[], catchBlock: AutomationStep[], finallyBlock?: AutomationStep[], errorPrefix?: string }
  // For extractText/evaluate/httpRequest: add saveAs to write result to a variable
  // Phase 18: any saveAs-producing step can include `transform` (string | string[])
  //   with ops like: trim | upper | lower | number | length |
  //                  jsonPath:$.x.y | regex:pattern | split:sep:index |
  //                  replace:find:with | prefix:str | suffix:str
}

export interface AutomationWorkflow {
  id: string
  name: string
  description?: string
  steps: AutomationStep[]
  /** Legacy string-only variables (backward compatible). */
  variables?: Record<string, string>
  /** Phase 1 Typed Variables: optional declarations for variable names, types, defaults. */
  variableDefinitions?: VariableDefinition[]
  /** Phase 2: Circuit breaker configuration for this workflow. When set, the
   *  engine monitors consecutive failures and can trip the circuit to prevent
   *  further execution until a cooldown period passes. */
  circuitBreaker?: CircuitBreakerConfig
  /** Phase 3: AI-powered step recovery configuration. When enabled, the engine
   *  calls the AI assistant to generate recovery steps after a step fails. */
  aiRecovery?: AiRecoveryConfig
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
  /** Phase 1 Typed Variables: variables written by this step with their types. */
  savedVariables?: Record<string, { value: any; type: VariableType }>
  /** Phase 2 Error Handling: categorized error type for smarter recovery. */
  errorCategory?: ErrorCategory
  /** Phase 2 Error Handling: full error context stack for debugging. */
  errorContext?: ErrorContext[]
  /** Phase 2 Error Handling: which retry attempt succeeded (0 = first try). */
  retryAttempt?: number
}

export interface AutomationRunResult {
  workflowId: string
  profileId: string
  status: 'completed' | 'failed' | 'stopped'
  startedAt: string
  completedAt: string
  stepResults: AutomationStepResult[]
  error?: string
  /** Phase 2: Aggregated run metrics (retries, circuit breaker, error stack). */
  metrics?: AutomationRunMetrics
}

export interface WorkflowDryRunResult {
  valid: boolean
  stepCount: number
  errors: string[]
  warnings: string[]
  variableNames: string[]
  actionTypes: string[]
  estimatedDurationMs: number | null
}

export interface CreateWorkflowInput {
  name: string
  description?: string
  steps: AutomationStep[]
  variables?: Record<string, string>
  variableDefinitions?: VariableDefinition[]
  circuitBreaker?: CircuitBreakerConfig
  aiRecovery?: AiRecoveryConfig
}

export interface UpdateWorkflowInput {
  name?: string
  description?: string
  steps?: AutomationStep[]
  variables?: Record<string, string>
  variableDefinitions?: VariableDefinition[]
  circuitBreaker?: CircuitBreakerConfig
  aiRecovery?: AiRecoveryConfig
}

// ─── Phase 2: Circuit Breaker & Error Handling Types ─────────────────────────

/** Categorized error types for smarter retry/recovery decisions. */
export type ErrorCategory =
  | 'timeout'      // waitForSelector, page.goto, step timeout
  | 'network'      // net::ERR_*, httpRequest failures, proxy errors
  | 'selector'     // element not found, selector mismatch
  | 'validation'   // assertion failures, type mismatches
  | 'navigation'   // page navigation errors, redirect loops
  | 'captcha'      // captcha solving failures
  | 'permission'   // file access denied, CDP permission errors
  | 'unknown'      // unclassified errors

/** Snapshot of execution context at the point of failure. */
export interface ErrorContext {
  stepId: string
  action: AutomationActionType
  errorMessage: string
  errorCategory: ErrorCategory
  timestamp: string
  /** Attempt number (1-based) when this error occurred. */
  attempt: number
  /** URL of the page when the error happened. */
  pageUrl?: string
  /** Screenshot path captured on failure (if enabled). */
  screenshotPath?: string
  /** Snapshot of variables at the moment of failure. */
  variableSnapshot?: Record<string, string>
}

/** Configuration for the per-workflow circuit breaker. */
export interface CircuitBreakerConfig {
  /** Number of consecutive failures before the circuit opens. Default 5. */
  failureThreshold: number
  /** Number of consecutive successes in HALF_OPEN to close the circuit. Default 2. */
  successThreshold: number
  /** How long (ms) to wait in OPEN state before transitioning to HALF_OPEN. Default 30000. */
  resetTimeoutMs: number
  /** Max requests allowed in HALF_OPEN state before deciding. Default 3. */
  halfOpenMaxAttempts?: number
}

/** Runtime state of a circuit breaker instance. */
export interface CircuitBreakerState {
  status: 'CLOSED' | 'OPEN' | 'HALF_OPEN'
  failureCount: number
  successCount: number
  lastFailureTime?: string
  nextAttemptTime?: string
  /** Total times this breaker has tripped OPEN during the run. */
  tripCount: number
}

/** Extended run result with circuit breaker and error context info. */
export interface AutomationRunMetrics {
  /** Total steps executed (including retries). */
  totalAttempts: number
  /** Steps that required retries. */
  retriedSteps: number
  /** Circuit breaker final state (if enabled). */
  circuitBreakerState?: CircuitBreakerState
  /** Aggregated error context stack from all failed steps. */
  errorStack: ErrorContext[]
  /** Phase 3: AI recovery interventions during this run. */
  aiInterventions?: AiRecoveryIntervention[]
}

// ─── Phase 3: AI Step Recovery Types ─────────────────────────────────────────

/** Configuration for AI-powered step recovery on a workflow. */
export interface AiRecoveryConfig {
  /** Enable AI recovery when a step fails (after retries exhausted). Default false. */
  enabled: boolean
  /** Maximum recovery steps the AI may generate per failure. Default 3. */
  maxSteps?: number
  /** Maximum AI recovery attempts per workflow run. Default 5. */
  maxRecoveriesPerRun?: number
  /** Error categories the AI should NOT attempt recovery for. */
  excludeCategories?: ErrorCategory[]
}

/** Record of a single AI recovery intervention during a workflow run. */
export interface AiRecoveryIntervention {
  /** ID of the step that failed and triggered recovery. */
  failedStepId: string
  /** The action of the failed step. */
  failedAction: AutomationActionType
  /** Error that triggered the recovery. */
  failureReason: string
  /** Error category of the failure. */
  failureCategory: ErrorCategory
  /** Recovery steps generated by the AI. */
  recoverySteps: AutomationStep[]
  /** Whether the recovery steps succeeded. */
  success: boolean
  /** Time taken for the AI to generate + execute recovery. */
  duration_ms: number
  /** Timestamp of the intervention. */
  timestamp: string
}

/** Result returned by the AI recovery step generator. */
export interface AiRecoveryResult {
  /** Generated recovery steps to attempt. */
  steps: AutomationStep[]
  /** AI's reasoning for the suggested recovery. */
  reasoning: string
  /** Confidence level. */
  confidence: 'high' | 'medium' | 'low'
}

// ─── Automation API Server Types ───────────────────────────────────────────

export interface ApiServerConfig {
  enabled: boolean
  port: number        // default 9222
  authToken?: string  // optional bearer token for auth
}

export interface ApiServerStatus {
  running: boolean
  port: number
  url: string
}

// ─── Workflow Template Types ───────────────────────────────────────────────

export interface WorkflowTemplate {
  id: string
  name: string
  description: string
  category:
    | 'scraping'
    | 'testing'
    | 'social'
    | 'ecommerce'
    | 'general'
    // Phase 17 — SEA Platform Templates
    | 'sea-ecommerce'
    | 'sea-payments'
    | 'sea-social'
  steps: AutomationStep[]
  /** Phase 17 — SEA platform id (e.g. 'shopee', 'lazada', 'tiktok-shop', 'vnpay', 'tiki') */
  platform?: string
  /** Phase 17 — ISO country code scope (e.g. 'VN', 'TH', 'ID', 'MY', 'PH', 'SG') */
  region?: string
  /** Phase 17 — free-form tags for search / filtering */
  tags?: string[]
}

// ─── Phase 17 — SEA Platform Catalog ────────────────────────────────────────

export type SeaPlatformKind = 'ecommerce' | 'payment' | 'social' | 'ride-hail' | 'delivery'

export interface SeaPlatform {
  /** Stable id, e.g. 'shopee', 'lazada', 'tiktok-shop', 'vnpay', 'tiki' */
  id: string
  /** Display name */
  name: string
  /** Short description shown in the catalog card */
  description: string
  /** High-level category */
  kind: SeaPlatformKind
  /** Countries this platform is primarily used in (ISO-3166-1 alpha-2) */
  regions: string[]
  /** Primary currencies (ISO-4217), used for labelling only */
  currencies: string[]
  /** Default base URL for the main region (used by templates) */
  baseUrl: string
  /** Per-region base URL overrides (optional) */
  regionUrls?: Record<string, string>
  /** Recommended fingerprint preset keys */
  recommendedPresets: string[]
  /** Recommended behaviour archetypes (from AI archetype library) */
  recommendedArchetypes: string[]
  /** Common DOM selectors used by this platform's templates */
  selectors: Record<string, string>
  /** Known anti-bot / detection quirks to watch for */
  notes: string[]
  /** Lucide icon name used in the UI */
  icon: string
  /** Tailwind text color class for the UI card accent */
  accent: string
  /** Phase 17 — workflow template ids that target this platform */
  templateIds: string[]
}

// ─── Profile Version Types (Phase 6) ─────────────────────────────────────────

export interface ProfileVersion {
  id: string
  profileId: string
  fingerprint: FingerprintConfig
  savedAt: string
  label: string
}

// ── Profile Health Score ─────────────────────────────────────────────────────

export interface ProfileHealthScore {
  profileId: string
  overallScore: number          // 0-100
  detectionScore: number        // 0-100 (from latest detection test)
  behaviorScore: number         // 0-100 (inverse of bot_consistency_score)
  freshnessScore: number        // 0-100 (based on last_used_at recency)
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  factors: ProfileHealthFactor[]
  calculatedAt: string
}

export interface ProfileHealthFactor {
  name: string
  score: number
  weight: number
  detail: string
}

// ─── Workflow Version Types (Tier 3) ─────────────────────────────────────────

export interface WorkflowVersion {
  id: string
  workflowId: string
  name: string
  description: string
  steps: AutomationStep[]
  variables: Record<string, string>
  savedAt: string
  label: string
}

// ─── Assert Action Result (Tier 3) ──────────────────────────────────────────

// Tier 5: Workflow execution hooks
export type WorkflowHookEvent =
  | 'before-step'
  | 'after-step'
  | 'before-workflow'
  | 'after-workflow'
  | 'step-error'
  // Phase 17.H — Platform-Specific Detection Hardening
  | 'pre-flight-validation'
  | 'live-adjustment'

export interface WorkflowHook {
  event: WorkflowHookEvent
  handler: (data: any) => void | Promise<void>
}

// ─── Phase 17.H — Platform-Specific Detection Hardening ────────────────────
//
// The pre-flight validator inspects a workflow + profile BEFORE execution and
// surfaces platform-specific tuning recommendations. When a challenge is
// encountered during execution (CAPTCHA, rate-limit, slider), the live
// adjustment engine can emit updated tuning hints so the UI can react.

export type HardenerSeverity = 'info' | 'warning' | 'critical'

export interface HardenerIssue {
  /** Stable id — `missing-behavior`, `preset-mismatch`, `timing-weak`, etc. */
  code: string
  severity: HardenerSeverity
  /** One-line human-readable message shown in the pre-flight card */
  message: string
  /** Optional longer explanation + rationale for the recommendation */
  detail?: string
  /** When present, the renderer shows a "Fix it" button that applies the
   *  recommended config patch (merged into the profile fingerprint). */
  suggestedFix?: HardenerFix
}

export interface HardenerFix {
  /** Human-readable summary of what the fix will change */
  label: string
  /** BehaviorConfig fields to merge into profile.fingerprint.behavior */
  behavior?: Partial<BehaviorConfig>
  /** TimingConfig fields to merge into profile.fingerprint.timing */
  timing?: Partial<TimingConfig>
  /** Apply a full behavior preset by id — takes precedence over partials */
  applyPreset?: BehaviorPresetId
  /** Switch the profile to a fingerprint preset (e.g. 'android-pixel-chrome121') */
  applyFingerprintPreset?: string
}

/** A tuning hint tailored for a specific SEA platform. */
export interface PlatformTuningHint {
  /** Platform id from SEA_PLATFORMS catalog, or `generic` if unknown */
  platformId: string
  platformName: string
  /** When the target URL matched a regional URL, the ISO-3166 country code */
  detectedRegion?: string
  /** Short rationale shown at the top of the validator card */
  summary: string
  /** Recommended behavior preset id the profile should use */
  recommendedBehaviorPreset: BehaviorPresetId
  /** Ideal behavior config values (mouse jitter, scroll inertia, typing) */
  recommendedBehavior: BehaviorConfig
  /** Ideal timing config values (rAF jitter, date precision, etc.) */
  recommendedTiming: TimingConfig
  /** Recommended fingerprint preset keys for this platform */
  recommendedFingerprintPresets: string[]
  /** Free-form tuning tips shown as bullet points in the UI */
  tips: string[]
}

/** Full result of the pre-flight validation. */
export interface PreFlightValidationResult {
  workflowId: string
  profileId: string
  profileName: string
  /** ISO timestamp when the validation ran */
  validatedAt: string
  /** Detected platform (or null when none matched) */
  platform: PlatformTuningHint | null
  /** Extracted target URL used for platform detection, if any */
  targetUrl?: string
  /** Overall verdict — "ready" = no warnings, "warn" = at least one
   *  warning, "block" = a critical issue must be fixed before running */
  verdict: 'ready' | 'warn' | 'block'
  /** All issues found, sorted by severity (critical → warning → info) */
  issues: HardenerIssue[]
  /** Snapshot of the profile's current behavior/timing config, for diffing */
  currentBehavior?: BehaviorConfig
  currentTiming?: TimingConfig
}

/** Payload emitted by the live-adjustment engine while a workflow runs. */
export interface LiveAdjustmentEvent {
  workflowId: string
  profileId: string
  /** ISO timestamp when the challenge was observed */
  observedAt: string
  /** `captcha`, `slider`, `rate-limit`, `step-error`, `selector-miss`… */
  challengeKind: string
  /** Short human-readable description of what was detected */
  description: string
  /** Recommended fix the renderer can apply in one click */
  suggestedFix: HardenerFix
  /** Whether the fix has already been auto-applied by the engine */
  autoApplied: boolean
}

export type AssertType =
  | 'element-exists'
  | 'element-not-exists'
  | 'text-equals'
  | 'text-contains'
  | 'text-not-contains'
  | 'url-matches'
  | 'url-contains'
  | 'variable-equals'
  | 'variable-contains'
  | 'variable-truthy'
  | 'element-count'
  | 'page-title-contains'
  | 'js-truthy'

export interface AssertResult {
  assertType: AssertType
  passed: boolean
  /** Human-readable failure description (empty when passed) */
  failureMessage: string
  actual?: string
  expected?: string
}

// ─── Recorder Screenshot Trail (Tier 3) ──────────────────────────────────────

export interface RecordedScreenshot {
  /** Corresponds to RecordedEvent.timestamp */
  eventTimestamp: number
  /** base64-encoded PNG */
  dataUrl: string
}

// ─── Detection Test Types ──────────────────────────────────────────────────

export interface DetectionTestResult {
  id: string
  profileId: string
  profileName: string
  testedAt: string
  overallScore: number  // 0–100 (higher = less detectable)
  vectors: DetectionVectorResult[]
  status: 'passed' | 'warning' | 'failed'
}

export interface DetectionVectorResult {
  name: string
  category: string
  passed: boolean
  detail?: string
}

export interface DetectionTestSummary {
  totalTests: number
  averageScore: number
  lastTestedAt: string | null
  results: DetectionTestResult[]
}

// Phase 7: batch detection test result
export interface BatchTestStatus {
  total: number
  completed: number
  failed: number
  results: DetectionTestResult[]
}

// ─── Phase 8: Chromium Patch System ───────────────────────────────────────────

/** Implementation level of a patch */
export type ChromiumPatchLevel =
  | 'js-shim'        // Implemented as JS override (works without custom Chromium)
  | 'cdp-override'   // Implemented via Chrome DevTools Protocol
  | 'requires-build' // Requires custom Chromium C++ patch to fully implement

export type ChromiumPatchCategory =
  | 'fingerprint'   // Fingerprint API spoofing
  | 'automation'    // Automation/bot signal removal
  | 'timing'        // Timing attack defense
  | 'network'       // Network-level fingerprint
  | 'gpu'           // GPU fingerprint defense
  | 'locale'        // Locale/Intl API normalization

export interface ChromiumPatch {
  id: string
  name: string
  description: string
  category: ChromiumPatchCategory
  level: ChromiumPatchLevel
  active: boolean
  impact: 'low' | 'medium' | 'high'
  /** Short technical note on what the patch changes */
  technicalNote?: string
}

export interface ChromiumPatchStatus {
  total: number
  active: number
  jsShims: number
  cdpOverrides: number
  requiresBuild: number
  patches: ChromiumPatch[]
}

// ─── Phase 12.C.4: Fingerprint Collision Detection ──────────────────────────

export type CollisionKind = 'noise-seed' | 'identity-tuple'

export interface CollisionGroup {
  /** Stable id derived from the collision signature */
  id: string
  kind: CollisionKind
  /** Human-readable description of the shared signature */
  signature: string
  /** Profiles sharing this signature */
  profiles: { id: string; name: string }[]
}

export interface CollisionReport {
  scannedAt: string
  totalProfiles: number
  groups: CollisionGroup[]
}

// Phase 8: extended fingerprint config
export interface Phase8Config {
  /** Intl API locale normalization */
  intlSpoofing: boolean
  /** navigator.userAgentData (UACH) high-entropy spoofing */
  uachSpoofing: boolean
  /** navigator.gpu WebGPU stub */
  webGPUStub: boolean
  /** Math FPU result normalization (deterministic per profile) */
  mathFpuNoise: boolean
}

// ─── Phase 14.A — Remote Browser Nodes ───────────────────────────────────────

export type NodeStatus = 'online' | 'offline' | 'unknown' | 'error'

export interface RemoteBrowserNode {
  id: string
  name: string
  url: string                  // e.g. https://node-1.example.com:9222
  authToken?: string
  region?: string
  capacity: number             // max concurrent profiles
  activeProfiles: number
  status: NodeStatus
  latencyMs?: number
  lastCheckedAt?: string
  createdAt: string
}

export interface CreateNodeInput {
  name: string
  url: string
  authToken?: string
  region?: string
  capacity?: number
}

export interface NodeHealth {
  status: NodeStatus
  latencyMs?: number
  error?: string
}

// ─── Phase 15.A — Workflow Marketplace ───────────────────────────────────────

export type MarketplaceCategory =
  | 'social'
  | 'ecommerce'
  | 'scraping'
  | 'testing'
  | 'utility'
  | 'finance'

export interface MarketplaceWorkflow {
  id: string
  name: string
  description: string
  author: string
  category: MarketplaceCategory
  tags: string[]
  stars: number
  downloads: number
  version: string
  publishedAt: string
  /** Full step definitions — present when fetching a single item */
  steps?: any[]
}

// ─── Phase 15.B — Community Fingerprint Presets ───────────────────────────────

export interface CommunityPreset {
  id: string
  name: string
  os: string
  browser: string
  submittedBy: string
  qualityScore: number       // 0–100 (rarity + detection-resistance)
  downloadCount: number
  publishedAt: string
  /** Raw FingerprintConfig JSON — present when fetching a single preset */
  fingerprint?: any
}

// ─── Phase 15.C — Outbound Webhooks ──────────────────────────────────────────

export type WebhookEvent =
  | 'profile.created'
  | 'profile.launched'
  | 'profile.closed'
  | 'detection.completed'
  | 'schedule.completed'
  | 'license.expiring'

export interface WebhookConfig {
  id: string
  name: string
  url: string
  events: WebhookEvent[]
  secret?: string            // used to sign payload (HMAC-SHA256 X-Signature header)
  enabled: boolean
  createdAt: string
  lastTriggeredAt?: string
  lastStatus?: number        // HTTP status of last delivery
}

export interface TelegramConfig {
  enabled: boolean
  botToken: string
  chatId: string
  events: WebhookEvent[]
}

export interface CreateWebhookInput {
  name: string
  url: string
  events: WebhookEvent[]
  secret?: string
}

// ─── Phase 16 — AI-Assisted Automation ───────────────────────────────────────

/** Status of the in-session AI call budget */
export interface AiUsageStatus {
  /** Calls consumed this session */
  callsUsed: number
  /** Hard cap per session (default 20) */
  callsMax: number
  /** API key is configured */
  configured: boolean
  /** AI features are enabled */
  enabled: boolean
}

/** A single actionable recommendation produced by the detection advisor */
export interface AiRecommendation {
  /** Short headline, e.g. "Switch WebGL renderer" */
  title: string
  /** Detailed explanation of why this vector looks suspicious */
  explanation: string
  /** Importance ranking: 1 = most urgent */
  priority: 1 | 2 | 3
  /** If set, the profile field path to change, e.g. "webgl.renderer" */
  fieldPath?: string
  /** Suggested replacement value (string or JSON-serialisable) */
  suggestedValue?: any
}

/** Full detection advice payload returned by 16.B */
export interface AiDetectionAdvice {
  overallSummary: string
  recommendations: AiRecommendation[]
  riskLevel: 'low' | 'medium' | 'high'
}

/** Result of 16.A — Natural Language Workflow Builder */
export interface AiWorkflowResult {
  /** Human-readable summary of what was generated */
  summary: string
  /** The generated steps ready to be imported into a workflow */
  steps: AutomationStep[]
  /** Any caveats or notes from the model */
  notes?: string
}

/** Result of 16.C — Smart Selector Healing */
export interface AiSelectorHealResult {
  /** The original broken selector */
  originalSelector: string
  /** The new selector suggested by the model */
  suggestedSelector: string
  /** Confidence level: high / medium / low */
  confidence: 'high' | 'medium' | 'low'
  /** Why the original likely broke */
  reasoning: string
}

// ─── Phase 17 — Script-to-Workflow Generation ─────────────────────────────────

/** Extended recorded event with Phase 17 rich metadata */
export interface RecordedEvent {
  type: 'click' | 'input' | 'change' | 'submit' | 'navigate' | 'scroll' | 'keypress'
  selector: string
  value?: string
  url?: string
  tag?: string
  label?: string
  timestamp: number
  // Phase 17 additions
  screenshotPath?: string
  domSnapshot?: string
  networkRequests?: string[]
  timingMs?: number
}

/** A complete recording session (Phase 17) */
export interface RecordingSession {
  id: string
  profileId: string
  startedAt: string
  stoppedAt?: string
  events: RecordedEvent[]
  pageTitle?: string
  startUrl?: string
  captureScreenshots: boolean
  captureNetwork: boolean
  status: 'recording' | 'stopped' | 'analyzing' | 'refined' | 'saved'
}

/** A structural pattern detected in a recording */
export interface DetectedPattern {
  type: 'loop' | 'conditional' | 'repeated-selector' | 'form-group' | 'navigation-chain'
  stepIndices: number[]
  confidence: number
  suggestedReplacement?: AutomationStep
  description: string
}

/** A value that should become a workflow variable */
export interface ExtractedVariable {
  name: string
  value: string
  occurrences: number[]
  type: 'url' | 'text-input' | 'selector-value' | 'credential' | 'numeric' | 'date'
  confidence: number
  autoApply: boolean
}

/** Wait optimization suggestion */
export interface WaitOptimization {
  stepIndex: number
  originalTimingMs: number
  suggestedWaitMs: number
  strategy: 'waitForSelector' | 'fixed-wait' | 'no-wait'
  reason: string
}

/** Selector quality assessment */
export interface SelectorQualityReport {
  stepIndex: number
  selector: string
  quality: 'excellent' | 'good' | 'fragile' | 'brittle'
  reason: string
  suggestedSelector?: string
}

/** Output from ScriptAnalyzer (Phase 17.B) */
export interface RecordingAnalysis {
  sessionId: string
  rawStepCount: number
  optimizedStepCount: number
  detectedPatterns: DetectedPattern[]
  extractedVariables: ExtractedVariable[]
  waitOptimizations: WaitOptimization[]
  selectorQuality: SelectorQualityReport[]
  suggestedWorkflow: AutomationWorkflow
  analysisNotes: string[]
}

/** A single refinement suggestion from AI */
export interface RefinementSuggestion {
  stepId: string
  type: 'selector-heal' | 'step-fix' | 'add-retry' | 'add-error-handler' | 'add-wait' | 'parameterize'
  before: Partial<AutomationStep>
  after: Partial<AutomationStep>
  reason: string
  applied: boolean
}

/** Output from RecordingRefiner AI pipeline (Phase 17.C) */
export interface RefinedRecording {
  sessionId: string
  originalSteps: AutomationStep[]
  refinedSteps: AutomationStep[]
  appliedSuggestions: RefinementSuggestion[]
  summary: string
  aiNotes: string
}

/** Options for the AI refine pipeline */
export interface RefineOptions {
  healFragileSelectors: boolean
  addRetryOnNetworkActions: boolean
  addErrorHandlers: boolean
  generateStepLabels: boolean
  maxAiCalls?: number
}

/** Phase 16.D — Behaviour archetype definition */
export interface BehaviorArchetype {
  id: string
  name: string
  description: string
  /** Typing WPM range */
  typingWpm: [number, number]
  /** Mouse speed multiplier (1 = normal) */
  mouseSpeed: number
  /** Scroll step in px */
  scrollStep: number
  /** Pause between actions in ms [min, max] */
  actionPause: [number, number]
  /** Idle drift enabled */
  idleDrift: boolean
  /** Icon name (lucide) */
  icon: string
  /** Sample tags */
  tags: string[]
}

// ─── IPC Error & Response Types (Phase Security Hardening) ───────────────────

export type IpcErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'ALREADY_EXISTS'
  | 'DATABASE_ERROR'
  | 'ENCRYPTION_ERROR'
  | 'FILE_SYSTEM_ERROR'
  | 'INVALID_STATE'
  | 'INTERNAL_ERROR'

export interface IpcErrorResponse {
  code: IpcErrorCode
  message: string
  details?: Record<string, unknown>
}

export interface IpcResponse<T> {
  success: boolean
  data?: T
  error?: IpcErrorResponse
}

// ─── Pagination Types (Phase 2.1) ──────────────────────────────────────────

export interface PaginationResponse<T> {
  items: T[]
  total: number
  hasMore: boolean
  limit: number
  offset: number
}

export interface ProfileListOptions {
  limit?: number
  offset?: number
  filters?: {
    groupId?: string
    status?: 'active' | 'archived'
  }
}

// ─── Cleanup Worker Types (Phase 2.3) ──────────────────────────────────────

export interface CleanupTaskStatus {
  profileId: string
  paths: string[]
  retries: number
  lastAttempt: string | null
}

export interface CleanupWorkerStatus {
  queued: number
  processing: number
  failed: number
  total: number
}

// ─── Phase 21 — Behavior Correlation Detector ────────────────────────────────
//
// Identifies when two or more profiles share a behavioral fingerprint so
// similar that a sophisticated detector could cluster them as the same
// operator. Uses typing cadence (WPM + variance), mouse velocity/jitter,
// scroll speed/pause timing and composite features to compute pairwise
// similarity between profiles. Similarities above a configurable threshold
// surface as alerts with remediation recommendations.

/**
 * A single behavioral fingerprint sample for one profile.
 * Samples are aggregated across sessions into a profile-level centroid.
 */
export interface BehaviorSample {
  /** Typing speed (words per minute). */
  typingWpm: number
  /** Std-dev % between keystrokes (0-100, higher = more human). */
  typingVariance: number
  /** Gaussian sigma applied to pointer jitter (px). */
  mouseJitterSigma: number
  /** Avg pointer velocity in px/ms. */
  mouseVelocityAvg: number
  /** Direction reversals per 100 pointer events. */
  mouseDirectionChanges: number
  /** Avg scroll speed in px/ms. */
  scrollSpeedAvg: number
  /** Scroll inertia decay multiplier (0.7 – 0.98). */
  scrollDecay: number
  /** Pauses per 100 scroll events. */
  scrollPauseRate: number
  /** Archetype id (if archetype was applied). */
  archetypeId?: string | null
}

/**
 * Per-profile aggregated behavior fingerprint. Derived from the profile's
 * BehaviorConfig + any collected session metrics. This is what we use to
 * compute pairwise similarity — it is NOT stored per-session.
 */
export interface ProfileBehaviorFingerprint {
  profileId: string
  profileName: string
  archetypeId?: string | null
  archetypeName?: string | null
  /** ISO timestamp when the centroid was last recomputed. */
  computedAt: string
  sample: BehaviorSample
  /** Number of samples that went into the centroid. */
  sampleCount: number
}

/**
 * A single correlation between two profiles. Stored in the
 * `behavior_correlations` table so users can review history.
 */
export interface BehaviorCorrelationPair {
  id: string
  profileAId: string
  profileAName: string
  profileBId: string
  profileBName: string
  /** 0.0 – 1.0, where 1.0 = identical behavioral fingerprint. */
  similarity: number
  /** Percentage form (0 – 100) for display convenience. */
  similarityPercent: number
  /** Risk bucket based on similarity (low / medium / high). */
  risk: 'low' | 'medium' | 'high'
  /** Per-feature contributions so the UI can explain "why". */
  featureContributions: {
    typing: number
    mouse: number
    scroll: number
  }
  /** Actionable suggestions for the user. */
  recommendations: string[]
  /** When this correlation was computed. */
  computedAt: string
}

/**
 * Report returned from the detector — includes the full list of pairs,
 * aggregate statistics and the threshold that was applied.
 */
export interface BehaviorCorrelationReport {
  /** ISO timestamp when the scan ran. */
  scannedAt: string
  /** Similarity threshold used for the "alert" cut-off (0.0 – 1.0). */
  threshold: number
  /** Number of profiles included in the scan. */
  profileCount: number
  /** Total pairs evaluated (n * (n - 1) / 2). */
  pairsEvaluated: number
  /** All pairs above the threshold, sorted by similarity desc. */
  alerts: BehaviorCorrelationPair[]
  /** Count of high-risk alerts (similarity >= 0.90). */
  highRiskCount: number
  /** Count of medium-risk alerts (0.85 <= similarity < 0.90). */
  mediumRiskCount: number
  /** Global recommendations covering the whole pool. */
  globalRecommendations: string[]
  /** Archetype usage histogram — key is archetype id or "none". */
  archetypeUsage: Record<string, number>
  /** Profile fingerprints that were scored (for diagnostics in the UI). */
  fingerprints: ProfileBehaviorFingerprint[]
}

/** Options accepted by the detector when running a scan. */
export interface BehaviorCorrelationOptions {
  /** Similarity threshold below which pairs are ignored (default 0.85). */
  threshold?: number
  /** If set, only these profile ids are scanned. */
  profileIds?: string[]
  /** If true, persists the report to the database (default true). */
  persist?: boolean
}

// ─── Bulk Import Types (Phase 1+2) ──────────────────────────────────────────

export type ImportFormat = 'zip' | 'csv' | 'json'

export type DuplicateResolution = 'skip' | 'rename' | 'overwrite'

export interface SelectiveFields {
  name: boolean
  fingerprint: boolean
  cookies: boolean
  notes: boolean
}

export interface ImportOptions {
  format: ImportFormat
  duplicateResolution: DuplicateResolution
  selectiveFields: SelectiveFields
  /** If set, assign all imported profiles to this proxy */
  assignProxyId?: string | null
  /** If set, assign all imported profiles to this group */
  assignGroupId?: string | null
}

export interface ImportPreviewRow {
  index: number
  name: string
  preset: string
  notes: string
  proxyId: string | null
  groupId: string | null
  fingerprintProvided: boolean
  cookiesProvided: boolean
  isDuplicate: boolean
  duplicateOf?: { id: string; name: string }
  duplicateType?: 'name' | 'fingerprint' | 'both'
  errors: string[]
  status: 'ready' | 'duplicate' | 'error'
}

export interface ImportPreviewResult {
  totalRows: number
  validCount: number
  duplicateCount: number
  errorCount: number
  rows: ImportPreviewRow[]
}

export interface ImportResult {
  sessionId: string
  totalFiles: number
  successCount: number
  errorCount: number
  duplicateCount: number
  skippedCount: number
  profileIds: string[]
  errors: ImportRecordEntry[]
}

export interface ImportSession {
  id: string
  timestamp: string
  file_count: number
  success_count: number
  error_count: number
  duplicate_count: number
  skipped_count: number
  import_source: ImportFormat
  original_filename: string | null
}

export interface ImportRecordEntry {
  id: string
  session_id: string
  source_file: string | null
  profile_id: string | null
  profile_name: string
  status: 'success' | 'duplicate' | 'skipped' | 'error'
  duplicate_of: string | null
  error_message: string | null
  created_at: string
}

// ── Phase 17: Mobile Workflow Types ──────────────────────────────────────────

export type MobileGestureAction =
  | 'tapPoint'
  | 'tapElement'
  | 'swipe'
  | 'longPress'
  | 'doubleTap'
  | 'pinch'
  | 'dragDrop'

export type MobileSensorAction =
  | 'setLocation'
  | 'setAccelerometer'
  | 'setGyroscope'
  | 'setBattery'
  | 'setNetworkInfo'

export type MobileDeviceAction =
  | 'rotateDevice'
  | 'setViewport'

export type MobileAction = MobileGestureAction | MobileSensorAction | MobileDeviceAction

/** A single step inside a mobile workflow */
export interface MobileAutomationStep {
  id: string
  /** Desktop actions (navigate, click, type, wait, etc.) are also valid here */
  action: MobileAction | AutomationStep['action']
  label: string
  params: Record<string, any>
  /** Optional: tie step to a specific profile preset */
  deviceProfile?: string
  /** Optional: run anti-bot pre-check before executing this step */
  detectiveMode?: boolean
  retryCount?: number
  timeout?: number
}

export interface MobileDeviceConfig {
  targetProfiles: string[]
  executionMode: 'single' | 'parallel' | 'sequential'
  delayBetweenProfiles?: number
  stopOnError: boolean
  timeoutPerStep?: number
}

export interface MobileWorkflow {
  id: string
  name: string
  description: string
  steps: MobileAutomationStep[]
  deviceConfig: MobileDeviceConfig
  behaviorPattern?: string
  isTemplate?: boolean
  created_at?: string
  updated_at?: string
}

export interface CreateMobileWorkflowInput {
  name: string
  description?: string
  steps: MobileAutomationStep[]
  deviceConfig: MobileDeviceConfig
  behaviorPattern?: string
  isTemplate?: boolean
}

export interface UpdateMobileWorkflowInput {
  name?: string
  description?: string
  steps?: MobileAutomationStep[]
  deviceConfig?: MobileDeviceConfig
  behaviorPattern?: string
}

export interface SensorState {
  location?: { latitude: number; longitude: number; accuracy: number; altitude?: number }
  accelerometer?: { x: number; y: number; z: number }
  gyroscope?: { x: number; y: number; z: number }
  battery?: { level: number; charging: boolean }
  networkInfo?: { type: string; downlink?: number; rtt?: number }
}

export interface MobileExecutionMetrics {
  tapCount: number
  swipeCount: number
  scrollCount: number
  longPressCount: number
  pinchCount: number
  totalDuration: number
  averageStepDuration: number
}

export interface MobileStepResult {
  stepId: string
  action: string
  success: boolean
  duration: number
  error?: string
}

export interface MobileExecutionResult {
  executionId: string
  workflowId: string
  profileId: string
  deviceName: string
  success: boolean
  duration: number
  steps: MobileStepResult[]
  metrics: MobileExecutionMetrics
  sensorState?: SensorState
  error?: string
}

export interface MobileBatchExecutionResult {
  executionId: string
  workflowId: string
  executionMode: 'parallel' | 'sequential'
  total: number
  successCount: number
  failCount: number
  results: MobileExecutionResult[]
}

export type MobileBehaviorArchetypeId =
  | 'casual_browser'
  | 'power_user'
  | 'bot_evasion'
  | 'rapid_interactor'
  | 'mobile_native'
  | 'careful_shopper'
  | 'bulk_operator'
  | 'social_lurker'
  | 'form_filler'
  | 'idler'

export interface MobileBehaviorArchetype {
  id: MobileBehaviorArchetypeId
  name: string
  description: string
  tapDelayRange: [number, number]
  swipeDurationRange: [number, number]
  pauseRange: [number, number]
  scrollDistanceRange: [number, number]
  missRate: number
  retapRate: number
}

export interface MobileExecutionLog {
  id: string
  workflow_id: string
  workflow_name?: string
  profile_id: string
  device_name: string
  started_at: string
  ended_at?: string
  duration_ms: number
  status: 'running' | 'success' | 'failed' | 'timeout' | 'cancelled'
  error_message?: string
  step_results: string
  metrics: string
  sensor_state?: string
}

export interface GestureTemplate {
  id: string
  name: string
  gesture_type: string
  description: string
  config: Record<string, any>
  created_at?: string
}

// ── Phase 18: Real Device Support ────────────────────────────────────────────

export type RealDeviceType = 'android' | 'ios'

export interface RealAndroidDevice {
  type: 'android'
  id: string
  name: string
  model: string
  androidVersion: string
  isConnected: boolean
  isEmulator: boolean
  webdriverPort: number
  lastHealthCheck?: number
  error?: string
}

export interface RealIosDevice {
  type: 'ios'
  id: string
  name: string
  model: string
  osVersion: string
  isConnected: boolean
  udid: string
  webdriverPort: number
  bundleId?: string
  lastHealthCheck?: number
  error?: string
}

export type RealDevice = RealAndroidDevice | RealIosDevice

export interface RealDeviceExecutionConfig {
  deviceId: string
  deviceType: RealDeviceType
  cdpEndpoint: string
  networkProfile?: 'sea' | '4g' | '5g' | 'wifi'
  enableMobileCdpEvasion?: boolean
}

export type NetworkType = '2g' | '3g' | '4g' | '5g' | 'wifi' | 'ethernet'

export interface NetworkProfile {
  type: NetworkType
  downloadSpeed: number
  uploadSpeed: number
  latency: number
  packetLoss: number
  jitterMs: number
}

// ── Phase 2 Integration — Analytics Types ──────────────────────────────────

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

// ── Phase 2 Integration — Billing Types ────────────────────────────────────

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
  line_items: Array<{
    description: string
    quantity: number
    unit_amount: number
    amount: number
  }>
}

export interface BillingInvoice {
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

export interface BillingPricingPlan {
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

// ── Phase 2 Integration — Remote Config Types ──────────────────────────────

export interface FeatureFlag {
  key: string
  enabled: boolean
  variant?: string
  metadata?: Record<string, unknown>
}

export interface RemoteConfig {
  flags: FeatureFlag[]
  settings: Record<string, unknown>
  announcements: Announcement[]
  minimum_version: string | null
  fetched_at: string
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

// ── Phase 2 Integration — Cloud Profile Types ──────────────────────────────

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

export interface CloudProfileListResult {
  profiles: CloudProfile[]
  total: number
  storage_used_bytes: number
  storage_limit_bytes: number
}

// ── Phase 2 Integration — Support Ticket Types ─────────────────────────────

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

export interface TicketMessage {
  id: string
  ticket_id: string
  author_type: 'user' | 'support' | 'system'
  author_name: string
  content: string
  attachments: TicketAttachment[]
  created_at: string
}

export interface TicketAttachment {
  id: string
  filename: string
  size_bytes: number
  content_type: string
  url: string
}

export interface CreateTicketInput {
  subject: string
  category: TicketCategory
  priority?: TicketPriority
  message: string
  include_diagnostics?: boolean
}

export interface FeedbackInput {
  type: 'feature_request' | 'improvement' | 'praise' | 'other'
  message: string
  rating?: number
  context?: string
}
