# ShadowDesk — Full Feature Checklist

> Anti-detect browser platform for SEA market (Vietnam, Thailand, Indonesia).
> Desktop app: Electron 31 + React 18 + TypeScript.

---

## 1. Profile Management
- [ ] List all profiles
- [ ] Create profile with fingerprint preset selection
- [ ] Edit profile details (name, group, notes)
- [ ] Delete profile
- [ ] Clone profile (with new fingerprint)
- [ ] Launch profile in isolated Chromium session
- [ ] Close profile session
- [ ] View active sessions
- [ ] Assign profile to group
- [ ] Track last-used timestamp
- [ ] Selective cloud sync opt-out per profile

---

## 2. Fingerprint Spoofing Engine

### Core Vectors
- [ ] User Agent (browser, OS, version)
- [ ] Platform / OS string
- [ ] Screen resolution & color depth
- [ ] Device memory & CPU concurrency
- [ ] Hardware concurrency
- [ ] Touch points
- [ ] Locale / language / timezone
- [ ] WebRTC (disable / fake / real)
- [ ] Canvas (noise / block)
- [ ] WebGL vendor & renderer (+ noise)
- [ ] Audio context (noise / block)
- [ ] Font enumeration whitelist
- [ ] Media device counts
- [ ] Browser plugins list
- [ ] Speech recognition API
- [ ] Network Information API (connection type)
- [ ] Geolocation (lat/lon/accuracy)
- [ ] Behavior simulation (mouse jitter, typing noise, scroll inertia)
- [ ] Timing defenses (Date.now precision, RAF jitter, performance.now clamping)
- [ ] Intl API locale normalization
- [ ] User Agent Client Hints (UACH) high-entropy spoofing
- [ ] WebGPU API stub
- [ ] Math FPU normalization

### Injection Script Modules (22)
- [ ] audio.ts — AudioContext spoofing
- [ ] behavior.ts — Pointer/keyboard/scroll simulation
- [ ] canvas.ts — Canvas noise injection
- [ ] clientrects.ts — DOM rect noise
- [ ] fonts.ts — Font enumeration control
- [ ] iframe.ts — Cross-iframe fingerprint propagation
- [ ] intl.ts — Intl API normalization
- [ ] keyboard.ts — Keyboard layout spoofing
- [ ] native-tostring.ts — Function.toString override
- [ ] navigator.ts — Navigator property spoofing
- [ ] network.ts — Network API spoofing
- [ ] performance.ts — Performance timing sanitization
- [ ] permissions.ts — Permissions API spoofing
- [ ] plugins.ts — Plugin enumeration control
- [ ] speech.ts — Speech recognition API
- [ ] storage.ts — Storage quota fingerprint defense
- [ ] timing.ts — Timing attack defenses
- [ ] useragentdata.ts — UACH spoofing
- [ ] webgl.ts — WebGL vendor/renderer spoofing
- [ ] webgpu.ts — WebGPU stub
- [ ] webrtc.ts — WebRTC IP leak prevention
- [ ] worker.ts — Web Worker fingerprint propagation

### Fingerprint Management
- [ ] 11 built-in presets (5 desktop, 3 Android, 3 iOS)
- [ ] Switch presets while preserving behavior/timing config
- [ ] Reroll fingerprint (new random seed)
- [ ] Profile version history (max 20 snapshots)
- [ ] Restore to a previous fingerprint version
- [ ] Save manual fingerprint snapshot with label
- [ ] Deterministic noise seeds (same profile = same fingerprint)
- [ ] Auto-sync binary UA to match real Chromium binary version

---

## 3. Proxy Management
- [ ] List all proxies
- [ ] Add proxy (HTTP, HTTPS, SOCKS5)
- [ ] Delete proxy
- [ ] Test proxy connectivity (latency + health)
- [ ] Bulk import proxies (multiple formats)
- [ ] Proxy rotation: none / random / round-robin
- [ ] Per-proxy country label
- [ ] Health status tracking

---

## 4. Profile Groups
- [ ] Create group with custom color
- [ ] List all groups
- [ ] Delete group
- [ ] Assign profiles to groups

---

## 5. Cookies & Storage Management

### Cookie Operations
- [ ] Import cookies (Netscape or JSON format)
- [ ] Export cookies (Netscape or JSON format)
- [ ] Capture live cookies from running browser
- [ ] List cookies for profile
- [ ] Save / replace entire cookie set
- [ ] Push live cookie updates to running session

### Storage Inspector (read-only)
- [ ] List security origins
- [ ] Inspect localStorage per origin
- [ ] Inspect sessionStorage per origin
- [ ] List IndexedDB databases per origin
- [ ] Browse IndexedDB entries with pagination

---

## 6. Automation / RPA Engine

### Action Types (22)
- [ ] navigate
- [ ] click / rightClick / doubleClick
- [ ] type (with variable interpolation)
- [ ] wait (fixed delay)
- [ ] waitForSelector
- [ ] waitForNavigation
- [ ] scroll
- [ ] hover
- [ ] select
- [ ] keyPress
- [ ] setAttribute
- [ ] screenshot
- [ ] extractText
- [ ] evaluate (JS execution)
- [ ] httpRequest
- [ ] conditional (if/else)
- [ ] loop (repeat N times)
- [ ] solveCaptcha
- [ ] injectCaptchaToken
- [ ] upload
- [ ] download
- [ ] useCredential (vault injection)

### Workflow Management
- [ ] Create / update / delete workflows
- [ ] List and browse workflows
- [ ] Add / reorder / delete steps
- [ ] Define workflow variables
- [ ] Use built-in variables: `{timestamp}`, `{random}`, `{profileName}`, `{runId}`

### Execution
- [ ] Single-profile execution
- [ ] Parallel multi-profile execution with concurrency limit
- [ ] Step retry (configurable retries + delay)
- [ ] Live progress streaming to UI
- [ ] Stop / abort running execution
- [ ] Execution history

### Workflow Templates (6 built-in)
- [ ] Web Page Scraper
- [ ] Login Flow
- [ ] Social Media Feed Scroll
- [ ] E-Commerce Price Checker
- [ ] Form Auto-Fill
- [ ] Generic template

---

## 7. Workflow Scheduling
- [ ] Create schedules with cron expressions (5-field)
- [ ] Assign multiple profiles to a schedule
- [ ] Enable / disable schedule
- [ ] Manual trigger (run now)
- [ ] Last / next run timestamps
- [ ] Delete schedule
- [ ] Background 30-second polling tick

---

## 8. Profile Extensions
- [ ] Add unpacked Chrome extensions per profile
- [ ] List extensions for profile
- [ ] Enable / disable extension
- [ ] Remove extension
- [ ] Extension folder picker

---

## 9. Detection Testing
- [ ] Run detection test against profile
- [ ] 45+ test vectors (webdriver, chrome.runtime, plugins, canvas, WebGL, audio, etc.)
- [ ] Overall detection score (0–100)
- [ ] Per-vector pass / warning / fail status
- [ ] Test result history
- [ ] Delete individual test result
- [ ] Clear all history for profile
- [ ] Batch detection testing (multiple profiles)
- [ ] Summary statistics

---

## 10. Profile Warm-Up
- [ ] Pre-configured warm-up site list (Google, YouTube, Wikipedia, etc.)
- [ ] Custom warm-up site lists
- [ ] Simulated dwell time per site (2–5 s)
- [ ] Warm-up completion flag per profile
- [ ] Duration metrics

---

## 11. Fingerprint Drift
- [ ] Automatic drift detection flag per profile
- [ ] Chrome major version bump (conservative, capped at 140)
- [ ] User Agent update on drift
- [ ] Noise seed rotation (canvas / WebGL / audio)
- [ ] Last drift timestamp tracking

---

## 12. Chromium Patch Manager
- [ ] 60+ evasion patches (fingerprint, automation, timing, network, GPU, locale)
- [ ] Patch implementation levels: JS shim / CDP override / custom build
- [ ] Per-patch impact rating (low / medium / high)
- [ ] Per-patch activation toggle
- [ ] Category-based filtering
- [ ] Patch status dashboard

---

## 13. Fingerprint Collision Detection
- [ ] Scan all profiles for duplicate fingerprints
- [ ] Detect collision types: noise-seed, identity-tuple
- [ ] Group colliding profiles by signature
- [ ] Generate collision report

---

## 14. Authentication
- [ ] User registration (email / password / name)
- [ ] Login
- [ ] Logout
- [ ] Session token management (access + refresh)
- [ ] Password update
- [ ] Email verification resend
- [ ] Get current user
- [ ] GDPR data export
- [ ] Account deletion

---

## 15. Licensing
- [ ] License activation (key-based)
- [ ] License deactivation
- [ ] View current license & plan
- [ ] Machine fingerprint (MAC + CPU hash)
- [ ] Plan limits: Free (5), Starter (50), Professional (500), Enterprise (∞)
- [ ] Grace period handling (7 days post-expiry)
- [ ] Trial badge detection
- [ ] Multi-machine seat management
- [ ] List licensed devices
- [ ] Deactivate remote device

---

## 16. Team Collaboration
- [ ] Create team
- [ ] Update team name
- [ ] Delete team
- [ ] List team members
- [ ] Invite member by email with role (admin / editor / viewer)
- [ ] Update member role
- [ ] Remove member
- [ ] Cancel pending invitation
- [ ] List pending invites
- [ ] Accept invitation
- [ ] Share profile with read / write permission
- [ ] Unshare profile
- [ ] List shared profiles
- [ ] Audit log (paginated): profile launch/create/delete/export, team invite/remove, settings update

---

## 17. Cloud Sync
- [ ] Push profiles to cloud (AES-256-GCM encrypted)
- [ ] Pull profiles from cloud
- [ ] Scrypt key derivation with per-user salt
- [ ] Sync manifest with checksum
- [ ] Sync status tracking (idle / syncing / error / offline / disabled)
- [ ] Sync history log
- [ ] Pending changes counter
- [ ] Sync diff preview (local-only / remote-only / shared counts)
- [ ] Background sync daemon
- [ ] Selective sync opt-out per profile
- [ ] Conflict detection

---

## 18. Encrypted Credential Vault
- [ ] Master password unlock (scrypt)
- [ ] Per-vault random salt + sentinel verification
- [ ] AES-256-GCM encryption per credential
- [ ] Idle timeout auto-lock (configurable)
- [ ] Create credential (username, password, custom fields)
- [ ] Update / delete credential
- [ ] List credentials (all or filtered by profile)
- [ ] Inject credential into automation step
- [ ] Lock / unlock vault

---

## 19. Visual Recorder
- [ ] Record user interactions on a running profile
- [ ] Capture: click, input, change, submit, navigate events
- [ ] Smart selector generation (ID → data-testid → name → nth-child)
- [ ] Event coalescing (collapse adjacent events)
- [ ] Human-friendly step labels
- [ ] Stop recording
- [ ] Convert recording to automation workflow steps

---

## 20. Captcha Solving
- [ ] Provider support: 2captcha, Anticaptcha, CapMonster
- [ ] Captcha types: reCAPTCHA v2/v3, hCaptcha, image-based
- [ ] Account balance check per provider
- [ ] Result caching with provider task ID
- [ ] Duration tracking (end-to-end)
- [ ] Default provider configuration
- [ ] Per-provider API key management

---

## 21. Local Automation API Server
- [ ] HTTP server on configurable port (default 9222)
- [ ] Profile CRUD endpoints
- [ ] Profile launch / close endpoints
- [ ] Workflow execution endpoint
- [ ] Browser control endpoints
- [ ] Screenshot endpoint
- [ ] Optional bearer token auth
- [ ] CORS headers for local tools

---

## 22. Settings & Configuration
- [ ] Default fingerprint preset
- [ ] UI language (English, Vietnamese, Thai, Indonesian)
- [ ] Theme (dark / light)
- [ ] Auto-launch last session
- [ ] Auto-sync binary UA
- [ ] Captcha provider defaults & API keys
- [ ] Vault idle timeout

---

## 23. Profile Import / Export
- [ ] Export profile bundle (profile.json + fingerprint.json + cookies.json in ZIP)
- [ ] Import profile bundle
- [ ] Proxy bulk import with format auto-detection

---

## 24. Auto-Updater
- [ ] Check for updates
- [ ] Download update
- [ ] Install update
- [ ] Restart on update

---

## 25. UI / UX
- [ ] Sidebar navigation
- [ ] Header with global actions
- [ ] Profile list / grid view with status cards
- [ ] Create / edit profile modal
- [ ] Cookie editor modal
- [ ] Extension manager modal
- [ ] Storage inspector modal
- [ ] Warm-up modal
- [ ] Profile fingerprint history viewer
- [ ] Collision report drawer
- [ ] Proxy list with test results
- [ ] Fingerprint editor (all vectors)
- [ ] Detection dashboard (category charts, trend graphs)
- [ ] Automation builder (step editor with drag-and-drop)
- [ ] Variables editor
- [ ] Schedule creator modal
- [ ] Workflow template picker
- [ ] Team workspace (members, invites, audit log, shared profiles)
- [ ] Account page (sync setup, license, settings)
- [ ] Toast notifications (success / warning / error)
- [ ] Global error boundary

---

*Last updated: 2026-04-07*
