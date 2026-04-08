# Phase 17 — Script-to-Workflow Generation

**Branch:** `claude/rpa-workflow-generation-838tM`
**Status:** Planning
**Target:** Weeks 91–98

---

## Overview

User performs a task once (first-time recording), the system captures all interactions, analyzes patterns with AI, and produces a clean, parameterized, reusable workflow — without manual step building.

**Core loop:**
```
Record first run → Analyze patterns → AI refine → Review/Edit → Save as Workflow
```

---

## Problem Statement

Currently users have two ways to build workflows:
1. **Manual step builder** — time-consuming, requires technical knowledge of selectors
2. **NL generator** (`ai:generateWorkflow`) — fast but produces generic steps, no real-page context

Missing: A "record once, replay N times" path that captures real interactions with real selectors and produces a production-quality workflow automatically.

---

## Current State (What Exists)

| Component | File | Status |
|---|---|---|
| Basic recorder | `src/main/recorder.ts` | Exists — captures click/input/navigate events |
| Events-to-steps | `recorder.ts → eventsToSteps()` | Exists — basic 1:1 mapping |
| AI workflow gen | `src/main/ai-assistant.ts → generateWorkflow()` | Exists — NL only, no recording context |
| Selector healing | `ai-assistant.ts → healSelector()` | Exists — single selector fix |
| Step fixer | `ai-assistant.ts → fixStep()` | Exists — single step fix |
| Recording UI | `AutomationBuilder/index.tsx` | Exists — start/stop controls, event count |
| IPC recorder | `handlers.ts → recorder:*` | Exists — start/stop/state/validateSelectors |

**Gaps to fill for Phase 17:**
- No pattern detection (loops, conditionals) in recorded steps
- No variable extraction (hardcoded URLs/values → `{variables}`)
- No AI batch refinement of entire recording
- No screenshot timeline review UI
- No multi-recording merge/diff
- No wait optimization (recorded raw timings → intelligent waits)
- No network request capture during recording

---

## Architecture

### New Files

```
src/main/
├── script-analyzer.ts         # 17.B — Pattern detection, variable extraction, wait optimizer
├── recording-refiner.ts       # 17.C — AI batch pipeline for full recording enhancement
└── ipc/recording-handlers.ts  # New IPC handlers (or extend handlers.ts)

src/renderer/src/components/AutomationBuilder/
├── RecordingReview/
│   ├── index.tsx              # 17.D — Main review panel (timeline + steps side-by-side)
│   ├── EventTimeline.tsx      # Screenshot timeline with event markers
│   ├── StepDiff.tsx           # Recorded event vs generated step diff view
│   ├── VariableWizard.tsx     # Accept/reject extracted variables
│   └── RefinementPanel.tsx    # AI suggestions panel
```

### Modified Files

| File | Changes |
|---|---|
| `src/main/recorder.ts` | Add screenshot capture, network capture, DOM snapshots, timing metadata |
| `src/main/ai-assistant.ts` | Add `refineRecording()`, `extractVariables()`, `detectLoops()` |
| `src/main/ipc/handlers.ts` | New `recording:analyze`, `recording:refine`, `recording:saveAsWorkflow` handlers |
| `src/preload/index.ts` | Expose new recording analysis API |
| `src/shared/types.ts` | New types: `RecordingSession`, `RecordingAnalysis`, `ExtractedVariable`, `DetectedPattern` |
| `src/renderer/src/components/AutomationBuilder/index.tsx` | Wire recording review panel |

---

## Data Structures

```typescript
// Extended recorded event with rich metadata
interface RecordedEvent {
  // Existing fields
  type: 'click' | 'input' | 'change' | 'submit' | 'navigate' | 'scroll' | 'keypress'
  selector: string
  value?: string
  url?: string
  tag?: string
  label?: string
  timestamp: number
  // New fields (Phase 17)
  screenshotPath?: string      // screenshot taken after event (optional)
  domSnapshot?: string         // compressed HTML fragment around element
  networkRequests?: string[]   // URLs triggered by this interaction
  timingMs?: number            // actual time since previous event (raw)
}

// A complete recording session
interface RecordingSession {
  id: string
  profileId: string
  startedAt: string
  stoppedAt?: string
  events: RecordedEvent[]
  pageTitle?: string
  startUrl?: string
  captureScreenshots: boolean
  captureNetwork: boolean
  status: 'recording' | 'stopped' | 'analyzing' | 'refined' | 'saved'
}

// Output from script analyzer (17.B)
interface RecordingAnalysis {
  sessionId: string
  rawStepCount: number
  optimizedStepCount: number

  detectedPatterns: DetectedPattern[]
  extractedVariables: ExtractedVariable[]
  waitOptimizations: WaitOptimization[]
  selectorQuality: SelectorQualityReport[]

  suggestedWorkflow: AutomationWorkflow   // before AI refinement
  analysisNotes: string[]
}

// A structural pattern found in the recording
interface DetectedPattern {
  type: 'loop' | 'conditional' | 'repeated-selector' | 'form-group' | 'navigation-chain'
  stepIndices: number[]          // which steps are part of this pattern
  confidence: number             // 0.0 – 1.0
  suggestedReplacement?: AutomationStep   // e.g. a loop step wrapping the steps
  description: string
}

// A value that should become a workflow variable
interface ExtractedVariable {
  name: string                   // suggested variable name, e.g. "targetUrl", "username"
  value: string                  // the hardcoded value found in recording
  occurrences: number[]          // step indices where it appears
  type: 'url' | 'text-input' | 'selector-value' | 'credential' | 'numeric' | 'date'
  confidence: number
  autoApply: boolean             // true if high-confidence, safe to auto-apply
}

// Wait optimization suggestion
interface WaitOptimization {
  stepIndex: number
  originalTimingMs: number
  suggestedWaitMs: number        // smart wait derived from timing + element type
  strategy: 'waitForSelector' | 'fixed-wait' | 'no-wait'
  reason: string
}

// Selector quality assessment
interface SelectorQualityReport {
  stepIndex: number
  selector: string
  quality: 'excellent' | 'good' | 'fragile' | 'brittle'
  reason: string
  suggestedSelector?: string     // from healSelector() if fragile/brittle
}

// Output from AI refinement pipeline (17.C)
interface RefinedRecording {
  sessionId: string
  originalSteps: AutomationStep[]
  refinedSteps: AutomationStep[]
  appliedSuggestions: RefinementSuggestion[]
  summary: string
  aiNotes: string
}

interface RefinementSuggestion {
  stepId: string
  type: 'selector-heal' | 'step-fix' | 'add-retry' | 'add-error-handler' | 'add-wait' | 'parameterize'
  before: Partial<AutomationStep>
  after: Partial<AutomationStep>
  reason: string
  applied: boolean
}
```

---

## Component Breakdown

### 17.A — Enhanced Recorder (`recorder.ts` extension)

**Goal:** Capture richer context during recording for better analysis downstream.

**Changes to `recorder.ts`:**

1. **Screenshot capture** — already has optional `captureScreenshots` param; ensure it stores paths in `RecordedEvent.screenshotPath`
2. **DOM snapshot** — on click/input events, serialize the target element's ancestor HTML (3 levels) for context → stored in `domSnapshot`
3. **Network capture** — subscribe to `page.on('request')` during recording; tag each event with which network requests it triggered
4. **Timing metadata** — record `timingMs` between events (wall-clock delta, not just timestamp)
5. **Scroll events** — currently not captured; add scroll event listener and emit `RecordedEvent{ type: 'scroll', ... }`
6. **Session persistence** — save `RecordingSession` to DB table `recording_sessions` so recording survives app restart

**New DB table:**
```sql
CREATE TABLE recording_sessions (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  stopped_at TEXT,
  events TEXT NOT NULL,  -- JSON
  page_title TEXT,
  start_url TEXT,
  capture_screenshots INTEGER DEFAULT 0,
  capture_network INTEGER DEFAULT 0,
  status TEXT DEFAULT 'recording'
);
```

---

### 17.B — Script Analyzer (`script-analyzer.ts`)

**Goal:** Detect structure and optimization opportunities in raw recorded events.

```typescript
class ScriptAnalyzer {
  analyze(session: RecordingSession): RecordingAnalysis

  // Internal steps
  private toRawSteps(events: RecordedEvent[]): AutomationStep[]
  private detectLoops(steps: AutomationStep[]): DetectedPattern[]
  private detectConditionals(steps: AutomationStep[]): DetectedPattern[]
  private detectFormGroups(steps: AutomationStep[]): DetectedPattern[]
  private extractVariables(steps: AutomationStep[], events: RecordedEvent[]): ExtractedVariable[]
  private optimizeWaits(steps: AutomationStep[], events: RecordedEvent[]): WaitOptimization[]
  private assessSelectorQuality(steps: AutomationStep[]): SelectorQualityReport[]
  private applyPatterns(steps: AutomationStep[], patterns: DetectedPattern[]): AutomationStep[]
  private applyVariables(steps: AutomationStep[], vars: ExtractedVariable[], autoOnly: boolean): AutomationStep[]
}
```

**Loop detection algorithm:**
- Look for repeating selector patterns (same selectors used in sequence, N times)
- Detect URL increment patterns (`/page/1`, `/page/2` → `{pageNum}` variable)
- Wrap detected repeating blocks into `loop` steps

**Variable extraction rules:**
| Pattern | Variable type | Example |
|---|---|---|
| URL in navigate step | `url` | `https://example.com/login` → `{targetUrl}` |
| Text typed into `input[type=email]` | `credential` | `user@email.com` → `{username}` |
| Text typed into `input[type=password]` | `credential` | `pass123` → `{password}` |
| Same value used in 2+ steps | `text-input` | Extract to shared variable |
| Numeric value (price, quantity) | `numeric` | `100` → `{quantity}` |
| Date string | `date` | `2026-04-08` → `{targetDate}` |

**Wait optimization rules:**
| Timing | Element type | Strategy |
|---|---|---|
| >2s between navigate and next click | any | `waitForSelector` before click |
| <300ms | any | remove wait entirely |
| 300ms–2s | submit/button | `wait: 500` fixed |
| After form submit | redirect detected | `waitForSelector` on success indicator |

---

### 17.C — AI Recording Refiner (`recording-refiner.ts`)

**Goal:** Batch AI pass over analyzed steps to improve robustness, add error handling, fix fragile selectors.

```typescript
class RecordingRefiner {
  async refine(
    analysis: RecordingAnalysis,
    options?: RefineOptions
  ): Promise<RefinedRecording>
}

interface RefineOptions {
  healFragileSelectors: boolean  // call healSelector() for fragile ones
  addRetryOnNetworkActions: boolean
  addErrorHandlers: boolean      // wrap risky steps in tryCatch
  generateStepLabels: boolean    // call explainStep() for unlabeled steps
  maxAiCalls?: number            // default: min(stepCount * 2, 30)
}
```

**Pipeline:**

```
1. For each selector rated "fragile" or "brittle" in SelectorQualityReport:
   → Call ai.healSelector(selector, domSnapshot, context)
   → If confidence >= "medium", apply suggestion

2. For each step with network requests tagged:
   → Add retries: 2, retryDelay: 1000, retryBackoff: 'exponential'

3. Detect groups of risky steps (login, form submit, navigation):
   → Wrap in tryCatch with screenshot-on-error catch block

4. For steps with empty label:
   → Call ai.explainStep(step)
   → Use first sentence as step label

5. Final pass: call ai.generateWorkflow(recordingSummary, pageHtml):
   → Provide recording summary as prompt context
   → Merge generated metadata (workflow name, description, notes)
```

**Rate limiting:** Respects existing 20-call session limit. Batch refine prioritizes: selector healing → step labels → error handlers.

---

### 17.D — Recording Review UI

**Goal:** Let user inspect and finalize the generated workflow before saving.

#### `RecordingReview/index.tsx`

Layout: split panel
- **Left:** Event timeline (screenshots + event list)
- **Right:** Generated workflow steps (editable)
- **Bottom bar:** AI suggestions panel + Save button

#### `EventTimeline.tsx`

```
[screenshot] → event label → timing gap → [screenshot] → ...
   0:00          Click "Login"    +1.2s         0:01.2
```

- Click event thumbnail to see full screenshot
- Hover to see raw event detail (selector, value, URL)
- Events color-coded: navigate=blue, click=green, type=purple, scroll=gray

#### `StepDiff.tsx`

For each generated step, show "before/after" toggle:
- **Raw**: the initial step from `eventsToSteps()`
- **Analyzed**: after pattern detection and variable extraction
- **Refined**: after AI refinement

User can pin any version per step.

#### `VariableWizard.tsx`

Table of extracted variables:
```
| Variable     | Value                  | Used in       | Type       | [Accept] [Edit] [Skip] |
| targetUrl    | https://facebook.com   | Step 1, 3     | url        |  ✓        —      —     |
| username     | john@email.com         | Step 4        | credential |  ✓        —      —     |
| password     | ••••••                 | Step 5        | credential |  ✓        —      —     |
```

#### `RefinementPanel.tsx`

List of AI suggestions with accept/reject toggles:
```
[✓] Step 3: Selector healed  button.login-btn → button[data-testid="login-submit"]  (high confidence)
[✓] Step 3: Added retry x2 on network failure
[✓] Steps 3–6: Wrapped in tryCatch (login flow)
[ ] Step 7: Label suggested "Wait for dashboard to load"
```

---

## IPC Channels (New)

| Channel | Handler | Description |
|---|---|---|
| `recording:sessions:list` | DB query | List all saved recording sessions |
| `recording:sessions:get` | DB query | Get session by ID with full events |
| `recording:sessions:delete` | DB delete | Delete session |
| `recording:analyze` | `ScriptAnalyzer.analyze()` | Run analysis on a session |
| `recording:refine` | `RecordingRefiner.refine()` | Run AI refinement on analysis |
| `recording:saveAsWorkflow` | DB create workflow | Save refined steps as new workflow |
| `recording:previewSteps` | `eventsToSteps()` | Quick preview without full analysis |

---

## Preload API (New)

```typescript
api.recording = {
  // Session management
  sessions: {
    list: () => ipcRenderer.invoke('recording:sessions:list'),
    get: (id: string) => ipcRenderer.invoke('recording:sessions:get', id),
    delete: (id: string) => ipcRenderer.invoke('recording:sessions:delete', id),
  },

  // Analysis & refinement
  analyze: (sessionId: string) =>
    ipcRenderer.invoke('recording:analyze', sessionId),
  refine: (sessionId: string, options?: RefineOptions) =>
    ipcRenderer.invoke('recording:refine', sessionId, options),
  previewSteps: (sessionId: string) =>
    ipcRenderer.invoke('recording:previewSteps', sessionId),

  // Save
  saveAsWorkflow: (sessionId: string, name: string, description?: string) =>
    ipcRenderer.invoke('recording:saveAsWorkflow', sessionId, name, description),
}
```

---

## User Flow

```
1. User opens AutomationBuilder
2. Selects profile → clicks "Record"
   → recorder:start (captureScreenshots: true, captureNetwork: true)
   → Profile browser opens
   → User performs task manually (login, fill form, navigate, etc.)
3. User clicks "Stop Recording"
   → recorder:stop
   → Session saved to DB with status 'stopped'
4. "Analyze Recording" button appears
   → recording:analyze(sessionId)
   → Shows progress (detecting patterns, extracting variables, assessing selectors)
5. RecordingReview panel opens:
   → Left: event timeline with screenshots
   → Right: analyzed steps (raw vs analyzed diff)
   → VariableWizard shown automatically if variables detected
6. User clicks "Refine with AI"
   → recording:refine(sessionId, options)
   → RefinementPanel shows suggestions
   → User accepts/rejects per suggestion
7. User clicks "Save as Workflow"
   → Enters workflow name
   → recording:saveAsWorkflow(sessionId, name)
   → Redirected to workflow editor for final tweaks
```

---

## Implementation Plan

### Step 1 — Types & DB (Day 1)

- [ ] Add new types to `src/shared/types.ts`:
  - `RecordingSession` (extend existing, add new fields)
  - `RecordingAnalysis`, `DetectedPattern`, `ExtractedVariable`
  - `WaitOptimization`, `SelectorQualityReport`
  - `RefinedRecording`, `RefinementSuggestion`, `RefineOptions`
- [ ] Add `recording_sessions` table to `src/main/database.ts`:
  - `createRecordingSession()`, `updateRecordingSession()`, `getRecordingSession()`, `listRecordingSessions()`, `deleteRecordingSession()`
- [ ] Extend `RecordedEvent` with: `screenshotPath?`, `domSnapshot?`, `networkRequests?`, `timingMs?`

### Step 2 — Enhanced Recorder (Day 2)

- [ ] Modify `src/main/recorder.ts`:
  - Add `timingMs` tracking between events
  - Add DOM snapshot serialization on click/input (3-level ancestor HTML, max 2KB)
  - Add scroll event capture
  - Add network request tagging per event (via page.on('request') delta tracking)
  - Persist session to DB via `database.createRecordingSession()` on start
  - Update session on each event batch (every 5 events or on stop)
  - On stop: update session status to 'stopped'

### Step 3 — Script Analyzer (Day 3–4)

- [ ] Create `src/main/script-analyzer.ts`:
  - `toRawSteps()` — use existing `eventsToSteps()` logic as base
  - `extractVariables()` — rule-based extraction (URL, credential, repeated values)
  - `optimizeWaits()` — timing-based smart wait strategy
  - `assessSelectorQuality()` — heuristic scoring (id/data-testid = excellent, nth-child = brittle)
  - `detectLoops()` — sequence repetition detection
  - `detectFormGroups()` — group consecutive type steps into logical form sections
  - `applyPatterns()` — transform steps based on detected patterns
  - `applyVariables()` — replace hardcoded values with `{varName}` placeholders
  - `analyze()` — orchestrates all the above, returns `RecordingAnalysis`

### Step 4 — AI Recording Refiner (Day 5)

- [ ] Create `src/main/recording-refiner.ts`:
  - `refine()` — batch AI pipeline:
    1. Heal fragile selectors (uses existing `healSelector()`)
    2. Add retry config to network steps
    3. Wrap risky groups in `tryCatch`
    4. Generate step labels via `explainStep()` for unlabeled steps
    5. Call `generateWorkflow()` with recording summary for workflow metadata
  - Respect AI call budget (`RefineOptions.maxAiCalls`)
  - Track suggestions as `RefinementSuggestion[]` with applied status
  - Return `RefinedRecording`

### Step 5 — IPC Handlers (Day 6)

- [ ] Add to `src/main/ipc/handlers.ts`:
  - `recording:sessions:list/get/delete`
  - `recording:analyze`
  - `recording:refine`
  - `recording:saveAsWorkflow`
  - `recording:previewSteps`
- [ ] Add to `src/preload/index.ts`:
  - `api.recording.*` namespace

### Step 6 — Recording Review UI (Day 7–9)

- [ ] Create `src/renderer/src/components/AutomationBuilder/RecordingReview/`:
  - `index.tsx` — split panel layout, state machine (idle/analyzing/refined)
  - `EventTimeline.tsx` — horizontal timeline with thumbnails
  - `StepDiff.tsx` — raw/analyzed/refined tab switcher per step
  - `VariableWizard.tsx` — variable accept/edit/skip table
  - `RefinementPanel.tsx` — AI suggestion list with accept/reject toggles
- [ ] Wire into `AutomationBuilder/index.tsx`:
  - After `recorder:stop` → show "Analyze" button
  - After analysis → open `RecordingReview` panel
  - After save → close panel, refresh workflow list

### Step 7 — Integration & Polish (Day 10)

- [ ] End-to-end test: record → analyze → refine → save → run
- [ ] Edge cases: empty recording, single-step recording, no AI key (disable refine button)
- [ ] Error states: analysis failure, AI quota exceeded, selector heal failed
- [ ] Loading/progress states in UI (analysis progress bar, per-step refine spinner)
- [ ] Keyboard shortcuts: `Esc` to cancel analysis, `Ctrl+S` to save workflow

---

## File Change Summary

| File | Type | Scope |
|---|---|---|
| `src/shared/types.ts` | Modify | +8 interfaces (~100 lines) |
| `src/main/database.ts` | Modify | +recording_sessions table + 5 CRUD methods |
| `src/main/recorder.ts` | Modify | +timingMs, +domSnapshot, +networkCapture, +scroll, +DB persistence |
| `src/main/script-analyzer.ts` | New | ~400 lines |
| `src/main/recording-refiner.ts` | New | ~300 lines |
| `src/main/ipc/handlers.ts` | Modify | +5 handlers |
| `src/preload/index.ts` | Modify | +`api.recording` namespace |
| `RecordingReview/index.tsx` | New | ~200 lines |
| `RecordingReview/EventTimeline.tsx` | New | ~150 lines |
| `RecordingReview/StepDiff.tsx` | New | ~120 lines |
| `RecordingReview/VariableWizard.tsx` | New | ~180 lines |
| `RecordingReview/RefinementPanel.tsx` | New | ~150 lines |
| `AutomationBuilder/index.tsx` | Modify | +review panel wiring (~50 lines) |

**Total estimated:** ~1,900 new lines, ~200 modified lines

---

## Out of Scope (Phase 17)

- Multi-recording merge/diff (compare two recordings of same workflow)
- Recording sharing across team members
- Recording playback at recorded speed (timing replay)
- Visual element picker (point-and-click selector builder)
- Browser extension recorder (external browser support)

These are candidates for Phase 18.

---

## Dependencies

- Phase 16 AI assistant (`ai-assistant.ts`) must be complete — ✅ already done
- Existing recorder (`recorder.ts`) must be working — ✅ already done
- `AutomationBuilder` UI must support workflow editing — ✅ already done
- DB singleton pattern (`database.ts`) — ✅ already done

No new npm packages required. All functionality built on existing Puppeteer CDP, sql.js, and Anthropic SDK.
