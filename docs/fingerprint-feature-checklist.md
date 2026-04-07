# Fingerprint Feature Checklist & Implementation Plan

Generated: 2026-04-07

---

## Legend
- ✅ Implemented & working
- ⚠️ Partial / types-only / UI missing
- ❌ Not started
- 🔧 In-progress / staged (modified files)

---

## 1. CORE SPOOFING SCRIPTS (Layer 1 — JS + CDP)

| # | Vector | Script | Status | Notes |
|---|--------|--------|--------|-------|
| 1 | User-Agent string | `navigator.ts` | ✅ | UA, platform, vendor, languages |
| 2 | Navigator hardware | `navigator.ts` | ✅ | deviceMemory, hardwareConcurrency, maxTouchPoints |
| 3 | Screen resolution | `navigator.ts` | ✅ | width/height/availWidth/availHeight/colorDepth/pixelRatio |
| 4 | Battery API | `navigator.ts` | ✅ | charging, level, chargeTime, dischargeTime |
| 5 | Media devices | `navigator.ts` | ✅ | audioInput/Output/videoInput count spoofing |
| 6 | Canvas fingerprint | `canvas.ts` | ✅ | toDataURL/toBlob/getImageData noise; block/noise/real modes |
| 7 | WebGL vendor/renderer | `webgl.ts` | ✅ | UNMASKED_VENDOR/RENDERER_WEBGL override + readPixels noise |
| 8 | AudioContext | `audio.ts` | ✅ | Analyser + oscillator noise; block/noise/real modes |
| 9 | Font enumeration | `fonts.ts` | ✅ | document.fonts.check whitelist + measureText noise |
| 10 | WebRTC IP leak | `webrtc.ts` | ✅ | ICE candidate filtering; disabled/fake/real modes |
| 11 | Plugin/MIME list | `plugins.ts` | ✅ | Realistic PluginArray/MimeTypeArray shape; OS-aware defaults |
| 12 | Speech synthesis | `speech.ts` | ✅ | OS-specific voice lists (Windows/macOS/Android/iOS) |
| 13 | ClientRects noise | `clientrects.ts` | ✅ | getBoundingClientRect/getClientRects sub-pixel offset |
| 14 | Permissions API | `permissions.ts` | ✅ | navigator.permissions.query OS-aware defaults |
| 15 | Storage quota | `storage.ts` | ✅ | navigator.storage.estimate() realistic values (≥100 GB) |
| 16 | Network Information | `network.ts` | ✅ | connection.downlink/rtt/effectiveType/type |
| 17 | Performance timing | `performance.ts` | ✅ | performance.now() precision hardening |

---

## 2. CDP EVASION (Layer 2 — Automation Signal Hiding)

| # | Evasion | File | Status | Notes |
|---|---------|------|--------|-------|
| 1 | ChromeDriver variable cleanup | `cdp-evasion.ts` | ✅ | window.cdc_*, __cdc_* deletion + Proxy trap |
| 2 | chrome.runtime/loadTimes/csi stubs | `cdp-evasion.ts` | ✅ | Non-writable chrome.* API surface |
| 3 | Stack trace sanitization | `cdp-evasion.ts` | ✅ | Filters puppeteer:/evaluateOnNewDocument refs |
| 4 | Headless outerWidth/Height | `cdp-evasion.ts` | ✅ | Redefines 0→reasonable values |
| 5 | Object.defineProperty trap | `cdp-evasion.ts` | ✅ | Normalizes navigator property descriptors |
| 6 | Worker webdriver patching | `cdp-evasion.ts` | ✅ | Wraps Worker constructor to inject patch |
| 7 | Blink internals masking | `cdp-evasion.ts` | ✅ | Proxies window to hide __selenium_*, $cdc_* |
| 8 | iframe contentWindow propagation | `cdp-evasion.ts` | ✅ | MutationObserver patches about:blank/srcdoc iframes |
| 9 | Math FPU normalization | `cdp-evasion.ts` | ✅ | Phase 8 — Math.sin/cos/tan/atan2 x86 reference values |
| 10 | Prototype chain sanitization | `cdp-evasion.ts` | ✅ | Phase 8 — Function.prototype / Object.prototype |
| 11 | MediaCapabilities decodingInfo | `cdp-evasion.ts` | ✅ | Phase 8 — always reports smooth hardware decode |
| 12 | Trust Tokens API stubs | `cdp-evasion.ts` | ✅ | Phase 8 — hasPrivateToken/hasRedemptionRecord stubs |
| 13 | Permissions API patch | `cdp-evasion.ts` | ✅ | Duplicate of permissions.ts at CDP level |

---

## 3. BEHAVIOR & TIMING (Layer 3 — Phase 6)

| # | Feature | Script | Status | Notes |
|---|---------|--------|--------|-------|
| 1 | Mouse jitter | `behavior.ts` | ✅ | 0.4σ Gaussian sub-pixel noise on pointer events |
| 2 | Typing cadence noise | `behavior.ts` | ✅ | ±25 ms keydown/keyup timing randomization |
| 3 | Scroll inertia simulation | `behavior.ts` | ✅ | Momentum decay on wheel events |
| 4 | Date.now() quantization | `timing.ts` | ✅ | 50/100/250 ms precision blocks |
| 5 | rAF jitter | `timing.ts` | ✅ | ±1.2 ms requestAnimationFrame timestamp noise |
| 6 | performance.now() clamping | `timing.ts` | ✅ | Matches Date.now() precision level |
| 7 | Atomics.wait() guard | `timing.ts` | ✅ | Prevents SharedArrayBuffer timer side-channels |

---

## 4. DEEP VECTORS (Layer 4 — Phase 8)

| # | Feature | Script | Status | Notes |
|---|---------|--------|--------|-------|
| 1 | Intl API normalization | `intl.ts` | ✅ | DateTimeFormat/NumberFormat/Collator/supportedValuesOf |
| 2 | User-Agent Client Hints | `useragentdata.ts` | ✅ | brands/platform/mobile/architecture high-entropy values |
| 3 | WebGPU adapter info alignment | `webgpu.ts` | ✅ | Mirrors WebGL vendor/renderer to navigator.gpu |
| 4 | Keyboard layout consistency | `keyboard.ts` | ✅ | navigator.keyboard.getLayoutMap() — all SEA → QWERTY |
| 5 | Function.toString masking | `native-tostring.ts` | ✅ | All patched functions report [native code] |
| 6 | Worker context propagation | `worker.ts` | ✅ | navigator.webdriver patched in dedicated/shared workers |
| 7 | iframe contentWindow sync | `iframe.ts` | ✅ | Propagates navigator overrides to about:blank/srcdoc |

---

## 5. CHROMIUM C++ PATCHES (Layer 4b — Phase 8 Catalog)

| # | Patch Type | Status | Notes |
|---|-----------|--------|-------|
| 1 | JS shims (active) | ✅ | All js-shim patches via evaluateOnNewDocument |
| 2 | CDP overrides (active) | ✅ | All cdp-override patches via DevTools Protocol |
| 3 | GpuInit-level GPU info | ❌ | Requires custom Chromium build; GPU process spoofing |
| 4 | RenderFrameHost UACH struct | ❌ | Requires custom build; sub-JS-level UACH interception |
| 5 | Blink engine internals | ❌ | Requires custom build; low-level timing/memory spoofing |

---

## 6. FINGERPRINT PRESETS

| # | Preset | Status | Notes |
|---|--------|--------|-------|
| 1 | win10-chrome120 | ✅ | Windows 10, 1920×1080, NVIDIA, 8 GB |
| 2 | win11-chrome121 | ✅ | Windows 11, 2560×1440, AMD, 16 GB |
| 3 | win11-chrome124 | ✅ | Phase 9 — Windows 11, RTX 4060 |
| 4 | mac-ventura-chrome120 | ✅ | macOS Ventura, M1, Retina |
| 5 | mac-sonoma-chrome121 | ✅ | macOS Sonoma, M2, Retina |
| 6 | mac-sonoma-chrome124 | ✅ | Phase 9 — macOS Sonoma, M3 |
| 7 | linux-ubuntu-chrome120 | ✅ | Ubuntu 22.04, Intel UHD |
| 8 | android-samsung-chrome120 | ✅ | Samsung A54, Vietnamese locale, HCMC geo |
| 9 | android-pixel-chrome121 | ✅ | Pixel 7, Thai locale, Bangkok geo |
| 10 | android-pixel8-chrome124 | ✅ | Phase 9 — Pixel 8, Mali-G715 |
| 11 | android-oppo-chrome120 | ✅ | OPPO Reno, Indonesian locale, Jakarta geo |
| 12 | ios-iphone14-safari17 | ✅ | iPhone 14, iOS 17.2, vi-VN |
| 13 | ios-iphone15-safari17 | ✅ | iPhone 15, iOS 17.3, th-TH |
| 14 | ios-ipad-safari17 | ✅ | iPad Air, iPadOS 17.2, id-ID |
| 15 | win11-chrome125 (2025 UA) | ❌ | Missing latest Chrome version preset |
| 16 | mac-sequoia-chrome124 | ❌ | macOS Sequoia not covered |
| 17 | android-samsung-chrome124 | ❌ | SEA flagship 2024 mid-range missing |

---

## 7. DETECTION TEST VECTORS (45 tested)

| # | Category | Vector | Status |
|---|----------|--------|--------|
| 1–6 | Automation Signals | webdriver, cdc_*, chrome.runtime, chrome.loadTimes, DevTools artifacts, framework markers | ✅ |
| 7–16 | Browser APIs | UA, platform, vendor, languages, chrome.app, plugins/MIME, permissions consistency | ✅ |
| 17–21 | Graphics | Canvas toDataURL, WebGL vendor/renderer, WEBGL_debug_renderer_info, readPixels, WebGL params | ✅ |
| 22 | Audio | AudioContext analyser/oscillator consistency | ✅ |
| 23–26 | Hardware | Screen dims, device memory, hardware concurrency, touch points | ✅ |
| 27–30 | Locale | Timezone, language/Accept-Language, Intl locale, Intl.supportedValuesOf | ✅ |
| 31–36 | Timing | Date.now() precision, performance.now(), rAF stability, nav timing, Atomics, HRTT correlation | ✅ |
| 37–45 | API Surface | Battery, media devices, storage quota, Network Info, speech voices, WebRTC IP, font check, permissions, perf entries | ✅ |
| 46 | Network/UA Alignment | Binary UA ↔ platform ↔ memory consistency | ⚠️ Type defined, not in runTest |
| 47 | UACH brand alignment | brands ↔ UA string match | ⚠️ Type defined, not in runTest |
| 48 | UACH platform alignment | platform ↔ OS preset match | ⚠️ Type defined, not in runTest |
| 49 | UACH mobile alignment | mobile ↔ touch points ↔ preset match | ⚠️ Type defined, not in runTest |
| 50 | Accept-Language alignment | Accept-Language header ↔ navigator.languages | ⚠️ Type defined, not in runTest |

---

## 8. UI — FingerprintEditor

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1 | Protection score card (circular) | ✅ | Spoofed / total vectors (43/43) |
| 2 | Profile selector | ✅ | Dropdown to pick active profile |
| 3 | Profile inspector (preset, UA, screen, GPU, etc.) | ✅ | Read-only summary panel |
| 4 | Locale/timezone mismatch warning | ✅ | Amber badge when mismatch detected |
| 5 | Behavior toggles (mouse/typing/scroll) | ✅ | Phase 6 — saves to profile |
| 6 | Timing selector (date precision + rAF/perf clamp) | ✅ | Phase 6 — saves to profile |
| 7 | Re-roll fingerprint button | ✅ | Generates new deterministic seed |
| 8 | Vector table by category (43 rows) | ✅ | Risk badges (critical/high/medium/low) |
| 9 | Per-vector on/off toggle | ❌ | All vectors are all-or-nothing; no granular control |
| 10 | Live fingerprint diff view | ❌ | No "before/after re-roll" comparison |
| 11 | Preset picker in editor | ❌ | Must create new profile to change preset |
| 12 | Quick-edit: swap OS/browser inline | ❌ | No inline UA or screen dimension editor |
| 13 | Noise seed manual override | ❌ | Seed is auto-derived; no manual input field |
| 14 | Fingerprint fingerprint collision badge | ❌ | No warning when two profiles share same seed/identity |

---

## 9. UI — DetectionDashboard

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1 | Single-profile test runner | ✅ | Dropdown + Run button |
| 2 | Vector breakdown by category | ✅ | Expandable pass/fail rows with detail text |
| 3 | Score badge (passed/warning/failed) | ✅ | ≥90% / 70–89% / <70% |
| 4 | Batch profile testing | ✅ | Checkbox multi-select, sequential runner |
| 5 | Batch status bar | ✅ | X/N completed, Y failed |
| 6 | Result list with timestamps | ✅ | Delete individual results |
| 7 | Clear all results (with confirmation) | ✅ | |
| 8 | CSV export | ✅ | Profile, score, status, vector detail |
| 9 | Health trend chart (SVG line) | ✅ | Phase 11 — per-day bucketing, profile filter |
| 10 | Trend indicator (↑/↓/=) | ✅ | Delta % badge with TrendingUp/Down icon |
| 11 | Result comparison view | ❌ | No side-by-side diff of two test runs |
| 12 | Failed-vector drill-down link | ❌ | No direct link from failed vector → FingerprintEditor |
| 13 | Per-category score breakdown chart | ❌ | Overall score only; no radar/bar per category |
| 14 | Scheduled auto-testing | ❌ | Manual trigger only; no recurring test cron |

---

## 10. PROFILE MANAGER

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1 | Create/edit/delete profiles | ✅ | |
| 2 | Import from .ghost.zip bundle | 🔧 | ImportGuideModal.tsx added (staged, not wired) |
| 3 | Export as .ghost.zip bundle | ⚠️ | Types reference export; IPC handler TBD |
| 4 | Multi-select bulk actions | ✅ | Batch delete, batch launch |
| 5 | Profile group management | ✅ | |
| 6 | Profile versioning (20 snapshots) | ✅ | Phase 6 |
| 7 | Fingerprint collision warning | ❌ | CollisionReport type defined, scanner not built |

---

## 11. GAPS: VECTORS NOT YET SPOOFED

| # | Vector | Difficulty | Priority | Notes |
|---|--------|-----------|---------|-------|
| 1 | navigator.onLine status | Low | Medium | Occasionally leaked when offline mode inconsistent |
| 2 | IndexedDB quota/metadata | Low | Medium | Storage-based fingerprinting via cross-origin quota comparison |
| 3 | Cache API entries | Medium | Medium | Service worker cache keys can correlate identity |
| 4 | Beacon API (sendBeacon) | Low | Low | Navigation timing patterns; low practical risk |
| 5 | Long Tasks / PerformanceObserver | Medium | Low | Pattern analysis via long task entries |
| 6 | Pointer Lock API | Medium | Low | Mouse confinement behavior analysis |
| 7 | Sensor APIs (Accelerometer/Gyro) | Medium | High | Android/iOS presets — SEA mobile targets actively use |
| 8 | SharedArrayBuffer availability | Low | Medium | Risk signal when disabled inconsistently |
| 9 | Gamepad API | Low | Low | Low usage in SEA market |
| 10 | document.documentMode | Low | Low | IE legacy; edge case only |

---

## IMPLEMENTATION PLAN

### Phase 10 — Close Critical Gaps

**P10-A: Complete 5 Network/UA Alignment Detection Vectors** (est. 1 day)
- Add 5 test vectors to `detection-test.ts`: binary UA alignment, UACH brands/platform/mobile, Accept-Language
- Vectors types already defined — add `runTest` logic for each
- Files: [src/main/detection-test.ts](../src/main/detection-test.ts)

**P10-B: Per-Vector Toggle in FingerprintEditor** (est. 2 days)
- Add `disabledVectors?: string[]` to FingerprintConfig in shared/types.ts
- In injector.ts, skip building scripts for disabled vector IDs
- In FingerprintEditor, render toggle button per vector row
- Files: [src/shared/types.ts](../src/shared/types.ts), [src/main/fingerprint/injector.ts](../src/main/fingerprint/injector.ts), [src/renderer/src/components/FingerprintEditor/index.tsx](../src/renderer/src/components/FingerprintEditor/index.tsx)

**P10-C: Finish Profile Import/Export Pipeline** (est. 1.5 days)
- `ImportGuideModal.tsx` exists (staged) — wire into ProfileManager `index.tsx`
- Add IPC handler `profiles:import` + `profiles:export` in `handlers.ts`
- Add zip pack/unpack logic in `database.ts` or new `profile-bundle.ts`
- Files: [src/renderer/src/components/ProfileManager/index.tsx](../src/renderer/src/components/ProfileManager/index.tsx), [src/main/ipc/handlers.ts](../src/main/ipc/handlers.ts)

---

### Phase 11 — Enhance Detection Dashboard

**P11-A: Detection Result Comparison View** (est. 1.5 days)
- Allow selecting 2 results → side-by-side vector diff (pass changed to fail highlighted in amber/red)
- New component `ResultCompareModal.tsx` inside DetectionDashboard/
- Files: [src/renderer/src/components/DetectionDashboard/](../src/renderer/src/components/DetectionDashboard/)

**P11-B: Per-Category Score Radar Chart** (est. 1 day)
- SVG radar chart alongside HealthTrendChart showing category scores (Automation/Graphics/Audio/Hardware/Locale/Timing/API)
- New component `CategoryRadarChart.tsx`
- Files: [src/renderer/src/components/DetectionDashboard/](../src/renderer/src/components/DetectionDashboard/)

**P11-C: Failed Vector → FingerprintEditor Deep Link** (est. 0.5 days)
- Clicking a failed vector shows "Fix this" → navigates to FingerprintEditor with that category/vector highlighted
- Requires App.tsx to accept `activeSection` + `highlightVector` props through navigation state
- Files: [src/renderer/src/App.tsx](../src/renderer/src/App.tsx), [src/renderer/src/components/DetectionDashboard/](../src/renderer/src/components/DetectionDashboard/)

---

### Phase 12 — FingerprintEditor UX Improvements

**P12-A: Inline Preset Picker** (est. 1 day)
- Allow switching preset on existing profile without recreating it
- Preset selector dropdown in profile inspector section of FingerprintEditor
- On select → call `profiles:update` with merged fingerprint (preset fields + preserved noise seed)
- Files: [src/renderer/src/components/FingerprintEditor/index.tsx](../src/renderer/src/components/FingerprintEditor/index.tsx), [src/main/ipc/handlers.ts](../src/main/ipc/handlers.ts)

**P12-B: Fingerprint Diff on Re-roll** (est. 1 day)
- Before/after panel showing changed values after re-roll (canvas seed, WebGL seed, etc.)
- Stateful `previousFingerprint` in FingerprintEditor component
- Files: [src/renderer/src/components/FingerprintEditor/index.tsx](../src/renderer/src/components/FingerprintEditor/index.tsx)

**P12-C: Collision Detection Engine** (est. 1.5 days)
- Implement `CollisionScanner` in `database.ts` or new `collision.ts`
- Compare identity tuple: (platform, UA, screen, GPU vendor, locale, noise seed) across all profiles
- Surface warning badge in ProfileManager and FingerprintEditor when collision found
- `CollisionReport` type already defined in shared/types.ts
- Files: [src/main/database.ts](../src/main/database.ts), [src/main/ipc/handlers.ts](../src/main/ipc/handlers.ts)

---

### Phase 13 — New Spoofing Vectors

**P13-A: Sensor API Spoofing (Android/iOS)** (est. 2 days)
- Add `sensor.ts` script: DeviceMotion + DeviceOrientation events with seeded noise
- Only injected for Android/iOS presets (OsConfig.platform check in injector)
- Add `SensorConfig` to FingerprintConfig + vector row in FingerprintEditor
- Files: [src/main/fingerprint/scripts/](../src/main/fingerprint/scripts/), [src/main/fingerprint/injector.ts](../src/main/fingerprint/injector.ts)

**P13-B: IndexedDB Quota Normalization** (est. 1 day)
- Add `indexeddb.ts` script: intercepts navigator.storage.estimate() for IndexedDB-specific reporting
- Extends existing storage.ts approach to cover per-origin quota queries
- Files: [src/main/fingerprint/scripts/](../src/main/fingerprint/scripts/)

**P13-C: Navigator.onLine Hardening** (est. 0.5 days)
- Extend `navigator.ts` to override navigator.onLine to always return true
- Also intercept `online`/`offline` window events
- Files: [src/main/fingerprint/scripts/navigator.ts](../src/main/fingerprint/scripts/navigator.ts)

---

### Phase 14 — New Presets

**P14-A: Chrome 125 desktop presets** (est. 0.5 days)
- `win11-chrome125` + `mac-sequoia-chrome124`
- Verified UA strings, UACH brands, current GPU matrix
- Files: [src/main/fingerprint/presets.ts](../src/main/fingerprint/presets.ts)

**P14-B: 2024 SEA flagship Android presets** (est. 0.5 days)
- `android-samsung-a55-chrome124`, `android-vivo-y100-chrome120` (Vietnam market)
- Include correct GPU vendor/renderer strings, screen DPI, locale
- Files: [src/main/fingerprint/presets.ts](../src/main/fingerprint/presets.ts)

---

## PRIORITY MATRIX

| Phase | Task | Impact | Effort | Priority |
|-------|------|--------|--------|---------|
| P10-A | Network/UA alignment vectors (5) | High | Low | **P1** |
| P10-C | Profile import/export pipeline | High | Medium | **P1** |
| P10-B | Per-vector toggle UI | Medium | Medium | **P2** |
| P11-C | Failed vector deep link | Medium | Low | **P2** |
| P12-C | Collision detection engine | High | Medium | **P2** |
| P11-A | Result comparison view | Medium | Medium | **P3** |
| P11-B | Per-category radar chart | Medium | Low | **P3** |
| P12-A | Inline preset picker | Medium | Low | **P3** |
| P13-A | Sensor API spoofing | High (SEA mobile) | Medium | **P3** |
| P13-C | navigator.onLine hardening | Low | Low | **P4** |
| P12-B | Re-roll diff view | Low | Low | **P4** |
| P13-B | IndexedDB quota | Low | Low | **P4** |
| P14-A | Chrome 125 presets | Low | Low | **P4** |
| P14-B | 2024 SEA Android presets | Medium | Low | **P4** |
