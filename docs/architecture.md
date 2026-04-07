# Architecture Overview

## Technology Stack

| Layer | Technology | Reason |
|-------|-----------|--------|
| Desktop shell | Electron 31 | Cross-platform desktop, Chromium embedding |
| Frontend | React 18 + TypeScript | Component model, type safety |
| Bundler | electron-vite | Purpose-built for Electron, handles main/preload/renderer separately |
| State management | Zustand | Minimal boilerplate, works well with IPC async patterns |
| Database | sql.js (WASM SQLite) | No native build tools required on Windows |
| Browser automation | puppeteer-core | CDP control of Chromium profiles |
| Icons | lucide-react | Tree-shakeable, consistent stroke style |

---

## Process Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Electron Main Process (Node.js)                                 │
│                                                                  │
│  ┌──────────┐  ┌─────────────┐  ┌────────────┐  ┌──────────┐  │
│  │ Database │  │BrowserManager│  │AutomationEng│  │ApiServer │  │
│  │ sql.js   │  │puppeteer-core│  │17 actions  │  │REST :9222│  │
│  └──────────┘  └─────────────┘  └────────────┘  └──────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ IPC Handlers (ipc/handlers.ts) — 80+ channels             │ │
│  └────────────────────────────────────────────────────────────┘ │
│                          ↕ contextBridge                         │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Preload (preload/index.ts) — window.api.*                 │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                          ↕ IPC
┌─────────────────────────────────────────────────────────────────┐
│  Renderer Process (React + Vite dev server)                      │
│                                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │
│  │profileStr│ │proxyStore│ │authStore │ │licenseStore      │  │
│  │Zustand   │ │Zustand   │ │Zustand   │ │teamStore/syncStr │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘  │
│                                                                  │
│  ProfileManager · ProxyManager · FingerprintEditor              │
│  DetectionDashboard · AutomationBuilder · TeamManager           │
│  AccountPage · SettingsPage · PatchManager                      │
└─────────────────────────────────────────────────────────────────┘
                          ↕ CDP (WebSocket)
┌─────────────────────────────────────────────────────────────────┐
│  Profile Browser Processes (Chromium via puppeteer-core)         │
│  Each profile = isolated userDataDir + fingerprint injection     │
└─────────────────────────────────────────────────────────────────┘
```

---

## IPC Pattern

All renderer↔main communication goes through IPC. Adding a new feature requires updating **three** files:

```
Main:    ipcMain.handle('ns:action', handler)      src/main/ipc/handlers.ts
Preload: window.api.ns.action = () => ipcRenderer.invoke('ns:action')
                                                    src/preload/index.ts
Renderer: window.api.ns.action()                   component files
```

TypeScript types for the exposed API are inferred from `export type API = typeof api` in `preload/index.ts`.

---

## Database (sql.js)

- **Singleton**: `Database.getInstance()` — one instance for the lifetime of the app
- **Async init**: `db.initialize()` must be `await`ed before IPC handlers register (WASM load)
- **Synchronous queries**: all `run()`, `exec()`, `get()` methods are sync after init
- **Auto-save**: every `run()` call triggers `this.save()` to persist WAL → file
- **Positional params**: sql.js uses `?` placeholders, not named params

### Tables

```sql
profiles          -- core profile data + fingerprint JSON
proxies           -- proxy configs + health metrics
profile_groups    -- group metadata (name, color)
profile_versions  -- fingerprint snapshots (max 20 per profile)
workflows         -- automation workflow definitions
workflow_runs     -- automation execution history
detection_tests   -- detection test results + vector details
sync_log          -- cloud sync history
audit_log         -- team action audit trail
```

---

## Fingerprint Injection Pipeline

```
launchProfile()
    │
    ├─ Layer 2: CdpEvasion.apply(page)          ← FIRST (before page JS)
    │     evaluateOnNewDocument(evasionScript)
    │     CDP: Page.setBypassCSP
    │         Runtime.setMaxCallStackSizeToCapture(0)
    │         Runtime.setCustomObjectFormatterEnabled(false)
    │
    ├─ Layer 1+3+4: page.evaluateOnNewDocument(combined)
    │     navigator, plugins, canvas, webgl, audio, fonts, webrtc
    │     clientrects, speech, permissions, storage, network, performance
    │     behavior? (Phase 6), timing? (Phase 6)
    │     intl, webgpu, useragentdata (Phase 8)
    │
    └─ CDP session: Emulation.*
          setUserAgentOverride (UA + platform + UACH metadata)
          setTimezoneOverride
          setGeolocationOverride (disabled)
```

**Noise determinism**: all seeds derived from `djb2(profileId)`. Same profile UUID → same `noiseSeed` → identical fingerprint across sessions.

---

## File Map

```
src/
├── main/
│   ├── index.ts                  App entry, window creation, DB init, stderr filter
│   ├── database.ts               sql.js singleton
│   ├── browser-manager.ts        Chromium profile launcher (puppeteer-core)
│   ├── api-client.ts             HTTP client (token auth, refresh, retry)
│   ├── auth.ts                   Login, register, logout, token management
│   ├── license.ts                License validation, machine fingerprint, plan limits
│   ├── team.ts                   Team CRUD, members, invites, shared profiles, audit
│   ├── sync.ts                   Cloud sync — AES-256-GCM E2E encryption
│   ├── automation.ts             AutomationEngine — 17 action types
│   ├── api-server.ts             Local REST API server (Express, port 9222)
│   ├── workflow-templates.ts     6 built-in workflow templates
│   ├── detection-test.ts         Detection test runner — 45 vectors
│   ├── auto-updater.ts           electron-updater integration
│   ├── settings.ts               App settings read/write (JSON file)
│   ├── fingerprint/
│   │   ├── injector.ts           Orchestrates all injection layers
│   │   ├── cdp-evasion.ts        14 CDP evasion methods (Layers 2 + 6 + 8)
│   │   ├── presets.ts            11 built-in presets + resolveFingerprint()
│   │   ├── chromium-patches.ts   30-patch catalog (Phase 8)
│   │   └── scripts/
│   │       ├── navigator.ts      UA, platform, hardware, screen, battery, media
│   │       ├── canvas.ts         Canvas noise
│   │       ├── webgl.ts          WebGL vendor/renderer + noise
│   │       ├── audio.ts          AudioContext noise
│   │       ├── fonts.ts          Font whitelist + measureText noise
│   │       ├── plugins.ts        Plugin list spoofing
│   │       ├── webrtc.ts         WebRTC IP leak prevention
│   │       ├── clientrects.ts    ClientRects noise
│   │       ├── speech.ts         Speech synthesis filtering
│   │       ├── permissions.ts    Permissions API spoofing
│   │       ├── storage.ts        Storage quota mock
│   │       ├── network.ts        Network Information API
│   │       ├── performance.ts    Performance timing sanitization
│   │       ├── behavior.ts       Mouse/keyboard/scroll simulation (Phase 6)
│   │       ├── timing.ts         Date/performance.now quantization (Phase 6)
│   │       ├── intl.ts           Intl locale normalization (Phase 8)
│   │       ├── webgpu.ts         WebGPU adapter spoofing (Phase 8)
│   │       └── useragentdata.ts  UACH high-entropy values (Phase 8)
│   └── ipc/handlers.ts           All ipcMain.handle() registrations
├── preload/index.ts              contextBridge — window.api.*
├── shared/types.ts               Shared TypeScript interfaces
└── renderer/src/
    ├── App.tsx                   Root: Sidebar + section router
    ├── components/
    │   ├── Layout/               Sidebar, Header
    │   ├── ProfileManager/       List, card, create/edit modal, cookie modal, history
    │   ├── ProxyManager/         Add/test/delete proxies
    │   ├── FingerprintEditor/    34-vector protection dashboard + behavior/timing config
    │   ├── DetectionDashboard/   Detection test runner + score + batch + history
    │   ├── AutomationBuilder/    Workflow CRUD + step editor + template picker
    │   ├── TeamManager/          Team, members, invites, audit log
    │   ├── Account/              Auth, license, cloud sync
    │   ├── Settings/             App settings + API server config
    │   └── PatchManager/         Chromium patch catalog UI (Phase 8)
    ├── stores/
    │   ├── profileStore.ts
    │   ├── proxyStore.ts
    │   ├── authStore.ts
    │   ├── licenseStore.ts
    │   ├── teamStore.ts
    │   └── syncStore.ts
    └── types/index.ts            Re-exports from shared/types + NavSection
```
