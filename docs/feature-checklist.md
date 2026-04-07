# Ghost Browser — Feature Checklist & Continuation Plan

> **Status legend**: ✅ Done · 🟡 Partial · ⏳ Planned · ⏭️ Skipped

This document is the single source of truth for what has shipped, what is in flight,
and what comes next. It is the authoritative checklist for development planning.

---

## 1. Phase Status Overview

| Phase | Theme | Version | Status |
|------:|-------|---------|--------|
|  1 | MVP — profiles, fingerprint engine, proxy manager | 0.1.0 | ✅ |
|  2 | Hardening — settings, updater, groups, export/import | 0.2.0 | ✅ |
|  3 | Monetization — auth, license, team, cloud sync | 0.3.0 | ✅ |
|  4 | Automation — RPA engine, REST API, templates, mobile presets | 0.4.0 | ✅ |
|  5 | Advanced CDP evasion, detection testing, iOS presets | 0.5.0 | ✅ |
|  6 | Behavior simulation, timing defenses, profile versioning | 0.6.0 | ✅ |
|  7 | Batch detection, result management, behavior/timing UI | 0.7.0 | ✅ |
|  8 | Chromium patch catalog, Layer 4 scripts, 45 detection vectors | 0.8.0 | ✅ |
|  9 | UX polish (toast, error boundaries, bulk ops, search, export) | 0.9.0 | ✅ |
| 10 | Fingerprint completeness (geo, mobile CDP, WebRTC fake, etc.) | 0.10.0 | ✅ |
| 11 | Automation completeness (variables, capture, bulk proxy, REST) | 0.11.0 | ✅ |
| 12 | Network-layer hardening + product polish | 0.12.0 | 🟡 in progress |
| 13 | Testing & DX | — | ⏳ |

---

## 2. Feature Inventory (Implemented)

### 2.1 Core platform

- [x] Electron 31 + React 18 + TypeScript bundled with `electron-vite`
- [x] sql.js (WASM) SQLite — no native build deps
- [x] Zustand state stores: `profileStore`, `proxyStore`, `authStore`, `licenseStore`,
      `teamStore`, `syncStore`, `automationStore`, `toastStore`
- [x] contextBridge IPC pattern — `window.api.*`
- [x] `scripts/dev.js` — strips `ELECTRON_RUN_AS_NODE` for Claude Code compatibility
- [x] React Error Boundaries per major section ([src/renderer/src/components/UI/](src/renderer/src/components/UI/))
- [x] Global toast notification system

### 2.2 Profile management

- [x] Create / list / update / delete / clone profiles
- [x] Per-profile isolated Chromium `userDataDir`
- [x] Active session polling
- [x] Profile groups with custom colors
- [x] Profile export / import (ZIP bundle)
- [x] Bulk operations: select-many, bulk delete / clone / export
- [x] Profile search (name, notes, OS, proxy name)
- [x] Profile version history (max 20 per profile, auto-snapshot before re-roll)
- [x] Profile userData cleanup on delete
- [x] Cookie import / export (JSON + Netscape)
- [x] Live cookie capture from running browser session
- [x] Profile drift (Phase 11.2/11.3 — drift_enabled, last_drift_at, warmed_up)
- [x] Profile warm-up routine

### 2.3 Fingerprint engine

#### Layer 1 — JS injection (15 scripts)

- [x] [navigator.ts](src/main/fingerprint/scripts/navigator.ts) — UA, platform, hardware, screen, plugins, battery, media devices
- [x] [canvas.ts](src/main/fingerprint/scripts/canvas.ts) — toDataURL/toBlob/getImageData noise (block-mode toBlob fix)
- [x] [webgl.ts](src/main/fingerprint/scripts/webgl.ts) — vendor/renderer override + readPixels noise
- [x] [audio.ts](src/main/fingerprint/scripts/audio.ts) — analyser + oscillator noise
- [x] [fonts.ts](src/main/fingerprint/scripts/fonts.ts) — whitelist + measureText noise
- [x] [plugins.ts](src/main/fingerprint/scripts/plugins.ts) — realistic plugin list
- [x] [webrtc.ts](src/main/fingerprint/scripts/webrtc.ts) — disabled / fake / real modes
- [x] [clientrects.ts](src/main/fingerprint/scripts/clientrects.ts) — getClientRects precision noise
- [x] [speech.ts](src/main/fingerprint/scripts/speech.ts) — speechSynthesis voice filter
- [x] [permissions.ts](src/main/fingerprint/scripts/permissions.ts) — Permissions API
- [x] [storage.ts](src/main/fingerprint/scripts/storage.ts) — quota mock
- [x] [network.ts](src/main/fingerprint/scripts/network.ts) — Network Information API
- [x] [performance.ts](src/main/fingerprint/scripts/performance.ts) — perf timing sanitization
- [x] [keyboard.ts](src/main/fingerprint/scripts/keyboard.ts) — locale-aware Keyboard Layout API
- [x] [behavior.ts](src/main/fingerprint/scripts/behavior.ts) — mouse jitter, typing cadence, scroll inertia
- [x] [timing.ts](src/main/fingerprint/scripts/timing.ts) — Date.now / rAF / performance.now quantization

#### Layer 2 — CDP evasion

- [x] hideChromeDriver, patchChromeRuntime, hideSourceUrl
- [x] patchPermissionsApi, patchIframeContentWindow, hideStackTraces
- [x] patchHeadlessSignals, patchConsoleDebug
- [x] patchObjectDefinePropertyTrap, patchWorkerNavigator, maskBlinkInternals
- [x] Math FPU determinism, prototype-chain integrity
- [x] MediaCapabilities normalisation, Private State Tokens stub
- [x] UACH CDP override, Runtime custom-formatter disabled

#### Layer 4 — Phase 8 scripts

- [x] [intl.ts](src/main/fingerprint/scripts/intl.ts) — Intl locale normalization
- [x] [webgpu.ts](src/main/fingerprint/scripts/webgpu.ts) — navigator.gpu stub
- [x] [useragentdata.ts](src/main/fingerprint/scripts/useragentdata.ts) — UACH brands

#### Configuration

- [x] 11 built-in presets (5 desktop + 3 Android + 3 iOS)
- [x] Chrome 124 presets (Win11/Sonoma/Pixel8)
- [x] Geolocation spoofing per profile
- [x] Mobile CDP emulation (viewport + touch)
- [x] Locale ↔ timezone validation with warning badge
- [x] FingerprintEditor — vector status dashboard (45 vectors)
- [x] Behavior + Timing config UI

### 2.4 Proxy manager

- [x] Add / delete proxies (HTTP / HTTPS / SOCKS5)
- [x] Test proxy with latency + IP check
- [x] Health dashboard (latency, healthy badge, last checked)
- [x] Proxy rotation: none / random / round-robin
- [x] SOCKS5 DNS leak prevention via `--proxy-dns`
- [x] Bulk import (paste-in modal)

### 2.5 Detection testing

- [x] DetectionTestRunner singleton — 50 vectors (45 fingerprint + 5 network alignment)
- [x] Score 0–100 with color coding (passed ≥90 / warning 70–89 / failed <70)
- [x] Per-profile + global history with limits
- [x] Single-profile run + batch run (multi-select)
- [x] Result delete (single + clear-history)
- [x] CSV export (per-profile + batch)
- [x] DetectionDashboard UI with category breakdown

### 2.6 Automation engine

- [x] AutomationEngine singleton with **21 actions**:
  - `navigate`, `click`, `type`, `wait`, `waitForSelector`
  - `screenshot`, `extractText`, `scroll`, `select`, `keyPress`
  - `evaluate`, `hover`, `rightClick`, `setAttribute`, `httpRequest`
  - `conditional`, `loop`
  - `upload`, `download` (Phase 12.B.3)
  - **`solveCaptcha`, `injectCaptchaToken`** (Phase 12.B.1)
- [x] Per-step variable interpolation (`{key}` placeholders) — captcha tokens flow into later steps
- [x] Workflow stored variables + per-run runtime overrides (Phase 12.B.4)
- [x] Workflow VariablesEditor UI with placeholder warnings
- [x] Run-time overrides panel in run controls
- [x] Parallel execution (`executeWorkflowParallel` with batching)
- [x] Stop / stop-all
- [x] 6 built-in workflow templates
- [x] Workflow scheduling (cron, Phase 10.2)
- [x] Workflow run history persistence
- [x] AutomationBuilder UI: visual editor, StepEditor, template picker, schedules modal

### 2.7 REST API server

- [x] Express server on configurable port (default 9222)
- [x] Optional Bearer token auth, CORS
- [x] Endpoints: profiles (CRUD + launch/close/active), proxies (full CRUD), workflows
      (full CRUD + run), detection (run + summary), patches status

### 2.8 Auth, license, team, sync

- [x] Login / register / logout / password change
- [x] JWT access + refresh tokens
- [x] License plans: free / starter / professional / enterprise
- [x] Machine fingerprint (MAC + CPU hash)
- [x] License activation/deactivation
- [x] Profile creation gated by plan limit
- [x] Team workspace (create/rename/delete)
- [x] Member invites (admin/editor/viewer)
- [x] Profile sharing with permissions
- [x] Audit log (paginated, filterable)
- [x] Cloud sync (push/pull) with AES-256-GCM E2E encryption
- [x] scryptSync key derivation
- [x] Sync conflict resolution (local-wins, logged)
- [x] Profile extensions (per-profile browser extensions, Phase 10.3)

### 2.9 Settings & system

- [x] Settings page (default preset, language, theme, autoLaunchLastSession)
- [x] Auto-launch last session
- [x] Light / dark theme (CSS custom properties)
- [x] Auto-updater (electron-updater) with periodic 4-hour interval
- [x] Keyboard shortcuts (Ctrl+N/F/R, Enter)
- [x] Chromium fallback handling (`CHROMIUM_NOT_FOUND` typed error)
- [x] Chromium binary version detection (Phase 12.A.1)
- [x] Auto-sync profile UA → binary version on launch (toggleable)
- [x] Settings UI section showing detected binary path + version

### 2.10 Phase 8 — Chromium patch catalog

- [x] ChromiumPatchManager singleton — registry of 30 patches
- [x] PatchManager UI with coverage bar, category filter, technical notes
- [x] IPC: `patches:status`, `patches:list`, `patches:getByCategory`

---

## 3. Phase 12 — In Progress

Source plan: [docs/phase12-plan.md](docs/phase12-plan.md)

### Track A — Network-layer hardening

- [x] **12.A.1** Chromium binary version detection + auto-sync UA
- [x] **12.A.2** HTTP/2 / network fingerprint detection vectors (5 alignment vectors)
- [ ] **12.A.3** TLS / JA3 rewriting proxy ⏳ (XL — deferred until demand proven)

### Track B — Automation power-user features

- [x] **12.B.1** Captcha solving integration (2captcha / anti-captcha / CapMonster)
- [x] **12.B.2** Visual selector recorder
- [x] **12.B.3** File upload / download workflow actions
- [x] **12.B.4** Workflow variables editor

### Track C — Profile state management

- [x] **12.C.1** Interactive cookie editor (table view with edit/delete)
- [x] **12.C.2** LocalStorage / IndexedDB inspector per profile
- [x] **12.C.3** Encrypted credential vault (master password)
- [x] **12.C.4** Fingerprint collision detector

---

## 4. Continuation Plan — Recommended Order

The pending Phase 12 items are sequenced below by **value-per-effort** plus dependency
order. Each item has a defined acceptance test so "done" is unambiguous.

### Slot 1 — 12.C.4 Fingerprint Collision Detector ✅

Shipped. See [docs/phase12-plan.md](docs/phase12-plan.md#12c4--fingerprint-collision-detector-).

---

### Slot 2 — 12.A.2 HTTP/2 Fingerprint Detection Vectors ✅

Shipped as 5 in-page alignment vectors (no external network, no TLS proxy yet — that's
12.A.3). Total detection vectors: **45 → 50**. New `Network` category in the dashboard.

**Implemented vectors** (all in [src/main/detection-test.ts](src/main/detection-test.ts)):

1. `testBinaryUaAlignment` — spoofed `Chrome/<n>` major vs the real Chromium binary major
   from `BrowserManager.getCachedBinaryInfo()` (12.A.1). The most valuable local check
   we can run: a 121/132 mismatch is exactly what server-side TLS/JA3 reveals.
2. `testUachBrandsAlignment` — `navigator.userAgentData.brands` real-brand major vs UA
   `Chrome/<n>` major (greasy `Not.A.Brand` entries filtered out).
3. `testUachPlatformAlignment` — `userAgentData.platform` family vs `navigator.platform`
   family (`Win32→Windows`, `MacIntel→macOS`, etc.).
4. `testUachMobileTouchAlignment` — `userAgentData.mobile` vs `navigator.maxTouchPoints`
   and the UA's mobile token. Catches desktop-UA-with-touch and mobile-UA-without-touch.
5. `testAcceptLanguageAlignment` — `navigator.languages[0]`, `navigator.language`, and
   `Intl.DateTimeFormat().resolvedOptions().locale` base codes must all agree.

iOS / Safari profiles are auto-skipped where appropriate (no `Chrome/` token, no `userAgentData`).

**Why no external endpoint**: Probing `tls.peet.ws` or a self-hosted worker would add a
runtime network dependency for what is otherwise an offline-friendly test runner. The
in-page alignment checks catch the same class of bug — a mis-synced UA — at zero cost.
A real ClientHello probe is the job of 12.A.3 (TLS proxy), not the detector.

---

### Slot 3 — 12.B.1 Captcha Solving Integration ✅

Shipped. Three providers (2Captcha, Anti-Captcha, CapMonster), two new automation actions
(`solveCaptcha`, `injectCaptchaToken`), Settings UI with per-provider key + balance check.
See [docs/phase12-plan.md](docs/phase12-plan.md#12b1--captcha-solving-integration-).

**Notable architecture change**: the automation engine now interpolates variables
**per-step** instead of upfront, so `solveCaptcha` can write `{captchaToken}` into the
live variables map and have a later `injectCaptchaToken` (or any step) consume it.

---

### Slot 4 — 12.C.1 Interactive Cookie Editor ✅

Shipped. CookieModal is now a 3-tab modal — **Browse / Edit · Import · Export** — with
search, inline edit, per-row delete, add-new-row, capture-from-live, and save-changes
that pushes updates into the live Chromium session in addition to persisting to the
profile's DB blob. See [docs/phase12-plan.md](docs/phase12-plan.md#12c1--interactive-cookie-editor-).

**IPC**:
- `cookies:list(profileId)` → parsed `Cookie[]` from the DB blob
- `cookies:save(profileId, cookies)` → persists to DB **and** pushes to the active page
  via `page.deleteCookie(...existing)` + `page.setCookie(...new)` (DB stays source of truth
  on next launch even if the page sync fails)

---

### Slot 5 — 12.C.2 LocalStorage / IndexedDB Inspector ✅

Shipped as a standalone `StorageInspectorModal` rather than as a tab inside CookieModal —
the read-only inspector is conceptually separate (CDP-only, requires running profile)
and a new top-level "Storage..." menu item on each profile card opens it.

**IPC** (all CDP-backed; require live target):
- `storage:listOrigins(profileId)` — collected from every frame in every open page
- `storage:getDOMStorage(profileId, origin, isLocalStorage)` — DOMStorage via CDP
- `storage:listIndexedDb(profileId, origin)` — IndexedDB databases + object stores
- `storage:getIndexedDbEntries(profileId, origin, dbName, store, max?)` — entries (capped 100, max 500)

**UI**: 3-tab modal (localStorage / sessionStorage / IndexedDB) with origin selector,
re-scan button, key/value tables, cascading db→store dropdowns for IndexedDB, and a
"hasMore" notice when an IndexedDB store has more entries than the page size.

See [docs/phase12-plan.md](docs/phase12-plan.md#12c2--localstorage--indexeddb-inspector-per-profile-).

---

### Slot 6 — 12.B.2 Visual Selector Recorder ✅

Shipped. Single-process design — no HTTP/IPC pipe needed: the recorder uses
`page.exposeFunction('__ghostRecord', …)` so the in-page bootstrap just calls a
function that lives in the main process.

**Selector strategy**: `#id` → `[data-testid]` → `tag[name=…]` → `tag[aria-label=…]`
→ 3-deep parent chain with class filtering and `:nth-of-type` disambiguation. Click
handlers walk up to the nearest interactive ancestor (`<button>`/`<a>`/`role=button`).

**Coalescing**: consecutive `input` events on the same selector merge into one;
a click immediately followed by typing into the same selector drops the click.
Password fields record the selector but mask the value.

See [docs/phase12-plan.md](docs/phase12-plan.md#12b2--visual-selector-recorder-).

---

### Slot 7 — 12.C.3 Encrypted Credential Vault ✅

Shipped. See [docs/phase12-plan.md](docs/phase12-plan.md#12c3--encrypted-credential-vault-).

**Highlights**:
- `credentials` + `vault_meta` tables with full CRUD in [src/main/database.ts](src/main/database.ts)
- New [src/main/vault.ts](src/main/vault.ts) — AES-256-GCM + scrypt-derived key,
  sentinel-based password verification, 15-min idle auto-lock, key buffer zeroed on lock
- 8 IPC handlers under `vault:*` (`status`, `unlock`, `lock`, `list`, `get`, `create`,
  `update`, `delete`)
- New `useCredential` automation action loads a vault entry into workflow variables
  under a configurable prefix — `{cred.username}`, `{cred.password}`, `{cred.<field>}`
- `interpolateParams` regex updated to support dotted placeholder keys
- Settings page **Credential Vault** card: unlock/create form, locked/unlocked status,
  inline add credential dialog, credential list, delete buttons

---

### Slot 8 — 12.A.3 TLS / JA3 Rewriting Proxy ⏳

**Why last**: XL. Defer until 12.A.2 (detection vectors) actually shows a measurable
gap on real users' setups. If 12.A.1 (binary version sync) closes most of the gap,
this slot may stay deferred.

**Implementation outline** (only when justified):
1. Bundle a Go binary built from `github.com/refraction-networking/utls` exposing a local
   HTTP/SOCKS5 proxy that rewrites the ClientHello to match a target Chrome major
2. Spawn the binary alongside the Electron process; launch all profiles with
   `--proxy-server=http://127.0.0.1:<dynamic>`
3. Per-profile hand-off: pass the target Chrome major + upstream proxy via control channel
4. Health check + auto-restart

**Effort**: XL · **Risk**: High · **Acceptance**: Detection vectors from 12.A.2 score
"passed" on a profile whose UA was pinned to a Chrome major different from the bundled
binary.

---

## 5. Phase 13 — Testing & Developer Experience

These items are not blocked by Phase 12 and can be picked up at any time.

- [ ] **13.1** Component test coverage — add `@testing-library/react` + vitest jsdom env;
  cover `profileStore`, `FingerprintEditor`, `DetectionDashboard`, `ProxyManager`. **L effort.**
- [ ] **13.2** Storybook for UI primitives ([src/renderer/src/components/UI/](src/renderer/src/components/UI/)) — Toast,
  ErrorBoundary, modal shells. **S effort.**
- [x] **13.3** Pre-commit hook (husky + lint-staged) — runs `npm run typecheck` whenever
  any `*.{ts,tsx}` file is staged.
  - `lint-staged.config.cjs` uses the **function form** (`'*.{ts,tsx}': () => 'npm run typecheck'`)
    so lint-staged does NOT inject staged filenames as positional args. Required because
    `tsc -p tsconfig.*.json` rejects extra positional arguments — we have to typecheck
    the whole project, not individual files.
  - `.husky/pre-commit` runs `npx lint-staged`. `npm install` runs `husky` via the `prepare`
    script which installs the git hook.
- [x] **13.4** CI workflow (GitHub Actions) — `.github/workflows/ci.yml` runs three jobs
  on push to main and on PRs against main: `typecheck` (`npm run typecheck`), `test`
  (`npm test`), and `build` (`npm run build`, depends on `typecheck`). Uses
  `actions/setup-node@v4` with npm cache. Concurrency group cancels in-progress runs
  for the same ref when a new commit lands. The outdated `tests/unit/fingerprint-presets.test.ts`
  baseline-count assertion was relaxed from `=== 5` to `>= 5` since we now ship 14 presets.
- [x] **13.5** Resolve pre-existing typecheck errors flagged in Phase 12 work
  - **Root cause discovered**: `npm run typecheck` was running `tsc --noEmit` against
    the root `tsconfig.json`, which only contains project references and an empty
    `files: []`. Without `--build`, that's a no-op — typecheck silently passed while
    both subprojects had ~140 real errors between them.
  - **Fix**: `npm run typecheck` now runs `tsc --noEmit -p tsconfig.node.json &&
    tsc --noEmit -p tsconfig.web.json`. Both subprojects pass clean.
  - **Node project fixes**:
    - `tsconfig.node.json` bumped from `lib: ["ES2022"]` to `lib: ["ES2023", "DOM",
      "DOM.Iterable"]` and `target: "ES2023"`. DOM lib is needed because
      puppeteer's `page.evaluate()` callback bodies reference browser globals
      (`navigator`, `window`, `document`, `Element`, etc.) that are type-checked
      in the main-process scope but execute in the browser. ES2023 gives us
      `Array.prototype.findLast`.
    - `src/main/api-server.ts` — removed `created_at`/`updated_at` from
      `db.createWorkflow(...)` call (those columns are auto-set by the DB layer);
      replaced `runner.getSummary()` with `db.getDetectionTestSummary()`.
    - `src/main/automation.ts` — typed the file-input ElementHandle as
      `ElementHandle<HTMLInputElement>` so `.uploadFile()` is callable.
    - `src/main/detection-test.ts` — coerced two boolean expressions to actual
      `boolean` (`!!hasVendor && !!hasPlatform`, `!!(charging && level && validLevel)`)
      so they satisfy the `passed: boolean` field of `DetectionVectorResult`.
    - `src/shared/types.ts` — widened `HardwareConfig.hardwareConcurrency` to
      include `10`, `20`, `24` (presets had values outside the union).
    - `src/main/fingerprint/scripts/{behavior,intl,timing,useragentdata,webgpu}.ts`
      — fixed wrong relative path `'../../../../shared/types'` →
      `'../../../shared/types'` (one extra dot-dot).
  - **Web project fixes**:
    - `src/renderer/src/env.d.ts` — replaced the manually-maintained `Window.api`
      interface (which was missing `schedules`, `patches`, `drift`, `extensions`,
      `warmup`, `runParallel`, `stopAll`, `importBulk`, etc.) with a type derived
      directly from the preload bridge:
      `import type { API } from '../../preload/index'; declare global { interface
      Window { api: API } }`. Now adding/removing namespaces in
      `src/preload/index.ts` auto-updates renderer types — no manual sync needed.
    - `src/preload/index.ts` — `updater.onStatus` and `sync.onStatus` cleanup
      callbacks now wrap `removeListener(...)` in a block so they return `void`
      (not `IpcRenderer`), matching React's `EffectCallback` Destructor type.
    - `src/renderer/src/components/ProfileManager/index.tsx` — copy the IPC
      Node-Buffer into a `new Uint8Array(buffer)` before constructing the export
      `Blob`. Modern lib.dom.d.ts requires `BlobPart` to be `ArrayBufferView<ArrayBuffer>`,
      and Buffer's `ArrayBufferLike` may be a `SharedArrayBuffer`.
    - `src/renderer/src/components/TeamManager/index.tsx` — wrapped the owner
      `<Crown>` icon in `<span title="Owner">` since lucide icons don't accept a
      `title` prop directly.

---

## 6. Phase 14 — Speculative / Wishlist

Not yet committed; collected here so good ideas don't get lost.

- [ ] **14.1** Per-profile network throttling presets (slow 3G, fast 4G, fiber)
- [ ] **14.2** Headless mode toggle per profile (currently always headful)
- [ ] **14.3** WebRTC TURN relay support for `fake` mode (instead of static fake IPs)
- [ ] **14.4** Profile templates marketplace — share fingerprint configs between users
- [ ] **14.5** Workflow marketplace — share automation workflows
- [ ] **14.6** Real-time collaboration on workflows (CRDT-backed)
- [ ] **14.7** Mobile companion app — view profile status, run workflows remotely
- [ ] **14.8** Distributed execution — offload workflow runs to a worker pool
- [ ] **14.9** Vietnamese / Thai / Indonesian i18n (skipped from Phase 12.1)
- [ ] **14.10** Browser extension that exports cookies + localStorage from regular Chrome
  → Ghost Browser profile

---

## 7. Working Conventions

- Each Phase ships in version `0.<phase>.0`. Sub-items get `0.<phase>.<minor>` if released
  independently.
- Mark items ✅ in this file *and* [docs/phase12-plan.md](docs/phase12-plan.md) (or the
  next phase plan) when shipped. Update [CHANGELOG.md](CHANGELOG.md) the same commit.
- Slot order in §4 is a recommendation, not a contract — pull whichever item unblocks the
  most user value next.
- Pre-existing typecheck errors are tracked under §5 13.5 and should be cleaned up as a
  batch, not one-by-one alongside new feature work.
