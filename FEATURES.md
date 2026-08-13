# ShadowDesk — Full Feature Checklist

> Anti-detect browser platform for SEA market (Vietnam, Thailand, Indonesia).
> Desktop app: Electron 31 + React 18 + TypeScript.

## Scope of the v1.0 desktop release

A checked box below means the code exists — not that the feature is reachable
in the shipping build. v1.0 is desktop-only, and these sections are gated off
in `src/shared/features.ts` because what they depend on is not deployed:

| Hidden in v1.0 | Depends on | Section |
|---|---|---|
| Authentication, Licensing, Team, Cloud Sync | `server/` (not deployed; `app.ts` also imports a `modules/profiles` that does not exist) | 14, 15, 16, 17 |
| Analytics, Billing, Support, Cloud Profiles, Remote Config | External "Common SaaS API" — no implementation in this repo | — |
| Mobile Devices (ADB / Appium) | A real handset plus `adb`; the iOS connector is still a skeleton | — |
| Community Fingerprint Presets | Nothing — the panel fakes its download and applies no preset | — |

Everything else ships and runs locally, with no account and no profile cap.
Mobile *workflows* are included: they drive Chromium mobile emulation, not
hardware.

---

## 1. Profile Management
- [x] List all profiles
- [x] Create profile with fingerprint preset selection
- [x] Edit profile details (name, group, notes)
- [x] Delete profile
- [x] Clone profile (with new fingerprint)
- [x] Launch profile in isolated Chromium session
- [x] Close profile session
- [x] View active sessions
- [x] Assign profile to group
- [x] Track last-used timestamp
- [x] Selective cloud sync opt-out per profile

---

## 2. Fingerprint Spoofing Engine

### Core Vectors
- [x] User Agent (browser, OS, version)
- [x] Platform / OS string
- [x] Screen resolution & color depth
- [x] Device memory & CPU concurrency
- [x] Hardware concurrency
- [x] Touch points
- [x] Locale / language / timezone
- [x] WebRTC (disable / fake / real)
- [x] Canvas (noise / block)
- [x] WebGL vendor & renderer (+ noise)
- [x] Audio context (noise / block)
- [x] Font enumeration whitelist
- [x] Media device counts
- [x] Browser plugins list
- [x] Speech recognition API
- [x] Network Information API (connection type)
- [x] Geolocation (lat/lon/accuracy)
- [x] Behavior simulation (mouse jitter, typing noise, scroll inertia)
- [x] Timing defenses (Date.now precision, RAF jitter, performance.now clamping)
- [x] Intl API locale normalization
- [x] User Agent Client Hints (UACH) high-entropy spoofing
- [x] WebGPU API stub
- [x] Math FPU normalization

### Injection Script Modules (22)
- [x] audio.ts — AudioContext spoofing
- [x] behavior.ts — Pointer/keyboard/scroll simulation
- [x] canvas.ts — Canvas noise injection
- [x] clientrects.ts — DOM rect noise
- [x] fonts.ts — Font enumeration control
- [x] iframe.ts — Cross-iframe fingerprint propagation
- [x] intl.ts — Intl API normalization
- [x] keyboard.ts — Keyboard layout spoofing
- [x] native-tostring.ts — Function.toString override
- [x] navigator.ts — Navigator property spoofing
- [x] network.ts — Network API spoofing
- [x] performance.ts — Performance timing sanitization
- [x] permissions.ts — Permissions API spoofing
- [x] plugins.ts — Plugin enumeration control
- [x] speech.ts — Speech recognition API
- [x] storage.ts — Storage quota fingerprint defense
- [x] timing.ts — Timing attack defenses
- [x] useragentdata.ts — UACH spoofing
- [x] webgl.ts — WebGL vendor/renderer spoofing
- [x] webgpu.ts — WebGPU stub
- [x] webrtc.ts — WebRTC IP leak prevention
- [x] worker.ts — Web Worker fingerprint propagation

### Fingerprint Management
- [x] 11 built-in presets (5 desktop, 3 Android, 3 iOS)
- [x] Switch presets while preserving behavior/timing config
- [x] Reroll fingerprint (new random seed)
- [x] Profile version history (max 20 snapshots)
- [x] Restore to a previous fingerprint version
- [x] Save manual fingerprint snapshot with label
- [x] Deterministic noise seeds (same profile = same fingerprint)
- [x] Auto-sync binary UA to match real Chromium binary version

---

## 3. Proxy Management
- [x] List all proxies
- [x] Add proxy (HTTP, HTTPS, SOCKS5)
- [x] Delete proxy
- [x] Test proxy connectivity (latency + health)
- [x] Bulk import proxies (multiple formats)
- [x] Proxy rotation: none / random / round-robin
- [x] Per-proxy country label
- [x] Health status tracking

---

## 4. Profile Groups
- [x] Create group with custom color
- [x] List all groups
- [x] Delete group
- [x] Assign profiles to groups

---

## 5. Cookies & Storage Management

### Cookie Operations
- [x] Import cookies (Netscape or JSON format)
- [x] Export cookies (Netscape or JSON format)
- [x] Capture live cookies from running browser
- [x] List cookies for profile
- [x] Save / replace entire cookie set
- [x] Push live cookie updates to running session

### Storage Inspector (read-only)
- [x] List security origins
- [x] Inspect localStorage per origin
- [x] Inspect sessionStorage per origin
- [x] List IndexedDB databases per origin
- [x] Browse IndexedDB entries with pagination

---

## 6. Automation / RPA Engine

### Action Types (28)
- [x] navigate
- [x] click / rightClick / doubleClick
- [x] type (with variable interpolation)
- [x] wait (fixed delay)
- [x] waitForSelector
- [x] waitForNavigation
- [x] scroll
- [x] hover
- [x] select
- [x] keyPress
- [x] setAttribute
- [x] screenshot
- [x] extractText (+ transform pipeline)
- [x] evaluate (JS execution, + transform pipeline)
- [x] httpRequest (+ JSONPath + transform)
- [x] conditional (if/else)
- [x] loop (repeat N times)
- [x] solveCaptcha
- [x] injectCaptchaToken
- [x] upload
- [x] download
- [x] useCredential (vault injection)
- [x] **Phase 18** — extractJson (JSONPath from var/value/script/selector)
- [x] **Phase 18** — forEachElement (iterate matched DOM elements, exposes `el.*`)
- [x] **Phase 18** — whileLoop (5 condition types, safety-capped)
- [x] **Phase 18** — waitForRequest (URL glob or regex + method filter)
- [x] **Phase 18** — waitForResponse (URL + status + JSONPath body extract)
- [x] **Phase 18** — paginate (click next until disabled/missing/maxPages)

### Transform Pipeline (Phase 18)
- [x] Reusable `transform` field on any step that saves a value
- [x] Ops: `trim`, `upper`, `lower`, `number`, `length`
- [x] Ops with argument: `jsonPath:$.a.b`, `regex:pattern`, `split:sep:index`, `replace:find:with` (or `replace:re:pattern:with`), `prefix:str`, `suffix:str`
- [x] Chains accepted as `"trim|upper|prefix:PRE-"` or `["trim", "upper"]`
- [x] Applied uniformly in `extractText`, `evaluate`, `httpRequest`, `extractJson`, `waitForResponse`

### Workflow Management
- [x] Create / update / delete workflows
- [x] List and browse workflows
- [x] Add / reorder / delete steps
- [x] Define workflow variables
- [x] Use built-in variables: `{timestamp}`, `{random}`, `{profileName}`, `{runId}`

### Execution
- [x] Single-profile execution
- [x] Parallel multi-profile execution with concurrency limit
- [x] Step retry (configurable retries + delay)
- [x] Live progress streaming to UI
- [x] Stop / abort running execution
- [x] Execution history
- [x] **Phase 18** — Export run history as CSV / JSON (per-run or per-step, status filter, variable include, save dialog)
- [x] **Phase 18** — Inbound webhook trigger: `POST /api/webhooks/workflows/:id/run` (async, auto-launches profile, 202 Accepted)
- [x] **Phase 18** — Polling endpoint: `GET /api/workflows/:id/runs/last`
- [x] **Phase 18** — Inline export over HTTP: `GET /api/workflows/:id/runs/export?format=csv|json`

### Workflow Templates (6 built-in)
- [x] Web Page Scraper
- [x] Login Flow
- [x] Social Media Feed Scroll
- [x] E-Commerce Price Checker
- [x] Form Auto-Fill
- [x] Generic template

---

## 7. Workflow Scheduling
- [x] Create schedules with cron expressions (5-field)
- [x] Assign multiple profiles to a schedule
- [x] Enable / disable schedule
- [x] Manual trigger (run now)
- [x] Last / next run timestamps
- [x] Delete schedule
- [x] Background 30-second polling tick

---

## 8. Profile Extensions
- [x] Add unpacked Chrome extensions per profile
- [x] List extensions for profile
- [x] Enable / disable extension
- [x] Remove extension
- [x] Extension folder picker

---

## 9. Detection Testing
- [x] Run detection test against profile
- [x] 45+ test vectors (webdriver, chrome.runtime, plugins, canvas, WebGL, audio, etc.)
- [x] Overall detection score (0–100)
- [x] Per-vector pass / warning / fail status
- [x] Test result history
- [x] Delete individual test result
- [x] Clear all history for profile
- [x] Batch detection testing (multiple profiles)
- [x] Summary statistics

---

## 10. Profile Warm-Up
- [x] Pre-configured warm-up site list (Google, YouTube, Wikipedia, etc.)
- [x] Custom warm-up site lists
- [x] Simulated dwell time per site (2–5 s)
- [x] Warm-up completion flag per profile
- [x] Duration metrics

---

## 11. Fingerprint Drift
- [x] Automatic drift detection flag per profile
- [x] Chrome major version bump (conservative, capped at 140)
- [x] User Agent update on drift
- [x] Noise seed rotation (canvas / WebGL / audio)
- [x] Last drift timestamp tracking

---

## 12. Chromium Patch Manager
- [x] 60+ evasion patches (fingerprint, automation, timing, network, GPU, locale)
- [x] Patch implementation levels: JS shim / CDP override / custom build
- [x] Per-patch impact rating (low / medium / high)
- [x] Per-patch activation toggle
- [x] Category-based filtering
- [x] Patch status dashboard

---

## 13. Fingerprint Collision Detection
- [x] Scan all profiles for duplicate fingerprints
- [x] Detect collision types: noise-seed, identity-tuple
- [x] Group colliding profiles by signature
- [x] Generate collision report

---

## 14. Authentication
- [x] User registration (email / password / name)
- [x] Login
- [x] Logout
- [x] Session token management (access + refresh)
- [x] Password update
- [x] Email verification resend
- [x] Get current user
- [x] GDPR data export
- [x] Account deletion

---

## 15. Licensing
- [x] License activation (key-based)
- [x] License deactivation
- [x] View current license & plan
- [x] Machine fingerprint (MAC + CPU hash)
- [x] Plan limits: Free (5), Starter (50), Professional (500), Enterprise (∞)
- [x] Grace period handling (7 days post-expiry)
- [x] Trial badge detection
- [x] Multi-machine seat management
- [x] List licensed devices
- [x] Deactivate remote device

---

## 16. Team Collaboration
- [x] Create team
- [x] Update team name
- [x] Delete team
- [x] List team members
- [x] Invite member by email with role (admin / editor / viewer)
- [x] Update member role
- [x] Remove member
- [x] Cancel pending invitation
- [x] List pending invites
- [x] Accept invitation
- [x] Share profile with read / write permission
- [x] Unshare profile
- [x] List shared profiles
- [x] Audit log (paginated): profile launch/create/delete/export, team invite/remove, settings update

---

## 17. Cloud Sync
- [x] Push profiles to cloud (AES-256-GCM encrypted)
- [x] Pull profiles from cloud
- [x] Scrypt key derivation with per-user salt
- [x] Sync manifest with checksum
- [x] Sync status tracking (idle / syncing / error / offline / disabled)
- [x] Sync history log
- [x] Pending changes counter
- [x] Sync diff preview (local-only / remote-only / shared counts)
- [x] Background sync daemon
- [x] Selective sync opt-out per profile
- [x] Conflict detection

---

## 18. Encrypted Credential Vault
- [x] Master password unlock (scrypt)
- [x] Per-vault random salt + sentinel verification
- [x] AES-256-GCM encryption per credential
- [x] Idle timeout auto-lock (configurable)
- [x] Create credential (username, password, custom fields)
- [x] Update / delete credential
- [x] List credentials (all or filtered by profile)
- [x] Inject credential into automation step
- [x] Lock / unlock vault

---

## 19. Visual Recorder
- [x] Record user interactions on a running profile
- [x] Capture: click, input, change, submit, navigate events
- [x] Smart selector generation (ID → data-testid → name → nth-child)
- [x] Event coalescing (collapse adjacent events)
- [x] Human-friendly step labels
- [x] Stop recording
- [x] Convert recording to automation workflow steps

---

## 20. Captcha Solving
- [x] Provider support: 2captcha, Anticaptcha, CapMonster
- [x] Captcha types: reCAPTCHA v2/v3, hCaptcha, image-based
- [x] Account balance check per provider
- [x] Result caching with provider task ID
- [x] Duration tracking (end-to-end)
- [x] Default provider configuration
- [x] Per-provider API key management

---

## 21. Local Automation API Server
- [x] HTTP server on configurable port (default 9222)
- [x] Profile CRUD endpoints
- [x] Profile launch / close endpoints
- [x] Workflow execution endpoint
- [x] Browser control endpoints
- [x] Screenshot endpoint
- [x] Optional bearer token auth
- [x] CORS headers for local tools

---

## 22. Settings & Configuration
- [x] Default fingerprint preset
- [x] UI language (English, Vietnamese, Thai, Indonesian)
- [x] Theme (dark / light)
- [x] Auto-launch last session
- [x] Auto-sync binary UA
- [x] Captcha provider defaults & API keys
- [x] Vault idle timeout

---

## 23. Profile Import / Export
- [x] Export profile bundle (profile.json + fingerprint.json + cookies.json in ZIP)
- [x] Import profile bundle
- [x] Proxy bulk import with format auto-detection

---

## 24. Auto-Updater
- [x] Check for updates
- [x] Download update
- [x] Install update
- [x] Restart on update

---

## 25. UI / UX
- [x] Sidebar navigation
- [x] Header with global actions
- [x] Profile list / grid view with status cards
- [x] Create / edit profile modal
- [x] Cookie editor modal
- [x] Extension manager modal
- [x] Storage inspector modal
- [x] Warm-up modal
- [x] Profile fingerprint history viewer
- [x] Collision report drawer
- [x] Proxy list with test results
- [x] Fingerprint editor (all vectors)
- [x] Detection dashboard (category charts, trend graphs)
- [x] Automation builder (step editor with drag-and-drop)
- [x] Variables editor
- [x] Schedule creator modal
- [x] Workflow template picker
- [x] Team workspace (members, invites, audit log, shared profiles)
- [x] Account page (sync setup, license, settings)
- [x] Toast notifications (success / warning / error)
- [x] Global error boundary

---

*Last updated: 2026-04-07*
