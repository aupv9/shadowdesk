# Changelog

All notable changes to **Ghost Browser** are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [0.8.0] — 2026-04-07 · Phase 8: Chromium Patch Catalog & Advanced Detection

### Added — Fingerprint Engine (Layer 4)

- **`intl.ts`** — Intl API locale normalization
  - Patches `Intl.DateTimeFormat`, `Intl.NumberFormat`, `Intl.Collator` constructors so `resolvedOptions().locale` / `.timeZone` always reflect the spoofed locale
  - Patches `Intl.supportedValuesOf()` to return a stable, bounded subset (prevents enumeration-based fingerprinting via value-count differences)

- **`webgpu.ts`** — WebGPU adapter info spoofing
  - Provides a `navigator.gpu` stub when WebGPU is absent, or patches `requestAdapterInfo()` when present
  - GPU vendor/description derived from the WebGL renderer string to ensure cross-API consistency

- **`useragentdata.ts`** — User-Agent Client Hints (UACH) spoofing
  - Full `navigator.userAgentData` object with `brands`, `mobile`, `platform`
  - `getHighEntropyValues()` returns `platformVersion`, `architecture`, `model`, `uaFullVersion`, `fullVersionList`, `wow64`, `bitness` derived from `BrowserConfig` / `OsConfig`

### Added — CDP Evasion (Phase 8)

- **Math FPU determinism** — pins `Math.sin(1)`, `Math.cos(1)`, `Math.tan(1)`, `Math.atan2(1,1)` to x86 IEEE 754 reference values; hides host-CPU FPU differences (ARM vs x86)
- **Prototype chain integrity** — removes enumerable properties accidentally added to `Function.prototype` and `Object.prototype` by automation frameworks
- **MediaCapabilities normalisation** — patches `navigator.mediaCapabilities.decodingInfo()` to always resolve with `smooth: true, powerEfficient: true`
- **Private State Tokens stub** — adds `document.hasPrivateToken()` and `document.hasRedemptionRecord()` (Chrome 101+); absence on recent Chrome is a red flag
- **UACH CDP override** — sets `Sec-CH-UA` HTTP request headers via `Emulation.setUserAgentOverride` `userAgentMetadata` parameter (brand list, platform, mobile flag)
- **Runtime custom formatter disabled** — `Runtime.setCustomObjectFormatterEnabled(false)` removes DevTools-injected formatter artifacts

### Added — ChromiumPatchManager

- **`src/main/fingerprint/chromium-patches.ts`** — singleton registry of 30 patches at 3 levels:
  - **JS Shim** (14 active): all Layer 1–3 vectors described with id, name, description, impact, technicalNote
  - **CDP Override** (7 active): UA override, timezone, chrome.runtime, error stacks, Worker webdriver, Blink masking, UACH
  - **Requires Custom Build** (9 planned): V8 symbol removal, GPU process vendor patch, native canvas noise, font metrics jitter, WebRTC DTLS randomization, kernel timer noise, audio buffer noise
- IPC handlers: `patches:status`, `patches:list`, `patches:getByCategory`

### Added — Detection Vectors (+15, total 45)

| # | Vector | Category |
|---|--------|----------|
| 31 | Intl locale consistency | Locale |
| 32 | UACH brands list | Browser |
| 33 | UACH platform vs UA | Browser |
| 34 | WebGPU API presence | API |
| 35 | Math FPU fingerprint | API |
| 36 | Prototype chain integrity | Automation |
| 37 | MediaCapabilities API | API |
| 38 | Keyboard Layout API | API |
| 39 | WebRTC SDP fingerprint | Network |
| 40 | devicePixelRatio consistency | Hardware |
| 41 | Navigation Timing v2 | Timing |
| 42 | SpeechSynthesis locale consistency | API |
| 43 | Private State Tokens API | API |
| 44 | SharedArrayBuffer + Atomics | API |
| 45 | Intl.supportedValuesOf stability | Locale |

### Added — PatchManager UI

- New **Patches** navigation section (Cpu icon)
- Coverage bar (active / total patches %)
- Category filter tabs: All / Fingerprint / Automation / Timing / Network / GPU / Locale
- Collapsible groups per implementation level (JS Shim / CDP Override / Custom Build)
- Expandable technical notes per patch row
- Summary cards: Active Patches, JS Shims, CDP Overrides, Custom Build (planned count)

### Fixed

- `process.stderr.write` filter in main process suppresses harmless `Autofill.enable` / `Autofill.setAddresses` CDP version-mismatch errors from Chrome's bundled DevTools frontend
- `ProfileManager`: `ReferenceError: Cannot access 'filtered' before initialization` — moved `const filtered` above the `useEffect` that referenced it in its dependency array (temporal dead zone)
- `Cannot find module 'electron-updater'` — ran `npm install` to restore missing node_modules entry

---

## [0.7.0] — 2026-04-07 · Phase 7: Batch Detection & Result Management

### Added

- **Batch detection testing** — select multiple profiles, run tests sequentially, display per-profile progress
- **Result management**
  - Delete individual detection test results
  - Clear all history for a specific profile or globally
- **Behavior / Timing config UI** in FingerprintEditor
  - Toggle: Mouse Jitter, Typing Cadence Noise, Scroll Inertia
  - Select: Date.now() precision (50 / 100 / 250 ms)
  - Toggle: rAF Timestamp Jitter, performance.now() Clamping
- IPC handlers: `detection:deleteResult`, `detection:clearHistory`, `detection:batchTest`
- Type: `BatchTestStatus { total, completed, failed, results }`

---

## [0.6.0] — 2026-04-06 · Phase 6: Behavior Simulation & Timing Defenses

### Added — Fingerprint Scripts

- **`behavior.ts`** — Layer 3 behavior simulation
  - Mouse jitter: sub-pixel Gaussian noise on `pointermove` / `mousemove` coordinates
  - Typing cadence: ±25 ms randomization on `keydown` / `keyup` timestamps
  - Scroll inertia: natural momentum decay on `wheel` events
  - All seeded from profile UUID hash (deterministic per profile)

- **`timing.ts`** — Timing attack defense
  - `Date.now()` quantized to 50 / 100 / 250 ms blocks (configurable)
  - `requestAnimationFrame` timestamp ±1.2 ms jitter
  - `performance.now()` clamped to same precision as `Date.now()`

### Added — CDP Evasion

- **`patchObjectDefinePropertyTrap()`** — normalizes `Object.getOwnPropertyDescriptor()` flags for patched navigator properties so they look native (configurable: true, enumerable: true)
- **`patchWorkerNavigator()`** — wraps `window.Worker` constructor to inject `navigator.webdriver = undefined` patch via blob URL `importScripts` chain
- **`maskBlinkInternals()`** — deletes `__selenium_*`, `__webdriver_*`, `$cdc_*`, `_Selenium_IDE_Recorder` and similar automation markers

### Added — Profile Versioning

- Save fingerprint snapshots with custom label (max 20 per profile, auto-pruned)
- Restore to any previous version (auto-snapshots current state before restore)
- Delete individual versions
- Auto-snapshot before fingerprint re-roll
- Database table: `profile_versions`

### Added — Detection Vectors (+10, total 30)

| # | Vector | Category |
|---|--------|----------|
| 21 | Date.now() precision | Timing |
| 22 | WebAssembly support | API |
| 23 | Object.defineProperty consistency | Automation |
| 24 | Worker navigator.webdriver | Automation |
| 25 | CSS media query consistency | Hardware |
| 26 | Battery API shape | API |
| 27 | Viewport consistency | Hardware |
| 28 | Selenium / WebDriver artifacts | Automation |
| 29 | Service Worker API | API |
| 30 | Document focus / visibility | Browser |

### Added — Types

- `BehaviorConfig { mouseJitter, typingNoise, scrollInertia }`
- `TimingConfig { dateNoisePrecision, rafJitter, performanceClamp }`
- `ProfileVersion { id, profileId, fingerprint, savedAt, label }`

---

## [0.5.0] — 2026-04-06 · Phase 5: Advanced CDP Evasion & Detection Testing

### Added — Fingerprint Scripts

- **`permissions.ts`** — `navigator.permissions.query()` spoofing with 16 realistic permission defaults
- **`storage.ts`** — `navigator.storage.estimate()` returning 50 GB quota
- **`network.ts`** — Network Information API: `effectiveType`, `downlink`, `rtt`, `saveData`
- **`performance.ts`** — `performance.now()` precision sanitization, removes automation entries

### Added — CDP Evasion

- **`hideChromeDriver()`** — removes `cdc_*` / `__cdc_*` ChromeDriver variables
- **`patchChromeRuntime()`** — full `window.chrome.runtime`, `.app`, `.loadTimes`, `.csi` stubs
- **`hideSourceUrl()`** — strips `__puppeteer_evaluation_script__` from `Error.prepareStackTrace`
- **`patchPermissionsApi()`** — permissions query patching
- **`patchIframeContentWindow()`** — MutationObserver patches iframe `navigator.webdriver`
- **`hideStackTraces()`** — `Error.prototype.stack` getter filters automation references
- **`patchHeadlessSignals()`** — fixes `outerWidth/outerHeight = 0`, `Notification.permission = 'denied'`
- **`patchConsoleDebug()`** — `Function.prototype.toString` Proxy masks patched functions as `[native code]`

### Added — Detection Test Runner

- `DetectionTestRunner` singleton — launches profile, runs 20 vectors, scores 0–100
- Status thresholds: ≥90 passed / 70–89 warning / <70 failed
- Persists results to `detection_tests` table (limit 50/profile, 100 global)
- IPC handlers: `detection:runTest`, `detection:results`, `detection:summary`

### Added — Detection Vectors (20 initial)

| # | Vector | Category |
|---|--------|----------|
| 1 | navigator.webdriver | Automation |
| 2 | chrome.runtime exists | Browser |
| 3 | chrome.app stub | Browser |
| 4 | navigator.plugins | Browser |
| 5 | Permissions API consistency | API |
| 6 | Navigator properties | Browser |
| 7 | Canvas fingerprint | Graphics |
| 8 | WebGL vendor/renderer | Graphics |
| 9 | AudioContext | Audio |
| 10 | Screen dimensions consistency | Hardware |
| 11 | Timezone override | Locale |
| 12 | Language consistency | Locale |
| 13 | Network Information API | API |
| 14 | Storage quota | API |
| 15 | Error stack traces | Automation |
| 16 | Function.toString masking | Automation |
| 17 | Headless browser signals | Automation |
| 18 | ChromeDriver variables | Automation |
| 19 | Performance entries | Automation |
| 20 | Notification.permission | API |

### Added — iOS Presets

- `ios-iphone14-safari17` — iOS 17.2, iPhone 14, Apple A15
- `ios-iphone15-safari17` — iOS 17.3, iPhone 15, Apple A16
- `ios-ipad-safari17` — iPadOS 17.2, iPad Air, Apple M1

### Added — Detection Dashboard UI

- Profile selector + run single test
- Score display with color coding
- Vector category breakdown (collapsible)
- Test history list per profile

### Added — Enhanced launch flags

- `--disable-features=AutomationControlled,IsolateOrigins`
- `--disable-blink-features=AutomationControlled,IdleDetection`
- `--disable-component-extensions-with-background-pages`
- `--disable-default-apps`, `--disable-background-networking`

---

## [0.4.0] — 2026-04-06 · Phase 4: Automation API & RPA Builder

### Added — Automation Engine

- `AutomationEngine` singleton with 17 action types:
  - `navigate`, `click`, `type`, `wait`, `waitForSelector`
  - `screenshot`, `extractText`, `scroll`, `select`, `keyPress`
  - `evaluate`, `hover`, `rightClick`, `setAttribute`, `httpRequest`
  - `conditional` (then/else branching on selector existence)
  - `loop` (repeat N times)
- Step-by-step result tracking: duration, success, output, error
- Workflow run persistence in `workflow_runs` table

### Added — Local REST API Server

- Express server (`ApiServer`) on configurable port (default 9222)
- Optional Bearer token authentication
- CORS headers for external integrations
- Endpoints: profiles CRUD, launch/close, active sessions, proxies, detection, workflows

### Added — Workflow Templates (6 built-in)

1. **Web Page Scraper** — navigate → wait → extract text → screenshot
2. **Login Flow** — fill email/password → submit → capture
3. **Social Media Feed Scroll** — loop: scroll + wait → final screenshot
4. **E-Commerce Price Checker** — extract title + price → screenshot
5. **Form Auto-Fill** — fill name/email/phone → submit → capture confirmation
6. **Site Health Check** — load → performance check → DOM check → conditional error capture

### Added — Mobile Presets

- `android-samsung-chrome120` — Android 13, Samsung Galaxy A54, Snapdragon 870
- `android-pixel-chrome121` — Android 14, Pixel 7, Mali-G710
- `android-oppo-chrome120` — Android 13, OPPO Reno, Snapdragon 870

### Added — Automation Builder UI

- Visual workflow editor (step list + step type picker)
- `StepEditor` — per-step param editor
- `WorkflowCreateModal`
- `TemplatePickerModal` — browse and instantiate built-in templates
- Run / stop controls with live status

### Added — IPC

- `workflows:list/get/create/update/delete/run/stop/isRunning/runs`
- `templates:list/get/createFromTemplate`
- `apiServer:status/config/start/stop`

---

## [0.3.0] — 2026-04-06 · Phase 3: Auth, Licensing & Team Features

### Added — Authentication

- Login / register / logout with email + password
- JWT access token + refresh token (auto-refresh on expiry)
- Persistent auth state (token stored in userData)
- `auth:me`, `auth:isAuthenticated`, `auth:updatePassword` endpoints

### Added — Licensing

- License plans: **free** (5 profiles / 1 member) · **starter** (50 / 3 / sync) · **professional** (500 / 15 / sync) · **enterprise** (unlimited / sync)
- Machine fingerprint derived from MAC address + CPU hash
- License activation / deactivation by key
- Profile creation gated by plan limit (`license:checkProfileLimit`)

### Added — Cloud Sync

- Push / pull profiles with **AES-256-GCM** end-to-end encryption
- Key derivation: `scryptSync` (32-byte key)
- Payload format: `[IV 12B][authTag 16B][ciphertext]`
- SHA-256 checksum on sync manifest
- Sync status: idle / syncing / error / offline / disabled
- `sync_log` table for history

### Added — Team Features

- Create / rename / delete team workspace
- Invite members by email with role (admin / editor / viewer)
- Cancel pending invites
- Change member roles, remove members
- Share profiles with specific members (read / write permission)
- Audit log: paginated with filters (user, action type)
- `audit_log` database table

### Added — Account UI

- Login / register forms with validation
- License status card + activation input
- Password change form
- Cloud sync push/pull controls with encryption password prompt

### Added — Team Manager UI

- Member list with role badges
- Invite modal
- Shared profiles list
- Audit log table with pagination

---

## [0.2.0] — 2026-04-06 · Phase 2: Hardening & UX Polish

### Added

- **Settings page** — default preset, UI language (en / vi / th / id), theme (dark / light), auto-launch last session
- **Auto-updater** — `electron-updater` integration; download + install from sidebar banner
- **Keyboard shortcuts** — Ctrl+N (new profile), Ctrl+F (focus search), Ctrl+R (refresh), Enter (launch first profile)
- **Profile groups** — create groups with custom colors, filter sidebar by group
- **Profile export / import** — ZIP bundle (profile.json + fingerprint.json + cookies.json)
- **Cookie manager** — import/export in JSON and Netscape formats
- **Proxy rotation** — none / random / round-robin per profile; rotation index persisted
- **Proxy health dashboard** — latency, healthy/unhealthy badge, last checked timestamp
- Profile `clone` action (new ID + fresh fingerprint, same preset)
- Profile `setGroup` IPC handler
- `--log-level` and `--metrics-recording-only` Chromium launch flags

---

## [0.1.0] — 2026-04-06 · Phase 1: MVP

### Added — Core Architecture

- **Electron 31 + React 18 + TypeScript** app bundled with `electron-vite`
- **sql.js (WASM)** SQLite — no native build deps required
- **Zustand** state management — `profileStore`, `proxyStore`
- **contextBridge** IPC pattern — all renderer→main communication via `window.api.*`
- `scripts/dev.js` — strips `ELECTRON_RUN_AS_NODE` before spawning `electron-vite` (prevents GUI breakage from Claude Code's env var)

### Added — Profile Manager

- Create profiles with name, preset, proxy, notes
- List / delete profiles
- Launch Chromium browser sessions via `puppeteer-core`
- Per-profile `userDataDir` isolated Chromium data directory
- Active session polling (3 s interval)
- `BrowserManager` singleton — session map, proxy injection, cookie injection

### Added — Fingerprint Engine

- `FingerprintInjector` — orchestrates `evaluateOnNewDocument` injection pipeline
- Deterministic noise seeds — derived from profile UUID via djb2 hash (same profile = same fingerprint every session)
- **11 fingerprint scripts** (Phases 1–2):
  - `navigator.ts` — UA, platform, vendor, languages, deviceMemory, hardwareConcurrency, maxTouchPoints, screen dimensions, battery API, media devices
  - `canvas.ts` — toDataURL/toBlob/getImageData noise
  - `webgl.ts` — vendor/renderer override + readPixels noise
  - `audio.ts` — AudioContext analyser/oscillator noise
  - `fonts.ts` — font check whitelist + measureText noise
  - `plugins.ts` — realistic plugin list
  - `webrtc.ts` — WebRTC IP leak prevention
  - `clientrects.ts` — getClientRects precision noise
  - `speech.ts` — speechSynthesis voice filtering
  - `permissions.ts` — Permissions API spoofing
  - `storage.ts` — storage quota mock

### Added — Built-in Presets (8 initial)

- `win10-chrome120`, `win11-chrome121`
- `mac-ventura-chrome120`, `mac-sonoma-chrome121`
- `linux-ubuntu-chrome120`
- `android-samsung-chrome120`, `android-pixel-chrome121`, `android-oppo-chrome120`

### Added — Proxy Manager

- Add / delete proxies (HTTP / HTTPS / SOCKS5)
- Test proxy with latency measurement + IP check
- Assign proxy to profile at launch time

### Added — Database Schema (initial)

```sql
profiles        (id, name, group_id, fingerprint, proxy_id, cookies, notes, last_used_at, created_at, user_data_path, status)
proxies         (id, name, type, host, port, username, password, country, latency_ms, is_healthy, last_checked_at, created_at)
profile_groups  (id, name, color, created_at)
```

---

## Version Map

| Version | Phase | Focus |
|---------|-------|-------|
| 0.1.0 | 1 | MVP: profiles, fingerprint engine, proxy manager |
| 0.2.0 | 2 | Hardening: settings, updater, keyboard shortcuts, groups, export/import |
| 0.3.0 | 3 | Monetization: auth, licensing, team features, cloud sync |
| 0.4.0 | 4 | Automation: RPA engine, local API server, workflow templates, mobile presets |
| 0.5.0 | 5 | Anti-detect: advanced CDP evasion, detection test suite (20 vectors), iOS presets |
| 0.6.0 | 6 | Behavior: mouse/keyboard/scroll simulation, timing defenses, profile versioning |
| 0.7.0 | 7 | Testing UX: batch detection, result management, behavior/timing config UI |
| 0.8.0 | 8 | Deep evasion: Chromium patch catalog, Layer 4 scripts, 45 detection vectors |
