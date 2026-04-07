# Automation Navigation — Feature Plan

## Status Legend
- ✅ Done — fully implemented
- 🔨 In Progress — currently being built
- ⬜ Planned — scoped and ready
- 💡 Backlog — identified, not yet scoped

---

## Phase A — Core Action Library

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| A1 | `navigate` — load URL with waitUntil strategy | ✅ Done | |
| A2 | `click` — click by CSS selector | ✅ Done | |
| A3 | `type` — type text with delay + optional clear | ✅ Done | |
| A4 | `wait` — pause N ms | ✅ Done | |
| A5 | `waitForSelector` — wait for element visibility | ✅ Done | |
| A6 | `screenshot` — full page or viewport | ✅ Done | |
| A7 | `extractText` — get element text content | ✅ Done | |
| A8 | `scroll` — scroll X/Y pixels | ✅ Done | |
| A9 | `select` — change `<select>` value | ✅ Done | |
| A10 | `keyPress` — press keyboard key | ✅ Done | |
| A11 | `evaluate` — run arbitrary JS in page | ✅ Done | |
| A12 | `hover` — hover over element | ✅ Done | |
| A13 | `rightClick` — right-click element | ✅ Done | |
| A14 | `setAttribute` — set HTML attribute | ✅ Done | |
| A15 | `httpRequest` — HTTP GET/POST/PUT/DELETE/PATCH | ✅ Done | |
| A16 | `upload` — upload file to `<input type="file">` | ✅ Done | |
| A17 | `download` — download file via URL with cookies | ✅ Done | |
| A18 | `waitForNavigation` — wait for page load after click | 🔨 In Progress | P0 |
| A19 | `doubleClick` — double-click element | 🔨 In Progress | P0 |
| A20 | `iframe` — switch execution context into iframe | ⬜ Planned | P2 |
| A21 | `newTab` / `closeTab` — multi-tab support | ⬜ Planned | P2 |
| A22 | `dragAndDrop` — drag element to target | ⬜ Planned | P3 |
| A23 | `blockRequest` — block network requests by pattern | 💡 Backlog | |

---

## Phase B — Control Flow

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| B1 | `conditional` — branch on selector existence | ✅ Done | |
| B2 | `conditional` — value comparison (text-equals, text-contains, js-truthy) | 🔨 In Progress | P0 |
| B3 | `loop` — repeat steps N times | ✅ Done | |
| B4 | `forEach` loop over extracted element list | ⬜ Planned | P2 |
| B5 | `while` loop — loop until condition met | ⬜ Planned | P2 |
| B6 | Try/catch step group — continue on failure | ⬜ Planned | P1 |
| B7 | Step retry policy — N retries with delay | 🔨 In Progress | P0 |
| B8 | `goto` / labels — jump to named step | 💡 Backlog | |

---

## Phase C — Captcha & Auth

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| C1 | `solveCaptcha` — reCAPTCHA v2/v3, hCaptcha, image | ✅ Done | |
| C2 | `injectCaptchaToken` — inject solved token | ✅ Done | |
| C3 | `useCredential` — load from encrypted vault | ✅ Done | |

---

## Phase D — Data & Variables

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| D1 | Variable interpolation — `{key}` placeholders | ✅ Done | |
| D2 | Lazy per-step interpolation (supports solveCaptcha → {captchaToken}) | ✅ Done | |
| D3 | Step output → variable (`saveAs` on extractText / evaluate / httpRequest) | 🔨 In Progress | P0 |
| D4 | Built-in variables — `{timestamp}`, `{runId}`, `{random}`, `{profileName}` | 🔨 In Progress | P0 |
| D5 | JSON path extraction from httpRequest response | ⬜ Planned | P2 |
| D6 | Variable type validation at build time | 💡 Backlog | |

---

## Phase E — Execution & Monitoring

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| E1 | Single-profile sequential execution | ✅ Done | |
| E2 | Parallel multi-profile execution (configurable concurrency) | ✅ Done | |
| E3 | Stop single / stop all parallel runs | ✅ Done | |
| E4 | Batch run result display | ✅ Done | |
| E5 | Run history (persisted per workflow) | ✅ Done | |
| E6 | Live step progress stream (real-time per-step status) | 🔨 In Progress | P0 |
| E7 | Step screenshot on failure — auto capture on error | ⬜ Planned | P1 |
| E8 | Execution timeout — max runtime guard | ⬜ Planned | P1 |
| E9 | Run history pagination | ⬜ Planned | P2 |
| E10 | Export run results to CSV/JSON | ⬜ Planned | P2 |

---

## Phase F — Workflow UX

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| F1 | Workflow CRUD (create / edit / delete) | ✅ Done | |
| F2 | Step add / delete / reorder (up/down arrows) | ✅ Done | |
| F3 | Step duplicate | ✅ Done | |
| F4 | Variables editor | ✅ Done | |
| F5 | Per-run variable overrides | ✅ Done | |
| F6 | Template picker (6 built-in templates) | ✅ Done | |
| F7 | Workflow import from JSON file | 🔨 In Progress | P1 |
| F8 | Workflow export to JSON file | 🔨 In Progress | P1 |
| F9 | Drag-and-drop step reordering | ⬜ Planned | P1 |
| F10 | Step grouping / collapsible sections | ⬜ Planned | P2 |
| F11 | Undo/redo for step edits | ⬜ Planned | P3 |
| F12 | Workflow versioning — named snapshots | ⬜ Planned | P3 |
| F13 | More templates (OTP login, pagination, affiliate check) | ⬜ Planned | P2 |

---

## Phase G — Recorder

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| G1 | Visual recorder — capture click/type/select/navigate events | ✅ Done | |
| G2 | Coalesce consecutive inputs into single type step | ✅ Done | |
| G3 | Robust CSS selector generation | ✅ Done | |
| G4 | Edit recorded steps before converting to workflow | ⬜ Planned | P2 |
| G5 | Record assertions — right-click → "assert text equals X" | ⬜ Planned | P3 |
| G6 | Network request recording → httpRequest steps | 💡 Backlog | |

---

## Phase H — Scheduling

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| H1 | Cron-based schedules (5-field cron expression) | ✅ Done | |
| H2 | Enable/disable schedules | ✅ Done | |
| H3 | Run Now trigger | ✅ Done | |
| H4 | Preset cron expressions in UI | ✅ Done | |
| H5 | Human-readable cron description in UI | 🔨 In Progress | P1 |
| H6 | Schedule run history log | ⬜ Planned | P2 |
| H7 | Timezone support for schedules | ⬜ Planned | P2 |
| H8 | Schedule failure notifications | ⬜ Planned | P3 |

---

## Phase I — REST API Server

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| I1 | Local HTTP server with Bearer token auth | ✅ Done | |
| I2 | Profile launch/close via API | ✅ Done | |
| I3 | Workflow list/create/run/stop via API | ✅ Done | |
| I4 | Proxy management via API | ✅ Done | |
| I5 | Detection test trigger via API | ✅ Done | |
| I6 | Webhook support — POST on workflow complete/fail | ⬜ Planned | P2 |
| I7 | API key management UI — generate/revoke tokens | ⬜ Planned | P2 |
| I8 | OpenAPI/Swagger doc endpoint | ⬜ Planned | P3 |
| I9 | Rate limiting on API endpoints | ⬜ Planned | P3 |

---

## Current Sprint Implementation Details

### 🔨 A18 — `waitForNavigation`
**Engine** (`automation.ts`): `await page.waitForNavigation({ waitUntil, timeout })`
**Params**: `waitUntil: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2'`, `timeout`
**Use case**: Click a submit button, then wait for navigation to complete.

### 🔨 A19 — `doubleClick`
**Engine** (`automation.ts`): `await page.click(selector, { clickCount: 2 })`
**Params**: `selector`, `timeout`

### 🔨 B2 — `conditional` value comparison
**Engine** (`automation.ts`): Add `conditionType` param:
- `'selector-exists'` — existing behavior (default)
- `'text-equals'` — compare element textContent to `expected`
- `'text-contains'` — check if textContent includes `expected`
- `'js-truthy'` — evaluate JS expression, check truthiness

### 🔨 B7 — Step retry policy
**Engine** (`automation.ts`): Wrap each step execution in retry loop.
**Type** (`shared/types.ts`): Add `retries?: number` and `retryDelay?: number` to `AutomationStep`.
**UI** (`StepEditor.tsx`): Show retries/retryDelay fields in step editor.

### 🔨 D3 — Step output → variable (`saveAs`)
**Engine** (`automation.ts`): After `extractText`, `evaluate`, `httpRequest` — if `params.saveAs` is set, write result to `variables[params.saveAs]`.
**UI** (`StepEditor.tsx`): Add `saveAs` field to those three actions.

### 🔨 D4 — Built-in variables
**Engine** (`automation.ts`): At start of `executeWorkflow`, inject:
- `timestamp` → `new Date().toISOString()`
- `runId` → `workflowId + ':' + profileId`
- `random` → `Math.random().toString(36).slice(2)`
- `profileName` → looked up from DB by profileId

### 🔨 E6 — Live step progress stream
**Main** (`automation.ts`): Accept optional `webContents` param. After each step, call:
`webContents?.send('automation:step-progress', { workflowId, profileId, step: result })`
**IPC** (`handlers.ts`): Pass `event.sender` to `executeWorkflow`.
**Preload** (`preload/index.ts`): Expose `window.api.automation.onStepProgress(cb): unsubscribe`.
**Renderer** (`AutomationBuilder/index.tsx`): Subscribe, update `liveSteps` state, render live step list.

### 🔨 F7/F8 — Workflow import/export JSON
**UI** (`AutomationBuilder/index.tsx`):
- Export: serialize workflow (name, description, steps, variables) → `Blob` → trigger download as `.json`
- Import: hidden `<input type="file" accept=".json">` → parse JSON → `createWorkflow()` with imported data

### 🔨 H5 — Human-readable cron description
**UI** (`SchedulesModal.tsx`): Simple parser mapping cron → plain English beside each schedule.
