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

---

## Development Workflow

### Adding a New Feature

1. **Define the data model** in `src/shared/types.ts` (TS interface + DB schema if needed)
2. **Add DB table** via migration in `src/main/database.ts` (if required)
3. **Implement main-process logic** in `src/main/` (service module or existing handler)
4. **Register IPC handler** in `src/main/ipc/handlers.ts`:
   ```typescript
   ipcMain.handle('myFeature:action', async (event, arg) => {
     return await myFeatureService.doAction(arg)
   })
   ```
5. **Expose via preload** in `src/preload/index.ts`:
   ```typescript
   myFeature: {
     action: (arg: MyInput) => ipcInvoke('myFeature:action', arg)
   }
   ```
6. **Type the API** in `src/renderer/src/env.d.ts`
7. **Create Zustand store** in `src/renderer/src/stores/myFeatureStore.ts`
8. **Build UI components** in `src/renderer/src/components/MyFeature/`
9. **Wire into App.tsx** sidebar + router
10. **Test** via `npm run dev` + manual testing in Electron window

### Testing Fingerprints

To verify fingerprint injection is working:

```typescript
// In renderer console (F12):
console.log(navigator.userAgent)
console.log(navigator.hardwareConcurrency)
console.log(canvas fingerprint test)

// Or use detection test: Profiles → select → Detection Test button
```

### Debugging IPC

**Enable IPC logging**:
```typescript
// src/main/ipc/handlers.ts
ipcMain.handle('channel:action', async (event, arg) => {
  console.log(`[IPC] channel:action called with`, arg)
  try {
    const result = await service.doAction(arg)
    console.log(`[IPC] channel:action returned`, result)
    return result
  } catch (e) {
    console.error(`[IPC] channel:action errored`, e)
    throw e
  }
})
```

**Watch store updates**:
```typescript
// In React component
useEffect(() => {
  const unsubscribe = useProfileStore.subscribe(
    (state) => state.profiles,
    (profiles) => console.log('Profiles updated:', profiles)
  )
  return unsubscribe
}, [])
```

### Database Migrations

To add a new table or column:

```typescript
// src/main/database.ts - in initialize()
const migrations = [
  `CREATE TABLE IF NOT EXISTS new_table (...)`,
  `ALTER TABLE existing_table ADD COLUMN new_col TEXT`
]

for (const sql of migrations) {
  try {
    this.exec(sql)
  } catch (e) {
    if (!e.message.includes('already exists')) throw e
  }
}
```

### Performance Optimization Tips

1. **Pagination**: Always paginate profile lists (limit 50 default)
2. **Lazy loading**: Don't load fingerprint JSON until needed
3. **Zustand selectors**: Use `useProfileStore(s => s.profiles.length)` not whole state
4. **Worker threads** (if CPU-intensive): Use Node.js `worker_threads` for scrypt/hashing
5. **Profile pooling**: Cache launched profiles in `browser-manager.ts` to avoid restart overhead

---

## Architecture Patterns

### The IPC Pattern (Renderer → Main → Renderer)

```
┌─────────────┐
│  Renderer   │
│  (React UI) │
└──────┬──────┘
       │ window.api.profiles.list()
       │ (returns Promise)
       ↓
┌─────────────────────────────┐
│  Preload (contextBridge)    │
│  ipcRenderer.invoke()       │
└──────┬──────────────────────┘
       │
       ↓
┌─────────────────────────────┐
│  Main Process IPC Handler   │
│  ipcMain.handle()           │
│  → Service logic            │
│  → DB query                 │
│  → return result            │
└──────┬──────────────────────┘
       │
       ↓ Promise resolves
┌─────────────┐
│  Renderer   │
│  Update UI  │
└─────────────┘
```

### State Management (Zustand)

```typescript
// Bad: Prop drilling
<ProfileManager profiles={profiles} onSelect={onSelect} />
  <ProfileCard profile={profile} onSelect={onSelect} />
    <ProfileActions onSelect={onSelect} />

// Good: Global store
// stores/profileStore.ts
export const useProfileStore = create(s => ({
  profiles: [],
  selectedId: null,
  selectProfile: (id) => s.selectedId = id,
  loadProfiles: async () => {
    const profiles = await window.api.profiles.list()
    set({ profiles })
  }
}))

// In any component:
const { profiles, selectedId, selectProfile } = useProfileStore()
```

### Error Handling

**In IPC handler** (main process):
```typescript
ipcMain.handle('profile:launch', async (event, id) => {
  try {
    return await browser.launchProfile(id)
  } catch (e) {
    if (e instanceof ProfileLaunchError) {
      throw new Error(`Launch failed: ${e.message}`)
    }
    throw e  // Let renderer decide how to display
  }
})
```

**In component** (renderer):
```typescript
const launchProfile = async (id: string) => {
  setLoading(true)
  setError(null)
  try {
    const { port } = await window.api.profiles.launch(id)
    setPort(port)  // Success
  } catch (e: any) {
    setError(e.message || 'Launch failed')
  } finally {
    setLoading(false)
  }
}
```

### Data Serialization

**Between main ↔ renderer**: JSON only (IPC boundary)
- Numbers, strings, booleans, null, arrays, objects: ✓
- Dates, functions, symbols, BigInt: ✗

**Solution**: Convert to/from JSON
```typescript
// Main → Renderer
const profile = db.getProfile(id)
return {
  ...profile,
  createdAt: profile.createdAt.toISOString(),  // Date → string
  fingerprint: JSON.parse(profile.fingerprint)  // TEXT → object
}

// Renderer → Main
{
  ...input,
  createdAt: new Date(input.createdAt)  // string → Date (if needed)
}
```

---

## Code Style Guide

### Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Constants | SCREAMING_SNAKE_CASE | `MAX_PROFILES = 500` |
| Functions | camelCase | `launchProfile()` |
| Classes | PascalCase | `BrowserManager` |
| Types/Interfaces | PascalCase | `Profile`, `FingerprintConfig` |
| React components | PascalCase | `<ProfileCard />` |
| Stores | camelCase + `Store` | `useProfileStore` |
| Enum keys | PascalCase | `enum Status { Active, Inactive }` |

### File Organization

```
src/main/
├── index.ts              # Entry point (app events, window creation)
├── database.ts           # SQLite wrapper
├── browser-manager.ts    # Chromium launcher
├── auth.ts               # Login/token management
├── api-client.ts         # HTTP requests to backend
├── modules/              # Feature domains
│   ├── profiles.ts
│   ├── workflows.ts
│   ├── detection.ts
│   └── ...
├── fingerprint/          # Injection engine
│   ├── injector.ts
│   ├── presets.ts
│   └── scripts/          # JS override strings
├── ipc/
│   └── handlers.ts       # All ipcMain.handle() calls
└── utils/                # Helpers
    ├── crypto.ts
    ├── validators.ts
    └── ...
```

### Comments

- **Why** (not what): Code should read clearly; comments explain reasoning
- **Before complex logic**: Explain the algorithm at a high level
- **Avoid**: Obvious comments like `// increment x`
- **Use**: TODO, FIXME, HACK marks for code debt

```typescript
// BAD
x++  // increment x

// GOOD
// Reserve profile slots for pending launches to avoid over-subscription
reservedSlots += pendingCount
```

---

## Testing Strategy

### Unit Tests (Zustand stores, utilities)
```bash
npm run test:unit
```

### Integration Tests (IPC, DB)
```bash
npm run test:integration
```

### E2E Tests (Full app workflow)
```bash
npm run test:e2e
```

### Manual Testing Checklist

- [ ] Launch profile → verify Chromium starts
- [ ] Run workflow → verify steps execute in order
- [ ] Cloud sync → verify profiles encrypted
- [ ] Fingerprint injection → verify canvas noise applied
- [ ] Settings persist → restart app, verify settings remain

---

## Common Tasks

### Add a new fingerprint vector

1. Create `src/main/fingerprint/scripts/my-vector.ts`
   ```typescript
   export function buildMyVectorScript(seed: string): string {
     return `
       // My vector implementation
       Object.defineProperty(navigator, 'myProperty', {
         get: () => 'spoofed-value'
       })
     `
   }
   ```

2. Update `src/main/fingerprint/injector.ts`
   ```typescript
   import { buildMyVectorScript } from './scripts/my-vector'
   
   scripts.push(buildMyVectorScript(seed))
   ```

3. Update `src/shared/types.ts`
   ```typescript
   interface FingerprintConfig {
     // ... existing
     myVectorConfig?: { enabled: boolean }
   }
   ```

### Add a new automation action

1. Define type in `src/shared/types.ts`
   ```typescript
   type AutomationAction = 
     | { type: 'navigate'; url: string }
     | { type: 'myNewAction'; myParam: string }
   ```

2. Implement in `src/main/automation.ts`
   ```typescript
   case 'myNewAction':
     return await executeMyNewAction(step, page, variables)
   ```

3. Update UI: `src/renderer/src/components/Automation/ActionEditor.tsx`

---

## Debugging Tips

### Enable verbose logging

```bash
LOG_LEVEL=debug npm run dev
```

### Inspect IPC traffic

In main process:
```typescript
ipcMain.on('message', (event, msg) => console.log('[IPC]', msg))
```

### Chrome DevTools for profiles

When profile launches on port `XXXX`:
```
chrome://inspect/#devices
→ Add port localhost:XXXX
→ Click "inspect" to open DevTools for running profile
```

### Profile database manually

Open `userData/db.sqlite` with SQLite browser:
```bash
sqlite3 ~/.config/ghostbrowser/db.sqlite
> .mode column
> SELECT * FROM profiles LIMIT 5;
```
