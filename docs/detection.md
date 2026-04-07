# Detection Test Suite

## Overview

The detection test suite evaluates a profile against **45 vectors** covering automation signals, browser fingerprint consistency, timing precision, and API presence. Each test produces a pass/fail result with a detail string. The overall score is `passed / total * 100`.

| Score | Status |
|-------|--------|
| ≥ 90 | ✅ Passed |
| 70–89 | ⚠️ Warning |
| < 70 | ❌ Failed |

---

## Running Tests

### Via UI

**Detection Dashboard → select profile → Run Test**

For multiple profiles: enable batch mode, select profiles, click **Run Batch**.

### Via IPC

```typescript
// Single test
const result = await window.api.detection.runTest(profileId)

// Batch test
const batch = await window.api.detection.batchTest([id1, id2, id3])
// Returns: { total, completed, failed, results }

// Get history
const history = await window.api.detection.results(profileId)

// Summary across all profiles
const summary = await window.api.detection.summary()
```

### Via REST API

```
POST /api/detection/run/:profileId
GET  /api/detection/results/:profileId
```

---

## All 45 Detection Vectors

### Automation Signals (9 vectors)

| # | Name | What is checked | Pass condition |
|---|------|----------------|----------------|
| 1 | navigator.webdriver | `navigator.webdriver` value | `undefined` or `false` |
| 2 | chrome.runtime exists | `window.chrome.runtime` present | `true` |
| 3 | chrome.app stub | `chrome.app.getDetails` is a function | `true` |
| 4 | ChromeDriver variables | Keys starting with `cdc_` / `__cdc_` | None found |
| 15 | Error stack traces | Error.stack contains automation references | No `__puppeteer`, `pptr:`, `__playwright` |
| 16 | Function.toString masking | `navigator.permissions.query.toString()` | Contains `[native code]` |
| 17 | Headless browser signals | `outerWidth`, `outerHeight` | Both > 0 |
| 23 | Object.defineProperty consistency | `webdriver` descriptor flags | Absent or `configurable: true` |
| 28 | Selenium / WebDriver artifacts | `__selenium_*`, `__webdriver_*`, `$cdc_*` on window/document | None found |

### Browser Properties (8 vectors)

| # | Name | What is checked | Pass condition |
|---|------|----------------|----------------|
| 5 | Permissions API consistency | `permissions.query({ name: 'notifications' })` | Not `'error'` or `'denied'` |
| 6 | Navigator properties | `navigator.platform`, `navigator.vendor` | Both non-empty |
| 4 | navigator.plugins | `navigator.plugins.length` | > 0 |
| 20 | Notification.permission | `Notification.permission` | Not `'denied'` |
| 24 | Worker navigator.webdriver | `navigator.webdriver` inside Worker | `undefined` or `unsupported` |
| 29 | Service Worker API | `navigator.serviceWorker.register` | Present and is a function |
| 30 | Document focus / visibility | `document.visibilityState`, `document.hidden` | `'visible'` + `false` |
| 36 | Prototype chain integrity | Enumerable keys on `Function.prototype` | Count = 0 |

### Graphics & Audio (4 vectors)

| # | Name | What is checked | Pass condition |
|---|------|----------------|----------------|
| 7 | Canvas fingerprint | `canvas.toDataURL()` | Returns data URL > 100 chars |
| 8 | WebGL vendor/renderer | UNMASKED_VENDOR/RENDERER | Non-empty, not SwiftShader |
| 9 | AudioContext | Analyser frequency data | `data.length > 0` |
| 22 | WebAssembly support | `WebAssembly.compile`, `.instantiate` | Both present |

### Hardware Consistency (6 vectors)

| # | Name | What is checked | Pass condition |
|---|------|----------------|----------------|
| 10 | Screen dimensions | `screen.width`, `outerWidth`, `innerWidth` | All > 0 and consistent |
| 25 | CSS media query consistency | `(pointer: fine/coarse)`, `(hover: hover)` | Not 'none' for pointer |
| 26 | Battery API shape | `navigator.getBattery()` response | Absent or valid shape |
| 27 | Viewport consistency | inner/outer/screen dimensions + DPR | All > 0, outer ≥ inner |
| 40 | devicePixelRatio consistency | DPR value and screen/outerWidth | DPR in (0, 4], sizes > 0 |
| 34 | WebGPU API presence | `'gpu' in navigator`, type | `object` |

### Locale (4 vectors)

| # | Name | What is checked | Pass condition |
|---|------|----------------|----------------|
| 11 | Timezone override | `Intl.DateTimeFormat().resolvedOptions().timeZone` | Non-empty |
| 12 | Language consistency | `navigator.language === navigator.languages[0]` | `true` |
| 31 | Intl locale consistency | `Intl.DateTimeFormat().resolvedOptions().locale` | Starts with `navigator.language` language tag |
| 45 | Intl.supportedValuesOf stability | `Intl.supportedValuesOf('timeZone')`, `'currency'` | ≥ 3 entries each |

### API Presence (12 vectors)

| # | Name | What is checked | Pass condition |
|---|------|----------------|----------------|
| 13 | Network Information API | `navigator.connection.downlink`, `effectiveType` | `downlink > 0` |
| 14 | Storage quota | `navigator.storage.estimate().quota` | > 50 GB |
| 19 | Performance entries | Entries with `__puppeteer`, `pptr:`, `devtools://` | 0 found |
| 35 | Math FPU fingerprint | `Math.sin(1)`, `Math.cos(1)` vs x86 reference | Within 1e-15 |
| 37 | MediaCapabilities API | `decodingInfo()` for h264 1080p | `smooth: true` |
| 38 | Keyboard Layout API | `navigator.keyboard.getLayoutMap` | Present |
| 42 | SpeechSynthesis consistency | Voices list contains locale-matching voice | `true` or empty list |
| 43 | Private State Tokens API | `document.hasPrivateToken`, `hasRedemptionRecord` | Both present |
| 44 | SharedArrayBuffer + Atomics | `typeof SharedArrayBuffer`, `typeof Atomics` | Consistent |
| 32 | UACH brands list | `navigator.userAgentData.brands.length` | Not available or ≥ 2 |
| 33 | UACH platform vs UA | `userAgentData.platform` matches UA OS | Match |
| 39 | WebRTC SDP fingerprint | `RTCPeerConnection` offer SDP | Has `a=fingerprint:`, length > 100 |

### Timing (3 vectors)

| # | Name | What is checked | Pass condition |
|---|------|----------------|----------------|
| 21 | Date.now() precision | Unique values in 20 samples modulo 1000 | 1–18 unique |
| 41 | Navigation Timing v2 | PerformanceNavigationTiming entry | `responseStart ≥ requestStart`, `domInteractive ≥ responseEnd` |
| 18 | Performance entries | Automation-related perf entries | 0 found |

---

## Result Schema

```typescript
interface DetectionTestResult {
  id: string
  profileId: string
  profileName: string
  testedAt: string           // ISO 8601
  overallScore: number       // 0–100
  vectors: DetectionVectorResult[]
  status: 'passed' | 'warning' | 'failed'
}

interface DetectionVectorResult {
  name: string
  category: string
  passed: boolean
  detail?: string            // human-readable explanation
}
```

---

## Storage

- Results stored in `detection_tests` SQLite table
- Per-profile limit: **50 most recent** results
- Global limit: **100 most recent** results
- Result IDs are UUIDs (auto-generated)

---

## Batch Testing

```typescript
interface BatchTestStatus {
  total: number
  completed: number
  failed: number             // profiles where test threw (not detection failures)
  results: DetectionTestResult[]
}
```

Tests run sequentially (not in parallel) to avoid resource contention when launching multiple Chromium instances.
