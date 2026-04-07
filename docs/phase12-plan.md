# Phase 12 Plan — Network-layer hardening + product polish

> **Status legend**: ✅ Done · 🟡 In progress · ⏳ Pending

## Why Phase 12?

After Phases 1–11 the JS-injection fingerprint surface is broadly covered (45+ vectors,
worker/iframe propagation, native-toString hardening, behavior simulation, drift, warm-up).

The remaining detection gaps live **below** the JS layer:

- **TLS ClientHello / JA3** — fixed by the Chromium binary, ignored by all our injection
- **HTTP/2 frame ordering / SETTINGS** — Akamai-style network signature
- **UA ↔ binary version drift** — spoofed `userAgent: Chrome/121` over a real `Chrome/132`
  ClientHello is an instant tell for any server-side fingerprint check

Phase 12 closes these gaps in cost order, then layers product-value features on top.

---

## Track A — Network-layer hardening

### 12.A.1 — Chromium binary version detection ✅

**Goal**: Always know the actual major version of the Chromium binary we're launching, so
we can warn users and (optionally) auto-sync the spoofed UA to it.

**Why first**: 100% local, no new dependencies, unblocks every other A-track item.
A correct UA-to-binary alignment is the cheapest way to make TLS/JA3 plausible without
implementing a TLS rewriting proxy.

**Implementation**:
1. `BrowserManager.detectBinaryVersion()` — one-time async detection
   - Launch puppeteer headless once at app start, read `browser.version()`,
     parse `Chrome/<major>.x.x.x`, close, cache result
   - Result shape: `{ path, fullVersion, major }`
2. IPC handler `system:chromiumVersion` returning the cached result
3. Settings UI section "Chromium binary" showing path + detected version
4. Settings toggle: **Auto-sync profile UA to binary version on launch**
   - Default: ON (it's strictly more correct than the alternative)
5. In `launchProfile()`, if the setting is on and the spoofed Chrome major differs from
   the binary major, rewrite the in-memory `fp.browser.version` and `fp.browser.userAgent`
   *before* passing to the injector. The DB profile is **not** mutated — this is a
   per-launch transformation so users can still pin a specific UA if they disable the toggle.

**Files**:
- [src/main/browser-manager.ts](src/main/browser-manager.ts) — add `detectBinaryVersion()`, cache, version-sync helper
- [src/main/ipc/handlers.ts](src/main/ipc/handlers.ts) — add `system:chromiumVersion` handler
- [src/preload/index.ts](src/preload/index.ts) — expose `window.api.system.chromiumVersion`
- [src/main/settings.ts](src/main/settings.ts) — add `autoSyncBinaryUA` setting
- [src/renderer/src/components/Settings/index.tsx](src/renderer/src/components/Settings/index.tsx) — surface the toggle + binary info

**Effort**: S · **Impact**: High · **Risk**: Low

---

### 12.A.2 — HTTP/2 fingerprint detection vectors ✅

**Goal**: Surface UA / network identity misalignments that an HTTP/2 + TLS server-side
fingerprint check would catch, without standing up a TLS proxy yet.

**Why second**: Read-only — no behavior change, just visibility. Once users can see
the mismatch, we know whether 12.A.3 (full TLS rewriter) is actually needed for them.

**Implemented** (5 new vectors in `Network` category, brings total from 45 → 50):
1. **UA ↔ binary version alignment** — compares the spoofed `Chrome/<n>` major against
   the real `BrowserManager.getCachedBinaryInfo().major` (from 12.A.1). The single most
   important local check, since a 121/132 mismatch is exactly what TLS/JA3 reveals
   server-side. Skips iOS / Safari profiles (no `Chrome/` token).
2. **UA ↔ UACH brands alignment** — page-evaluates `navigator.userAgentData.brands`,
   filters out greasy `Not.A.Brand` entries, and verifies the real brand major matches
   `navigator.userAgent`'s `Chrome/<n>`. Catches profiles where the UACH brands array
   wasn't bumped along with the UA string.
3. **UA-CH platform alignment** — verifies `navigator.userAgentData.platform`
   (`"Windows"|"macOS"|"Linux"|"Android"|"iOS"`) matches the family derived from
   `navigator.platform` (`Win32`/`MacIntel`/`Linux`/etc.).
4. **UA-CH mobile ↔ touch alignment** — cross-checks `userAgentData.mobile` against
   `navigator.maxTouchPoints` and the UA's mobile token. A desktop UA with non-zero
   touch points (or vice-versa) is a classic spoof leak.
5. **Accept-Language alignment** — verifies `navigator.languages[0]` base, `navigator.language`
   base, and `Intl.DateTimeFormat().resolvedOptions().locale` base all agree. Mismatches
   here would surface as a server-visible `Accept-Language` divergence from the JS-visible
   locale.

These run in the existing `about:blank` evaluation pipeline — no external network,
no new dependencies. The dashboard's `Network` category groups them automatically
because every result reports `category: 'Network'`.

**Files**:
- [src/main/detection-test.ts](src/main/detection-test.ts) — 5 new `test*` private methods + entries in `evaluateVectors()`

**Effort**: M · **Impact**: Medium (visibility only) · **Risk**: Low

---

### 12.A.3 — TLS/JA3 rewriting proxy ⏳

**Goal**: Rewrite ClientHello cipher order + extensions per profile to match the spoofed UA.

**Why last in track A**: XL effort, requires either:
- Bundling a Go binary with `utls` and routing all traffic through it, OR
- A Node.js library that exposes raw TLS handshake control (none currently exist)

**Defer until 12.A.1 + 12.A.2 are shipped and the actual user demand is measured.**

**Effort**: XL · **Impact**: Critical · **Risk**: High

---

## Track B — Automation power-user features

### 12.B.1 — Captcha solving integration ✅

Adapter pattern for 2captcha / anti-captcha / CapMonster as a workflow action.
**Effort**: M · **Impact**: Very High · **Risk**: Low

**Implemented**:
- `src/main/captcha/index.ts` — `CaptchaSolver` interface + 3 adapters (`TwoCaptchaSolver`,
  `AntiCaptchaSolver`, `CapMonsterSolver`). All three speak the createTask / getTaskResult
  REST shape (Anti-Captcha-compatible). Networking via Node `https` — no fetch dep.
- Supports reCAPTCHA v2 (incl. invisible), reCAPTCHA v3, hCaptcha, and image captchas.
- `getBalance(apiKey)` for the Settings UI's Check-balance button.
- `getSolver(id)` and `listSolvers()` registry helpers.

**Settings**:
- New `captcha: { defaultProvider, apiKeys: Record<provider, string> }` shape on `AppSettings`.
- Hardened `getSettings()` merge so partial existing settings.json files don't drop the
  default captcha block.
- New IPC: `captcha:listProviders`, `captcha:checkBalance`.

**Automation actions**:
- `solveCaptcha` — accepts `{ type, siteKey, pageUrl?, action?, minScore?, invisible?, imageBase64?, provider?, apiKey?, saveAs? }`.
  Falls back to settings.captcha.defaultProvider + stored API key. The solved token is
  written into the live workflow variables map under `saveAs` (default `captchaToken`),
  so subsequent steps can reference it via `{captchaToken}` placeholders.
- `injectCaptchaToken` — sets a hidden textarea's value (default `#g-recaptcha-response`)
  and dispatches input/change events so reCAPTCHA / hCaptcha listeners pick it up.

**Architecture change** (worth noting): the automation engine previously interpolated
all step params **upfront** in `executeWorkflow`, which meant a step couldn't reference
a variable produced by an earlier step. The interpolation is now **per-step** at execution
time, with a mutable `variables` map threaded through `executeSteps` → `executeStep` →
`runAction`. Conditional and loop branches share the same map, so captcha tokens flow
through nested steps too.

**StepEditor UI**: ShieldCheck / KeyRound icons, ACTION_META + ALL_ACTIONS entries,
default params, and ParamEditor cases for both new actions (with conditional fields per
captcha type — siteKey/pageUrl for reCAPTCHA/hCaptcha, action/minScore for reCAPTCHA v3,
imageBase64 for image-only).

**Settings UI**: New "Captcha Solvers" card with default-provider dropdown, per-provider
password input, and a "Check balance" button that reports balance in USD or the API error.

**Files**:
- New: [src/main/captcha/index.ts](src/main/captcha/index.ts)
- [src/main/settings.ts](src/main/settings.ts), [src/shared/types.ts](src/shared/types.ts)
- [src/main/automation.ts](src/main/automation.ts), [src/main/ipc/handlers.ts](src/main/ipc/handlers.ts)
- [src/preload/index.ts](src/preload/index.ts), [src/renderer/src/env.d.ts](src/renderer/src/env.d.ts)
- [src/renderer/src/components/AutomationBuilder/StepEditor.tsx](src/renderer/src/components/AutomationBuilder/StepEditor.tsx)
- [src/renderer/src/components/Settings/index.tsx](src/renderer/src/components/Settings/index.tsx)

### 12.B.2 — Visual selector recorder ✅

Click "Record", interact with the page, generate a workflow.
**Effort**: L · **Impact**: High · **Risk**: Medium

**Implemented**:
- New singleton `Recorder` in [src/main/recorder.ts](src/main/recorder.ts):
  - `start(profileId)` attaches to the live page via `BrowserManager.getActivePage`,
    seeds an initial `navigate` event for the current URL, binds future tabs through
    `targetcreated`, and installs an in-page bootstrap script that listens for click /
    input / change / submit events on document capture phase.
  - The bootstrap script generates robust selectors with this priority: `#id` →
    `[data-testid]` → `tag[name=…]` (for inputs) → `tag[aria-label=…]` → 3-deep
    parent chain with class filtering and `:nth-of-type` disambiguation. Click
    handlers walk up to the nearest `<button>`/`<a>`/`role=button` so we record
    the meaningful element instead of an inner span.
  - Events are forwarded to main via `page.exposeFunction('__ghostRecord', ...)`.
    Coalescing rules: consecutive `input` events on the same selector merge into
    one (only the final value is kept); a click immediately followed by typing
    into the same selector drops the redundant click. Password fields record
    the selector but mask the value so users can fill it in via a `{vault.x}`
    placeholder before saving.
  - `stop(profileId)` returns both the raw event stream and a generated
    `AutomationStep[]` (mapped via `eventsToSteps`).
  - `state(profileId)` is the polling endpoint for the live counter.
- 4 new IPC handlers: `recorder:start`, `recorder:stop`, `recorder:state`,
  `recorder:isRecording`.
- AutomationBuilder now has a **Record** button next to **Run** (single-profile
  mode only — disabled while a workflow is running). While recording it shows
  a live "Stop recording (N)" pulse with a step counter, polled at 1 Hz from
  `recorder:state`. On stop, the captured `AutomationStep[]` is appended to the
  current workflow and persisted via `updateWorkflow`. A red banner explains
  the workflow while recording is active.

**Files**:
- New: [src/main/recorder.ts](src/main/recorder.ts)
- [src/main/ipc/handlers.ts](src/main/ipc/handlers.ts) — recorder handlers
- [src/preload/index.ts](src/preload/index.ts), [src/renderer/src/env.d.ts](src/renderer/src/env.d.ts) — typed bridge
- [src/renderer/src/components/AutomationBuilder/index.tsx](src/renderer/src/components/AutomationBuilder/index.tsx) — Record/Stop UI + polling

### 12.B.3 — File upload / download workflow actions ✅

`upload`, `download` action types with file picker bindings.
**Effort**: S · **Impact**: Medium · **Risk**: Low

**Implemented**:
- `upload` action: targets `<input type="file">` via selector and uploads a local file
  via `ElementHandle.uploadFile`. Supports `{var}` interpolation in `filePath`.
- `download` action: streams a remote URL to a local path using Node `http`/`https`,
  reusing the active page's cookies (so authenticated downloads work). Auto-creates parent
  directories, follows up to 5 redirects, honors `timeout`.
- StepEditor UI: new icons (`Upload`, `Download`), `ALL_ACTIONS` entries, default params,
  and `ParamEditor` cases with helper text.

### 12.B.4 — Workflow variables editor ✅

Variables already exist in the schema. Add a UI for editing them per workflow + per run.
**Effort**: S · **Impact**: Medium · **Risk**: Low

---

## Track C — Profile state management

### 12.C.1 — Interactive cookie editor ✅

Table view with edit / delete (previously only import / export).
**Effort**: M · **Impact**: Medium · **Risk**: Low

**Implemented**:
- `cookies:list` IPC handler — reads the per-profile cookie blob from SQLite and returns a parsed array
- `cookies:save` IPC handler — persists the edited cookie array to the DB **and** pushes
  the change into the live Chromium session if the profile is open. Live-sync uses
  `page.deleteCookie(...existing)` followed by `page.setCookie(...new)`, wrapped in a
  try/catch so the DB remains the source of truth on next launch.
- `window.api.cookies.list` / `window.api.cookies.save` exposed in preload + env.d.ts
- `CookieModal.tsx` rewritten as a 3-tab modal (**Browse / Edit · Import · Export**):
  - **Browse tab**: search box (filters by name/domain/value), reload button,
    add-new-row button, table view (Name / Domain / Value / Flags / actions),
    edit form for selected/new row with `name`, `domain`, `value`, `path`, `expires`,
    `sameSite` (Lax/Strict/None), `httpOnly`, `secure`. Row-level delete + edit.
    "Capture from live browser" pulls fresh cookies from the active session.
    "Save changes" button is dirty-state aware and reports `✓ Saved N cookies (live session updated)`.
  - **Import** / **Export** tabs preserve the original Netscape/JSON behavior.
- `mode` prop widened from `'import' | 'export'` to `'browse' | 'import' | 'export'`;
  callers passing the legacy values still resolve to the right initial tab.

**Files**:
- [src/main/ipc/handlers.ts](src/main/ipc/handlers.ts) — new `cookies:list` + `cookies:save` handlers
- [src/preload/index.ts](src/preload/index.ts), [src/renderer/src/env.d.ts](src/renderer/src/env.d.ts)
- [src/renderer/src/components/ProfileManager/CookieModal.tsx](src/renderer/src/components/ProfileManager/CookieModal.tsx)

### 12.C.2 — LocalStorage / IndexedDB inspector per profile ✅

Read-only browser of per-profile storage.
**Effort**: M · **Impact**: Medium · **Risk**: Low

**Implemented**:
- 4 new IPC handlers in [src/main/ipc/handlers.ts](src/main/ipc/handlers.ts):
  - `storage:listOrigins(profileId)` — walks every frame in every open page of the
    live profile, collects unique `http(s)://host` security origins
  - `storage:getDOMStorage(profileId, origin, isLocalStorage)` — CDP
    `DOMStorage.getDOMStorageItems` for either localStorage or sessionStorage
  - `storage:listIndexedDb(profileId, origin)` — CDP `IndexedDB.requestDatabaseNames`
    + `requestDatabase` for each db, returns `{ name, version, stores[] }`
  - `storage:getIndexedDbEntries(profileId, origin, dbName, store, max?)` — CDP
    `IndexedDB.requestData` (page-size capped at 500), returns flattened
    `{ key, primaryKey, value }` records and a `hasMore` flag
- All four handlers fail loudly if the profile is not running ("Profile is not running
  — launch it first") since CDP requires a live target.
- New `StorageInspectorModal` component with three tabs (localStorage / sessionStorage /
  IndexedDB), an origin dropdown populated from open frames, and a re-scan button.
  - DOMStorage tab: simple two-column key/value table with break-all wrapping for long
    JSON blobs.
  - IndexedDB tab: cascading database → object-store dropdowns, then a key/value table
    of the first 100 entries with a "Showing first 100 entries" notice when truncated.
- New "Storage..." menu item on `ProfileCard` (Database icon) wired through
  `onStorage` prop into ProfileManager state (`storageProfile` slot).
- The cookie menu item was renamed "Cookies..." (was "Import Cookies") and now opens
  on the new browse tab from Slot 4.

**Files**:
- [src/main/ipc/handlers.ts](src/main/ipc/handlers.ts) — 4 new handlers under "Storage inspector"
- [src/preload/index.ts](src/preload/index.ts) — `window.api.storage.*` namespace
- [src/renderer/src/env.d.ts](src/renderer/src/env.d.ts) — types
- New: [src/renderer/src/components/ProfileManager/StorageInspectorModal.tsx](src/renderer/src/components/ProfileManager/StorageInspectorModal.tsx)
- [src/renderer/src/components/ProfileManager/ProfileCard.tsx](src/renderer/src/components/ProfileManager/ProfileCard.tsx) — `onStorage` prop + menu entry
- [src/renderer/src/components/ProfileManager/index.tsx](src/renderer/src/components/ProfileManager/index.tsx) — modal wiring

### 12.C.3 — Encrypted credential vault ✅

Per-profile account credentials encrypted with master password.
**Effort**: M · **Impact**: High · **Risk**: Medium (key management)

**Implemented**:
- `credentials` and `vault_meta` tables in `database.ts` with full CRUD
  (`getAllCredentials`, `getCredential`, `createCredential`, `updateCredential`,
  `deleteCredential`, `getVaultMeta`, `setVaultMeta`)
- New `src/main/vault.ts` — `Vault` singleton with:
  - **AES-256-GCM** encryption for username, password, and free-form fields
  - **scrypt** key derivation (`N=16384, r=8, p=1, keyLen=32`) — salt persisted in `vault_meta`
  - Sentinel-based password verification (encrypts known plaintext `vault-ok`,
    verified with `timingSafeEqual` on unlock)
  - Idle auto-lock after 15 minutes (touched on every read; configurable via
    `settings.vault.idleTimeoutMinutes`)
  - Key buffer zeroed on `lock()`
- 8 IPC handlers under `vault:*`: `status`, `unlock`, `lock`, `list`, `get`,
  `create`, `update`, `delete`
- New `useCredential` automation action that loads a vault entry into workflow
  variables under a configurable prefix (`{cred.username}`, `{cred.password}`,
  `{cred.<field>}`). Fails fast if vault is locked.
- `interpolateParams` regex updated from `\{(\w+)\}` to `\{([\w.]+)\}` to support
  dotted placeholder keys.
- StepEditor wiring (`ACTION_META`, `ALL_ACTIONS`, `getDefaultParams`,
  `ParamEditor` case) for `useCredential`.
- "Credential Vault" card in **Settings** with unlock/create form, locked/unlocked
  status, add credential dialog, credential list, and delete buttons.

**Files**:
- [src/main/database.ts](src/main/database.ts) — `credentials` + `vault_meta` tables, CRUD
- New: [src/main/vault.ts](src/main/vault.ts) — encryption + key management
- [src/main/automation.ts](src/main/automation.ts) — `useCredential` action, interpolation regex
- [src/main/ipc/handlers.ts](src/main/ipc/handlers.ts) — 8 vault handlers
- [src/preload/index.ts](src/preload/index.ts), [src/renderer/src/env.d.ts](src/renderer/src/env.d.ts) — vault API surface
- [src/shared/types.ts](src/shared/types.ts) — `'useCredential'` action type
- [src/renderer/src/components/AutomationBuilder/StepEditor.tsx](src/renderer/src/components/AutomationBuilder/StepEditor.tsx) — action UI
- [src/renderer/src/components/Settings/index.tsx](src/renderer/src/components/Settings/index.tsx) — vault management card

### 12.C.4 — Fingerprint collision detector ✅

Warn when two profiles share canvas/webgl noise seeds or `(UA, screen, tz)` tuple.
**Effort**: S · **Impact**: Medium · **Risk**: Low

**Implemented**:
- `src/main/fingerprint/collision-detector.ts` — pure function `detectCollisions(profiles)`
  groups profiles by `(canvas, webgl, audio)` noise-seed tuple ("noise-seed", critical)
  and `(UA, screen, timezone)` triple ("identity-tuple", warning)
- `profiles:detectCollisions` IPC handler
- `CollisionsDrawer.tsx` — right-side drawer with re-scan, two severity sections, clickable
  profile chips. Clicking a chip closes the drawer and scrolls + highlights the matching
  card in the profile grid (3 s amber ring fade)
- "Check collisions" button in ProfileManager toolbar (`ShieldAlert` icon)

---

## Recommended implementation order

| # | Item | Track | Effort | Why this slot |
|---|---|---|---|---|
| 1 | **12.A.1** Binary version detection + auto-sync | A | S | Cheapest correctness fix; unblocks all of A |
| 2 | **12.B.4** Workflow variables editor | B | S | Tiny, completes existing schema |
| 3 | **12.B.3** File upload/download actions | B | S | Tiny, frequently requested |
| 4 | **12.C.4** Collision detector | C | S | Tiny, valuable for warm cache |
| 5 | **12.A.2** HTTP/2 detection vectors | A | M | Validates whether A.3 is needed |
| 6 | **12.B.1** Captcha integration | B | M | Highest product-impact M-effort item |
| 7 | **12.C.1** Cookie editor | C | M | Most-asked-for polish |
| 8 | **12.B.2** Visual recorder | B | L | Big, but a major selling point |
| 9 | **12.C.3** Credential vault | C | M | Needs master password infra |
| 10 | **12.A.3** TLS proxy | A | XL | Defer until demand is proven |

---

## Open questions

- **A.1 default**: Should auto-sync UA be ON or OFF by default? Recommend **ON** —
  it strictly improves passing scores, and the user can still pin a specific Chrome
  version per profile by toggling it off.
- **A.3 strategy**: If we ever build the TLS proxy, prefer Go + `utls` over Node — Node
  has no real path to ClientHello control.
