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
  // D4: email verification (backend may or may not populate — UI degrades gracefully)
  email_verified?: boolean
  email_verified_at?: string | null
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
  variables?: Record<string, string>
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
  variables?: Record<string, string>
}

export interface UpdateWorkflowInput {
  name?: string
  description?: string
  steps?: AutomationStep[]
  variables?: Record<string, string>
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
  category: 'scraping' | 'testing' | 'social' | 'ecommerce' | 'general'
  steps: AutomationStep[]
}

// ─── Profile Version Types (Phase 6) ─────────────────────────────────────────

export interface ProfileVersion {
  id: string
  profileId: string
  fingerprint: FingerprintConfig
  savedAt: string
  label: string
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

export interface WorkflowHook {
  event: WorkflowHookEvent
  handler: (data: any) => void | Promise<void>
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
