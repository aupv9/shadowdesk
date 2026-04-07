# Ghost Browser — Claude Code Guide

## Project Overview
Anti-detect browser platform targeting SEA market (Vietnam, Thailand, Indonesia).
Desktop app: **Electron 31 + React 18 + TypeScript**, packed with `electron-vite`.

## Commands

```bash
npm run dev        # Start dev mode (builds + launches Electron window)
npm run build      # Build for production
npm run typecheck  # TypeScript check without build
npm run dist:win   # Package Windows installer
```

> **CRITICAL**: `npm run dev` uses `scripts/dev.js` which deletes `ELECTRON_RUN_AS_NODE`
> from the environment before spawning electron-vite. Claude Code sets this env var
> internally, which would break Electron's GUI layer if inherited.
> Never run `electron-vite dev` directly — always use `npm run dev`.

## Architecture

```
src/
├── main/                  # Electron main process (Node.js)
│   ├── index.ts           # App entry — window creation, DB init, IPC registration
│   ├── database.ts        # sql.js SQLite wrapper (async init, sync queries)
│   ├── browser-manager.ts # Chromium profile launcher via puppeteer-core
│   ├── api-client.ts      # HTTP client for backend API (token auth, refresh, retry)
│   ├── auth.ts            # Auth service (login, register, logout, token mgmt)
│   ├── license.ts         # License validation, machine fingerprint, plan limits
│   ├── team.ts            # Team CRUD, members, invites, shared profiles, audit log
│   ├── sync.ts            # Cloud sync with E2E encryption (AES-256-GCM)
│   ├── automation.ts      # AutomationEngine — 17 actions incl. conditional/loop
│   ├── api-server.ts      # Local REST API server for external automation control
│   ├── workflow-templates.ts # 6 pre-built workflow templates
│   ├── detection-test.ts  # Detection test runner — evaluates 20 vectors per profile
│   ├── fingerprint/
│   │   ├── injector.ts    # CDP injection pipeline (evaluateOnNewDocument + CDP APIs)
│   │   ├── cdp-evasion.ts # Advanced CDP evasion — hides DevTools/automation traces
│   │   ├── presets.ts     # 11 built-in presets (5 desktop + 3 Android + 3 iOS); resolveFingerprint()
│   │   └── scripts/       # JS override strings (returned as template literals)
│   │       ├── navigator.ts    — UA, platform, hardware, screen, plugins, battery, media devices
│   │       ├── canvas.ts       — noise injection on toDataURL/toBlob/getImageData
│   │       ├── webgl.ts        — vendor/renderer override + readPixels noise
│   │       ├── audio.ts        — AudioContext noise on analyser + oscillator
│   │       ├── fonts.ts        — document.fonts.check whitelist + measureText noise
│   │       ├── permissions.ts  — Permissions API spoofing
│   │       ├── storage.ts      — Storage quota fingerprint defense
│   │       ├── network.ts      — Network Information API spoofing
│   │       └── performance.ts  — Performance API timing sanitization
│   ├── ai-assistant.ts    # Phase 16 — AI service (generateWorkflow, analyzeDetection, healSelector, archetypes)
│   └── ipc/handlers.ts    # All ipcMain.handle() registrations
├── preload/index.ts       # contextBridge — exposes window.api to renderer
├── shared/types.ts        # Shared TypeScript interfaces (Profile, ProxyConfig, FingerprintConfig, User, Team, License, Sync…)
└── renderer/              # React UI (Vite dev server in dev mode)
    └── src/
        ├── App.tsx                         # Root: Sidebar + section router
        ├── components/
        │   ├── Layout/{Sidebar,Header}.tsx
        │   ├── ProfileManager/             # List, card, create modal
        │   ├── ProxyManager/               # Add/test/delete proxies
        │   ├── FingerprintEditor/          # Vector protection status dashboard (34 vectors)
        │   ├── DetectionDashboard/         # Detection test runner + score dashboard
        │   ├── Account/                    # Auth, license, cloud sync UI
        │   ├── TeamManager/               # Team workspace, members, invites, audit log
        │   └── Settings/                  # App settings
        ├── stores/
        │   ├── profileStore.ts  # Zustand — profiles + active sessions
        │   ├── proxyStore.ts    # Zustand — proxies + test state
        │   ├── authStore.ts     # Zustand — auth state + login/register/logout
        │   ├── licenseStore.ts  # Zustand — license plan + usage
        │   ├── teamStore.ts     # Zustand — team, members, invites, audit
        │   └── syncStore.ts     # Zustand — cloud sync status + push/pull
        └── types/index.ts       # Re-exports from shared/types + renderer-only types
```

## Key Conventions

### IPC Pattern
All communication between renderer and main goes through IPC:
- **Main**: `ipcMain.handle('channel:action', handler)` in `src/main/ipc/handlers.ts`
- **Preload**: expose via `window.api.namespace.method()` in `src/preload/index.ts`
- **Renderer**: call `window.api.profiles.list()` etc. (typed via `src/renderer/src/env.d.ts`)

Adding a new IPC channel requires updating all three files.

### Database (sql.js)
- Database is a **singleton** — `Database.getInstance()`
- `initialize()` is **async** (WASM load) — only called once at startup in `main/index.ts`
- All query methods are **synchronous** after init
- Every write auto-saves to disk (`this.save()` after every `run()`)
- sql.js uses positional params `?` not named params like better-sqlite3

### Fingerprint Engine
- Each vector is a **self-contained JS string** built by `build*Script()` functions
- All scripts are combined and injected via `page.evaluateOnNewDocument(combined)`
- Noise seeds are **deterministic per profile** (seeded from profile UUID hash)
- **Consistency rule**: all scripts use the same seed so same profile = same fingerprint across sessions
- Layer 1 (CDP + JS): core fingerprint spoofing
- Layer 2 (Advanced CDP Evasion): automation hiding, stack sanitization, chrome.runtime stubs
- Layer 3 (Behavior + Timing): mouse jitter, typing cadence, scroll inertia, timing quantisation ✅ Phase 6
- Layer 4 (Chromium C++ patches): planned Phase 8

### React / State
- State lives in **Zustand stores** — no prop drilling, no Context
- Stores call `window.api.*` directly — no separate service layer
- Profile fingerprint is stored as JSON string in DB, parsed on read (`parseProfile()`)

## Database Schema

**profiles**: `id, name, group_id, fingerprint (JSON), proxy_id, cookies, notes, last_used_at, created_at, user_data_path, status`

**proxies**: `id, name, type, host, port, username, password, country, latency_ms, is_healthy, last_checked_at, created_at`

**audit_log**: `id, user_id, user_name, action, target_id, target_name, timestamp, ip_address`

**profile_versions**: `id, profile_id, fingerprint (JSON), label, saved_at` (Phase 6 — max 20 per profile)

**detection_tests**: `id, profile_id, profile_name, tested_at, overall_score, vectors (JSON), status`

**sync_log**: `id, direction, profile_count, status, synced_at`

**detection_tests**: `id, profile_id, profile_name, tested_at, overall_score, vectors (JSON), status`

## Fingerprint Presets (11 built-in)
| Key | OS | Browser |
|-----|-----|---------|
| `win10-chrome120` | Windows 10 | Chrome 120 |
| `win11-chrome121` | Windows 11 | Chrome 121 |
| `mac-ventura-chrome120` | macOS Ventura | Chrome 120 |
| `mac-sonoma-chrome121` | macOS Sonoma | Chrome 121 |
| `linux-ubuntu-chrome120` | Ubuntu 22.04 | Chrome 120 |
| `android-samsung-chrome120` | Android 13 (Samsung A54) | Chrome 120 |
| `android-pixel-chrome121` | Android 14 (Pixel 7) | Chrome 121 |
| `android-oppo-chrome120` | Android 13 (OPPO Reno) | Chrome 120 |
| `ios-iphone14-safari17` | iOS 17.2 (iPhone 14) | Safari 17 |
| `ios-iphone15-safari17` | iOS 17.3 (iPhone 15) | Safari 17 |
| `ios-ipad-safari17` | iPadOS 17.2 (iPad Air) | Safari 17 |

## Technology Choices & Rationale

| Decision | Choice | Why |
|----------|--------|-----|
| SQLite library | `sql.js` (WASM) | No VS C++ build tools needed on this machine; better-sqlite3 requires native compilation |
| Bundler | `electron-vite` | Purpose-built for Electron — handles main/preload/renderer separately |
| State | Zustand | Minimal boilerplate; works well with IPC async patterns |
| Icons | lucide-react | Tree-shakeable, consistent stroke style |

## Phase Roadmap (from PRD)
- **Phase 1** (Weeks 1–8): MVP — profiles, fingerprint engine, proxy manager ✅
- **Phase 2** (Weeks 9–14): Advanced vectors, proxy rotation, UX polish ✅
- **Phase 3** (Weeks 15–22): API client, licensing, team features, cloud sync ✅
- **Phase 4** (Weeks 23–28): Automation API, RPA builder, mobile presets, workflow templates ✅
- **Phase 5** (Weeks 29–34): Advanced CDP evasion, detection testing, iOS presets, new vectors ✅
- **Phase 6** (Weeks 35–40): Behavior simulation, timing defenses, profile versioning, 10 new detection vectors ✅
- **Phase 7** (Weeks 41–46): Batch detection testing, result management, behavior/timing config UI ✅
- **Phase 8** (Weeks 47–54): 45 detection vectors, Chromium patch catalog (30 patches), Layer 4 scripts (Intl/WebGPU/UACH), Phase 8 CDP evasion (MathFPU/ProtoChain/MediaCap/TrustTokens), PatchManager UI ✅
- **Phase 16** (Weeks 81–90): AI-Assisted Automation — NL Workflow Builder (16.A), AI Detection Advisor (16.B), Smart Selector Healing (16.C), Behaviour Pattern Library 10 archetypes (16.D) ✅ **current**

## Common Gotchas

1. **`ELECTRON_RUN_AS_NODE`** — Claude Code sets this. Always use `npm run dev`, never `electron-vite dev` directly.
2. **sql.js async init** — `db.initialize()` must be awaited before IPC handlers are registered. The order in `main/index.ts` matters.
3. **`require('electron')`** — only works inside the Electron process (with `ELECTRON_RUN_AS_NODE` unset). Importing electron modules in renderer code won't work.
4. **Fingerprint JSON** — stored as a TEXT blob in SQLite. Always `JSON.parse()` on read.
5. **Profile user-data-dir** — each profile gets its own Chromium user-data directory under `app.getPath('userData')/profiles/<id>/`. Created lazily on first launch.
