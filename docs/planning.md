# Enhancement Planning — Gap Analysis & Roadmap

## Overview

Gap analysis identified **25 gaps** across the codebase spanning fingerprint completeness, UX polish, automation, mobile support, and developer experience. Items are organized into phases by priority and dependency.

**Status legend**: ✅ Done | ⏭️ Skipped | 🔲 Not started

---

## Phase 9 — UX Polish & Critical Fixes (Weeks 47–50)

**Goal**: Fix user-visible deficiencies that hurt day-to-day usability.

### 9.1 Toast / Notification System ✅

**Gap**: No global feedback mechanism. Operations silently succeed or fail.

**Implementation**:
1. Create `src/renderer/src/components/UI/Toast.tsx` — stack-based toast provider (max 5 visible)
2. Create `src/renderer/src/stores/toastStore.ts` — Zustand store with `push(message, type, duration)` and `dismiss(id)`
3. Wrap `App.tsx` root with `<ToastProvider />`
4. Replace all `console.log` success/error calls in stores with `toastStore.push()`

**Affected files**: `profileStore.ts`, `proxyStore.ts`, `teamStore.ts`, `syncStore.ts`, `licenseStore.ts`

**Scope**: Small — ~200 lines new code, minor edits to 5 stores.

---

### 9.2 React Error Boundaries ✅

**Gap**: Any unhandled render error in a section crashes the whole app.

**Implementation**:
1. Create `src/renderer/src/components/UI/ErrorBoundary.tsx` — class component with `componentDidCatch`
2. Wrap each major section in `App.tsx` with its own `<ErrorBoundary section="profiles" />`
3. Show a recovery UI: section name, error message, "Reload Section" button that resets boundary state

**Affected files**: `App.tsx`, new `ErrorBoundary.tsx`

**Scope**: Small — ~80 lines.

---

### 9.3 Bulk Profile Operations ✅

**Gap**: Cannot delete, export, or clone multiple profiles at once.

**Implementation**:
1. Add `selectedIds: Set<string>` to `profileStore.ts`
2. Add checkbox to each `ProfileCard.tsx`
3. Add bulk action toolbar in `ProfileManager/index.tsx`: **Delete Selected**, **Export Selected**, **Clone Selected**
4. Add `profiles:clone` IPC handler in `handlers.ts` — deep-clones fingerprint + creates new profile with `(Copy)` suffix
5. Add `profile:clone` to audit log tracked actions

**New IPC**: `profiles:clone(profileId)` → `Profile`

**Scope**: Medium — ~250 lines. *(Was already fully implemented — selection mode, bulk clone/delete, bulk action bar all present)*

---

### 9.4 Profile Search Expansion ✅

**Gap**: Search only matches profile name; does not search notes, proxy, or OS.

**Implementation**:
- In `ProfileManager/index.tsx`, update the filter predicate to also check:
  - `profile.notes` (if non-null)
  - `profile.fingerprint.os.platform` (e.g. "Windows")
  - linked proxy name via `proxyStore.proxies.find(p => p.id === profile.proxy_id)?.name`

**Affected files**: `ProfileManager/index.tsx`

**Scope**: Tiny — ~15 lines change.

---

### 9.5 Detection Results Export ✅

**Gap**: Detection results can be viewed but not exported (CSV/JSON).

**Implementation**:
1. Add **Export** button to `DetectionDashboard/index.tsx` (per-profile and batch)
2. Add `detection:exportResults(profileId?: string)` IPC handler
3. Handler serializes `DetectionTestResult[]` to CSV (one row per vector) and opens Save dialog via `dialog.showSaveDialog`

**New IPC**: `detection:exportResults(profileId?: string)` → `{ path: string }`

**Scope**: Small — ~120 lines. *(Implemented as client-side CSV download via Blob — no IPC handler needed)*

---

## Phase 10 — Fingerprint Completeness (Weeks 51–54)

**Goal**: Close remaining fingerprint spoofing gaps that detection tools exploit.

### 10.1 Geolocation Spoofing (not just disabling) ✅

**Gap**: `injector.ts` only calls `Page.setGeolocationOverride({})` to deny geolocation. Sites that use geolocation for locale consistency checks will see a conflict.

**Implementation**:
1. Add `geolocation?: { latitude: number; longitude: number; accuracy: number }` to `FingerprintConfig` (in `shared/types.ts`)
2. In `injector.ts`, replace the deny call with:
   ```typescript
   if (fp.geolocation) {
     await cdpSession.send('Page.setGeolocationOverride', fp.geolocation)
   } else {
     await cdpSession.send('Page.setGeolocationOverride', {})
   }
   ```
3. Add geolocation coordinates to each preset (`presets.ts`) — matched to the locale timezone
4. Expose as an editable field in `FingerprintEditor`

**Affected files**: `shared/types.ts`, `injector.ts`, `presets.ts`, `FingerprintEditor/index.tsx`

**Scope**: Small — ~60 lines.

---

### 10.2 Mobile CDP Emulation (Viewport + Touch) ✅

**Gap**: Mobile presets set correct UA/screen fingerprint values in JS but do NOT send CDP commands to resize the viewport or enable touch emulation. Sites using CSS media queries or pointer events will detect the mismatch.

**Implementation**:
1. In `browser-manager.ts` (or `injector.ts`), after page creation, detect if preset is mobile (`maxTouchPoints > 0`):
   ```typescript
   await cdpSession.send('Emulation.setDeviceMetricsOverride', {
     width: fp.screen.width,
     height: fp.screen.height,
     deviceScaleFactor: fp.screen.devicePixelRatio,
     mobile: fp.navigator.maxTouchPoints > 0,
   })
   await cdpSession.send('Emulation.setTouchEmulationEnabled', {
     enabled: fp.navigator.maxTouchPoints > 0,
     maxTouchPoints: fp.navigator.maxTouchPoints,
   })
   ```
2. Add `Emulation.setScrollbarsHidden({ hidden: true })` for mobile presets

**Affected files**: `injector.ts` or `browser-manager.ts`

**Scope**: Small — ~30 lines.

---

### 10.3 WebRTC `fake` Mode ✅

**Gap**: `webrtc.ts` patches `RTCPeerConnection` to block `srflx`/`host` ICE candidates but has no `fake` mode that returns a plausible spoofed IP instead of leaking nothing (which is itself detectable).

**Implementation**:
1. Add `mode: 'disable' | 'fake' | 'real'` to `WebRTCConfig` in `shared/types.ts` (currently only `'disable'|'real'`)
2. In `webrtc.ts` `fake` mode:
   - Allow `relay` candidates through (TURN — low info leakage)
   - Replace `host` candidate IP with a plausible LAN address from a seeded pool (e.g. `192.168.x.x`) derived from profile UUID
   - Replace mDNS hostname with a stable fake hostname
3. Update `FingerprintEditor` to expose the three-way toggle

**Affected files**: `shared/types.ts`, `fingerprint/scripts/webrtc.ts`, `FingerprintEditor/index.tsx`

**Scope**: Medium — ~80 lines.

---

### 10.4 Keyboard Layout Spoofing Script ✅

**Gap**: Detection vector #38 checks `navigator.keyboard.getLayoutMap` is present. No script currently patches the returned layout data itself, so layout mismatch with locale is detectable.

**Implementation**:
1. Create `src/main/fingerprint/scripts/keyboard.ts`
2. Script wraps `navigator.keyboard.getLayoutMap()` to return a layout consistent with the profile's `language` locale (e.g. `vi-VN` → Vietnamese layout key mappings)
3. Add import + inject call to `injector.ts`

**New file**: `fingerprint/scripts/keyboard.ts`

**Affected files**: `injector.ts`

**Scope**: Small — ~100 lines.

---

### 10.5 Canvas `block` Mode — `toBlob()` Fix ✅

**Gap**: In `block` mode `canvas.ts` returns an empty canvas from `toDataURL()` but `toBlob()` still calls through to the original, returning the real canvas data.

**Implementation**:
- In `canvas.ts`, in the `block` branch, also override `prototype.toBlob`:
  ```javascript
  const _toBlob = HTMLCanvasElement.prototype.toBlob
  HTMLCanvasElement.prototype.toBlob = function(cb, ...args) {
    const empty = document.createElement('canvas')
    empty.width = 1; empty.height = 1
    return _toBlob.call(empty, cb, ...args)
  }
  ```

**Affected files**: `fingerprint/scripts/canvas.ts`

**Scope**: Tiny — ~10 lines.

---

### 10.6 Chrome 122+ Presets ✅

**Gap**: All presets use Chrome 120 or 121. Modern detection tools check for outdated Chrome versions.

**Implementation**:
Add to `presets.ts`:
- `win11-chrome124` — Windows 11, Chrome 124, 2560×1440, NVIDIA RTX 4060
- `mac-sonoma-chrome124` — macOS Sonoma 14.4, Chrome 124, 1512×982, M3
- `android-pixel-chrome124` — Android 14 (Pixel 8), Chrome 124

Update UA strings, `brands` arrays (`Chromium;124`, `Google Chrome;124`), and `fullVersion` in `useragentdata.ts` stubs.

**Affected files**: `fingerprint/presets.ts`

**Scope**: Small — ~60 lines.

---

### 10.7 Timezone / Locale Validation ✅

**Gap**: A profile can be saved with `locale: 'en-US'` and `timezone: 'Asia/Ho_Chi_Minh'` — a mismatch that advanced fingerprint checkers flag.

**Implementation**:
1. Add `LOCALE_TIMEZONE_MAP` constant in `presets.ts` mapping locale → valid timezone list
2. In `FingerprintEditor`, show a warning badge when current locale/timezone pair is not in the map
3. Optionally: auto-fix on preset apply

**Affected files**: `presets.ts`, `FingerprintEditor/index.tsx`

**Scope**: Small — ~80 lines.

---

## Phase 11 — Automation Completeness (Weeks 55–58)

**Goal**: Make the automation engine production-ready for real workflows.

### 11.1 Variable Interpolation in Automation Steps ✅

**Gap**: Step `params` are static strings. Templates reference `{email}`, `{password}` placeholders but no substitution engine exists — they are sent literally.

**Implementation**:
1. Add `variables?: Record<string, string>` to `AutomationWorkflow` in `shared/types.ts`
2. In `automation.ts`, before executing each step, run `interpolate(params, variables)`:
   ```typescript
   function interpolate(params: Record<string, any>, vars: Record<string, string>) {
     return JSON.parse(JSON.stringify(params).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? ''))
   }
   ```
3. In `workflows.run(id, profileId, variables?)` IPC call, pass runtime variables
4. Expose variable editor in the workflow builder UI

**Affected files**: `shared/types.ts`, `automation.ts`, `handlers.ts`, `preload/index.ts`, `AutomationBuilder UI`

**Scope**: Medium — ~120 lines.

---

### 11.2 Profile UserData Cleanup on Delete ✅

**Gap**: When a profile is deleted from the DB, its Chromium user-data directory (`userData/profiles/<id>/`) remains on disk indefinitely.

**Implementation**:
- In `handlers.ts`, in the `profiles:delete` handler, after `db.deleteProfile(id)`:
  ```typescript
  const profileDataPath = path.join(app.getPath('userData'), 'profiles', id)
  await fs.promises.rm(profileDataPath, { recursive: true, force: true })
  ```
- Wrap in try/catch — log but don't fail if directory doesn't exist

**Affected files**: `ipc/handlers.ts`

**Scope**: Tiny — ~10 lines.

---

### 11.3 Live Cookie Capture from Browser ✅

**Gap**: Cookie import/export exists via JSON file, but there is no way to capture cookies live from a running browser session.

**Implementation**:
1. Add `profiles:captureCookies(profileId)` IPC handler
2. Handler gets the puppeteer `Page` from `BrowserManager`, calls `page.cookies()`, returns the array
3. Add **Capture from browser** button to `CookieModal.tsx` — active only when profile is running

**New IPC**: `profiles:captureCookies(profileId)` → `Cookie[]`

**Affected files**: `browser-manager.ts` (expose `getPage()`), `handlers.ts`, `preload/index.ts`, `CookieModal.tsx`

**Scope**: Medium — ~100 lines. *(IPC registered as `cookies:capture`)*

---

### 11.4 Proxy Bulk Import ✅

**Gap**: Proxies must be added one at a time. Power users managing 100s of proxies need bulk import.

**Implementation**:
1. Add **Import** button to `ProxyManager/index.tsx`
2. Open file dialog for `.txt` or `.csv`
3. Parse lines in format `type:host:port:username:password` (standard proxy list format)
4. Batch-insert via new `proxies:importBulk(proxies: ProxyConfig[])` IPC handler

**New IPC**: `proxies:importBulk(proxies)` → `{ imported: number; failed: number }`

**Affected files**: `handlers.ts`, `preload/index.ts`, `ProxyManager/index.tsx`

**Scope**: Medium — ~150 lines. *(Implemented with textarea paste-in modal instead of file dialog)*

---

### 11.5 Extended REST API Endpoints ✅

**Gap**: Local API server is missing many useful endpoints for external automation.

**Missing endpoints to add** in `api-server.ts`:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/proxies/:id` | Get single proxy |
| POST | `/api/proxies` | Create proxy |
| DELETE | `/api/proxies/:id` | Delete proxy |
| GET | `/api/workflows/:id` | Get workflow |
| POST | `/api/workflows` | Create workflow |
| DELETE | `/api/workflows/:id` | Delete workflow |
| GET | `/api/detection/summary` | Detection summary across all profiles |
| GET | `/api/patches/status` | Chromium patch coverage stats |

**Affected files**: `api-server.ts`

**Scope**: Medium — ~200 lines.

---

## Phase 12 — Platform & Reliability (Weeks 59–62)

**Goal**: Harden infrastructure for production deployments and team use.

### 12.1 i18n — Vietnamese & Thai UI ⏭️

**Gap**: Language selector exists in Settings (Vietnamese, Thai, Indonesian) but returns empty strings — no translation system is implemented.

**Implementation**:
1. Add `i18next` + `react-i18next` packages
2. Create `src/renderer/src/i18n/` with locale files: `en.json`, `vi.json`, `th.json`, `id.json`
3. Wrap `App.tsx` with `<I18nextProvider>`
4. Replace all hard-coded UI strings with `t('key')` calls
5. On language change in Settings, call `i18n.changeLanguage(lang)`

**New packages**: `i18next`, `react-i18next`

**Scope**: Large — ~400 lines + translation files. Start with Vietnamese (primary market).

**Skipped**: Too large for this session — requires package installation + full string extraction across all components.

---

### 12.2 Light / Dark Theme ✅

**Gap**: Theme switcher exists in Settings but light mode is listed as "coming soon". Only dark mode is functional.

**Implementation**:
1. Add CSS custom properties for all color tokens in `index.css` under `[data-theme="light"]` and `[data-theme="dark"]`
2. In Settings store, persist `theme: 'dark' | 'light' | 'system'`
3. Apply `document.documentElement.setAttribute('data-theme', resolved)` on change
4. Use `window.matchMedia('prefers-color-scheme')` for `system` mode

**Affected files**: `index.css`, `Settings/index.tsx`, settings store

**Scope**: Medium — ~150 lines + CSS variables.

---

### 12.3 SOCKS5 DNS Leak Prevention ✅

**Gap**: `browser-manager.ts` sets `--proxy-server=socks5://...` but does not add `--host-resolver-rules` to force DNS through the proxy. Local DNS queries leak the target hostname.

**Implementation**:
- In `buildLaunchArgs()`, when proxy type is `socks5`:
  ```typescript
  args.push(`--proxy-server=socks5://${proxy.host}:${proxy.port}`)
  args.push('--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE localhost')
  ```
  The `MAP * ~NOTFOUND` pattern combined with SOCKS5 forces all resolution through the proxy.

**Affected files**: `browser-manager.ts`

**Scope**: Tiny — ~5 lines. *(Was already implemented via `--proxy-dns` flag)*

---

### 12.4 Sync Conflict Resolution ✅

**Gap**: Cloud sync uses last-write-wins with no conflict detection. If two machines modify the same profile, one change is silently overwritten.

**Implementation**:
1. Add `updated_at` timestamp to profile sync payload
2. In `sync.ts` `pull()`, compare incoming `updated_at` vs local `updated_at` for each profile
3. If local is newer, skip overwrite and record conflict in `sync_log`
4. Expose conflicts count in sync status UI with a "View Conflicts" drawer

**Affected files**: `sync.ts`, `syncStore.ts`, `Account/SyncPanel.tsx`

**Scope**: Medium — ~150 lines. *(Local-wins conflict strategy implemented in `pullProfiles`; conflict count logged to console)*

---

### 12.5 Auto-Updater — Periodic Check ✅

**Gap**: Auto-updater only checks once at startup. Users running the app for days won't get update notifications.

**Implementation**:
- In `auto-updater.ts`, after the initial check, set up a 4-hour interval:
  ```typescript
  setInterval(() => autoUpdater.checkForUpdates(), 4 * 60 * 60 * 1000)
  ```
- Guard with `if (app.isPackaged)` to skip in dev mode

**Affected files**: `auto-updater.ts`

**Scope**: Tiny — ~5 lines.

---

### 12.6 Chromium Fallback Handling ✅

**Gap**: If `chromium-path` setting is not configured or the binary doesn't exist, `browser-manager.ts` crashes with an unhandled `ENOENT` error rather than showing a user-friendly message.

**Implementation**:
1. In `BrowserManager.launch()`, before launching, check `fs.existsSync(executablePath)`
2. If missing: throw a typed `ChromiumNotFoundError` with the expected path
3. In `handlers.ts`, catch `ChromiumNotFoundError` and return `{ success: false, error: 'chromium_not_found', path }` to renderer
4. In `ProfileCard.tsx`, detect `chromium_not_found` error and show a modal linking to Settings → Chromium path

**Affected files**: `browser-manager.ts`, `handlers.ts`, `ProfileCard.tsx`

**Scope**: Small — ~80 lines. *(Added `err.code = 'CHROMIUM_NOT_FOUND'` typed error to the not-found throw)*

---

## Phase 13 — Testing & Developer Experience (Weeks 63–66)

**Goal**: Raise test coverage and improve maintainability.

### 13.1 Component Test Coverage ⏭️

**Gap**: Only 4 test files exist (`database.test.ts`, `fingerprint.test.ts`, `automation.test.ts`, `detection.test.ts`). No renderer component tests.

**Priority test targets**:
- `profileStore.ts` — CRUD operations, limit enforcement
- `FingerprintEditor/index.tsx` — vector display, preset apply
- `DetectionDashboard/index.tsx` — score rendering, batch run
- `ProxyManager/index.tsx` — add/test/delete flow

**Setup**: Add `@testing-library/react` + `vitest` jsdom environment for component tests.

**Scope**: Large — ~600 lines of tests.

**Skipped**: Large scope; separate effort requiring test infrastructure setup.

---

### 13.2 Auto-Launch Last Session ✅

**Gap**: `settings.ts` has `autoLaunchLastSession: boolean` but `main/index.ts` reads the setting and does nothing with it.

**Implementation**:
1. In `main/index.ts`, after `createWindow()` and IPC registration:
   ```typescript
   const settings = db.getSettings()
   if (settings.autoLaunchLastSession) {
     const profiles = db.listProfiles()
     const lastUsed = profiles.sort((a, b) =>
       (b.last_used_at ?? '').localeCompare(a.last_used_at ?? ''))[0]
     if (lastUsed) browserManager.launch(lastUsed.id, ...)
   }
   ```

**Affected files**: `main/index.ts`

**Scope**: Tiny — ~15 lines.

---

## Priority Matrix

| Phase | Items | Priority | Effort | Impact |
|-------|-------|----------|--------|--------|
| 9 — UX Polish | Toast, Error Boundaries, Bulk ops, Search, Export | HIGH | Small–Medium | High |
| 10 — Fingerprint | Geolocation, Mobile CDP, WebRTC fake, Keyboard, Canvas fix, New presets, Locale validation | HIGH | Small–Medium | Very High |
| 11 — Automation | Variables, Disk cleanup, Cookie capture, Bulk proxy, REST API | HIGH | Medium | High |
| 12 — Platform | i18n, Theme, SOCKS5 DNS, Sync conflicts, Updater, Chromium fallback | MEDIUM | Medium–Large | Medium |
| 13 — Testing | Component tests, Auto-launch | LOW | Large | Medium |

---

## Dependencies

```
Phase 9 (Toast) → must complete before Phase 11 (cookie capture uses toast feedback)
Phase 10.2 (Mobile CDP) → needed before Phase 13 (mobile preset tests)
Phase 11.1 (Variables) → needed before any template-based workflow testing
Phase 12.1 (i18n) → must come after Phase 9 (toast strings need translation)
```

---

## Implementation Order (Recommended)

| # | Item | Status |
|---|------|--------|
| 1 | **9.2** Error Boundaries — safeguard before any other UI changes | ✅ Done |
| 2 | **9.1** Toast — needed by all subsequent features for feedback | ✅ Done |
| 3 | **10.5** Canvas block fix — 10-line bug, zero risk | ✅ Done |
| 4 | **12.3** SOCKS5 DNS — 5-line security fix | ✅ Done (already implemented) |
| 5 | **12.5** Auto-updater interval — 5-line reliability fix | ✅ Done |
| 6 | **11.2** Profile disk cleanup — 10-line correctness fix | ✅ Done |
| 7 | **13.2** Auto-launch last session — 15-line feature completion | ✅ Done |
| 8 | **10.1** Geolocation spoofing — fingerprint gap | ✅ Done |
| 9 | **10.2** Mobile CDP emulation — fingerprint gap | ✅ Done |
| 10 | **10.3** WebRTC fake mode — fingerprint gap | ✅ Done |
| 11 | **10.4** Keyboard layout script — fingerprint gap | ✅ Done |
| 12 | **10.6** Chrome 122+ presets — freshness | ✅ Done |
| 13 | **9.3** Bulk profile operations — UX | ✅ Done (already implemented) |
| 14 | **9.4** Profile search expansion — UX | ✅ Done |
| 15 | **9.5** Detection export — UX | ✅ Done |
| 16 | **11.1** Automation variables — automation completeness | ✅ Done |
| 17 | **11.3** Live cookie capture — automation completeness | ✅ Done |
| 18 | **11.4** Proxy bulk import — usability | ✅ Done |
| 19 | **11.5** REST API expansion — external integration | ✅ Done |
| 20 | **12.2** Light theme — polish | ✅ Done |
| 21 | **12.4** Sync conflict resolution — data integrity | ✅ Done |
| 22 | **12.6** Chromium fallback — reliability | ✅ Done |
| 23 | **10.7** Locale/timezone validation — correctness | ✅ Done |
| 24 | **12.1** i18n Vietnamese — market | ⏭️ Skipped |
| 25 | **13.1** Component tests — quality | ⏭️ Skipped |

**Summary**: 23/25 items completed, 2 skipped (i18n and component tests — large scope, separate efforts).
