# Detection Vectors Reference Guide

**Purpose**: Comprehensive documentation of all 45 detection vectors used by Ghost Browser's detection testing engine.

**Last Updated**: 2026-04-08  
**Total Vectors**: 45 across 8 categories  
**Detection Coverage**: Automation, Browser, Graphics, Audio, Hardware, Locale, Timing, API, Network/UA

---

## Navigation

- [How to Use This Guide](#how-to-use-this-guide)
- [Vector Categories](#vector-categories)
- [Phase-by-Phase Breakdown](#phase-by-phase-breakdown)
- [By Detection Provider](#by-detection-provider)
- [Troubleshooting Failed Vectors](#troubleshooting-failed-vectors)

---

## How to Use This Guide

Each vector entry contains:
- **Vector Name**: Identifier used in test results
- **Category**: One of 8 detection categories
- **What it checks**: One-sentence explanation of the detection
- **How it fails**: Conditions that cause test failure
- **Why it fails**: Root cause explanation
- **How to fix**: Steps to resolve in Fingerprint Editor
- **Example values**: Pass/fail scenarios
- **Detection providers**: Real-world services that use this vector
- **Fix priority**: Urgency level (🔴 Critical, 🟡 High, 🟢 Medium, 🔵 Low)

---

## Vector Categories

| Category | Count | Focus | Examples |
|----------|-------|-------|----------|
| **Automation** | 5 | Detection of programmatic control (Puppeteer, Selenium) | webdriver flag, CDC variables |
| **Browser** | 10 | Browser API consistency and completeness | plugins, chrome.runtime, navigator properties |
| **Graphics** | 3 | Canvas/WebGL fingerprinting and rendering | canvas noise, WebGL vendor, device pixel ratio |
| **Audio** | 1 | AudioContext fingerprinting detection | analyser noise |
| **Hardware** | 4 | Device hardware capabilities and consistency | battery API, viewport, screen |
| **Locale** | 4 | Timezone, language, and regional settings | timezone consistency, language strings |
| **Timing** | 6 | Performance timing and precision-based detection | Date.now precision, navigation timing |
| **API** | 12 | Advanced API detection (WebGPU, Intl, UACH, etc.) | WebGPU presence, Intl support, UACH brands |

---

## Phase-by-Phase Breakdown

### Phase 1-5: Core Vectors (20 vectors)

These form the foundation of bot detection. All should typically pass.

#### **1. navigator.webdriver** (Automation)
- **What it checks**: Whether the browser is controlled via WebDriver protocol (Puppeteer/Selenium)
- **How it fails**: `navigator.webdriver === true` or `navigator.webdriver === 'ok'`
- **Why it fails**: Browser launched via automation API instead of user-launched
- **How to fix**: 
  1. Open Fingerprint Editor → CDP Evasion → Advanced CDP Evasion
  2. Enable "Hide webdriver flag"
  3. Re-run detection test
- **Example values**:
  - ✅ PASS: `undefined`
  - ❌ FAIL: `true`, `'ok'`
- **Detection providers**: PerimeterX, DataDome, Cloudflare, Imperva
- **Fix priority**: 🔴 CRITICAL

#### **2. chrome.runtime exists** (Browser)
- **What it checks**: Whether `window.chrome.runtime` API is present (Chrome extension APIs)
- **How it fails**: `typeof window.chrome.runtime === 'undefined'` (headless indicator)
- **Why it fails**: Chrome running without extension APIs (headless mode)
- **How to fix**: 
  1. Open Fingerprint Editor → CDP Evasion
  2. Enable "Stub chrome.runtime"
  3. Verify script: `src/main/fingerprint/scripts/cdp-evasion.ts`
- **Example values**:
  - ✅ PASS: `typeof window.chrome.runtime === 'object'`
  - ❌ FAIL: `undefined` or missing chrome object
- **Detection providers**: PerimeterX, DataDome, Cloudflare, Imperva, Bot Manager
- **Fix priority**: 🔴 CRITICAL

#### **3. chrome.app stub** (Browser)
- **What it checks**: Whether `chrome.app.getDetails()` function exists
- **How it fails**: `chrome.app` is undefined or `getDetails()` is not a function
- **Why it fails**: Apps not available in headless environment
- **How to fix**:
  1. Open Fingerprint Editor → CDP Evasion
  2. Enable "Stub chrome.app"
  3. Script location: `src/main/fingerprint/scripts/cdp-evasion.ts`
- **Example values**:
  - ✅ PASS: `typeof chrome.app.getDetails === 'function'`
  - ❌ FAIL: `undefined`, `not a function`
- **Detection providers**: PerimeterX, DataDome
- **Fix priority**: 🟡 HIGH

#### **4. navigator.plugins** (Browser)
- **What it checks**: Whether the browser reports any installed plugins
- **How it fails**: `navigator.plugins.length === 0` (headless has no plugins)
- **Why it fails**: Headless browsers disable plugin enumeration
- **How to fix**:
  1. Open Fingerprint Editor → Presets
  2. Select preset with plugins (e.g., win10-chrome120)
  3. Check "Enable plugins spoofing" under Fingerprint Editor → Browser
  4. Verify in `src/main/fingerprint/scripts/navigator.ts`
- **Example values**:
  - ✅ PASS: `navigator.plugins.length >= 1` (has plugins)
  - ❌ FAIL: `navigator.plugins.length === 0`
- **Detection providers**: PerimeterX, DataDome, Cloudflare
- **Fix priority**: 🟡 HIGH

#### **5. Permissions API consistency** (API)
- **What it checks**: Whether `navigator.permissions.query()` works and returns expected state
- **How it fails**: Returns `'error'` or `'denied'` for notifications query
- **Why it fails**: Permissions API missing or broken in headless
- **How to fix**:
  1. Open Fingerprint Editor → Fingerprint Vectors
  2. Locate "Permissions API spoofing" script
  3. Ensure "Grant default permissions" is enabled
  4. Test with notifications permission
- **Example values**:
  - ✅ PASS: `'granted'`, `'prompt'` (valid states)
  - ❌ FAIL: `'error'`, `'denied'` (indicates headless)
- **Detection providers**: PerimeterX, Cloudflare
- **Fix priority**: 🟡 HIGH

#### **6. Navigator properties** (Browser)
- **What it checks**: Whether navigator platform and vendor are set (usually non-empty strings)
- **How it fails**: `navigator.platform === ''` or `navigator.vendor === ''`
- **Why it fails**: Headless browser doesn't populate these properties
- **How to fix**:
  1. Open Fingerprint Editor → Browser
  2. Set "Platform" to match OS (e.g., 'Win32' for Windows)
  3. Set "Vendor" (usually 'Google Inc' for Chrome)
  4. Verify via script: `src/main/fingerprint/scripts/navigator.ts`
- **Example values**:
  - ✅ PASS: `platform='Win32'`, `vendor='Google Inc'`
  - ❌ FAIL: `platform=''`, `vendor=''`
- **Detection providers**: PerimeterX, DataDome, Cloudflare
- **Fix priority**: 🟡 HIGH

#### **7. Canvas fingerprint** (Graphics)
- **What it checks**: Whether `canvas.toDataURL()` produces non-empty output
- **How it fails**: Canvas rendering returns empty or heavily modified data
- **Why it fails**: Canvas noise injection breaks actual rendering
- **How to fix**:
  1. Open Fingerprint Editor → Graphics
  2. Set canvas noise level to "Medium" (not "High")
  3. Or disable canvas spoofing temporarily to verify rendering works
  4. Script: `src/main/fingerprint/scripts/canvas.ts`
- **Example values**:
  - ✅ PASS: `canvas.toDataURL().length > 100` (contains image data)
  - ❌ FAIL: `canvas.toDataURL().length === 0` (empty)
- **Detection providers**: PerimeterX, DataDome, Imperva, Canvas-based detection services
- **Fix priority**: 🟡 HIGH

#### **8. WebGL vendor** (Graphics)
- **What it checks**: Whether WebGL reports vendor/renderer string (GPU info)
- **How it fails**: Vendor or renderer is undefined or generic
- **Why it fails**: WebGL spoofing removed GPU strings in headless
- **How to fix**:
  1. Open Fingerprint Editor → Graphics
  2. Set "WebGL vendor" to match GPU (e.g., 'NVIDIA')
  3. Set "WebGL renderer" to valid string (e.g., 'ANGLE (Intel HD Graphics)')
  4. Script: `src/main/fingerprint/scripts/webgl.ts`
- **Example values**:
  - ✅ PASS: `vendor='Google Inc'`, `renderer='ANGLE (Intel)'`
  - ❌ FAIL: `vendor=undefined`, `renderer=''`
- **Detection providers**: PerimeterX, Imperva, WebGL-based detection
- **Fix priority**: 🟡 HIGH

#### **9. AudioContext** (Audio)
- **What it checks**: Whether AudioContext noise injection creates realistic fingerprint
- **How it fails**: Analyser frequency data is all zeros or heavily modified
- **Why it fails**: Audio noise too aggressive, breaks audio detection logic
- **How to fix**:
  1. Open Fingerprint Editor → Audio
  2. Set "AudioContext noise" to "Low" or "Medium"
  3. Disable audio spoofing temporarily if test still fails
  4. Script: `src/main/fingerprint/scripts/audio.ts`
- **Example values**:
  - ✅ PASS: Analyser has non-zero frequency values
  - ❌ FAIL: All frequency data is zero
- **Detection providers**: PerimeterX, Imperva, Advanced audio fingerprinting
- **Fix priority**: 🟢 MEDIUM

#### **10. Screen consistency** (Hardware)
- **What it checks**: Whether screen width/height match viewport and device settings
- **How it fails**: `screen.width`, `screen.height` don't match configured viewport
- **Why it fails**: Inconsistent fingerprint between screen and viewport APIs
- **How to fix**:
  1. Open Fingerprint Editor → Hardware
  2. Set "Screen width/height" same as Viewport
  3. Verify: `src/main/fingerprint/scripts/navigator.ts`
- **Example values**:
  - ✅ PASS: `screen.width === 1920`, `viewport.width === 1920`
  - ❌ FAIL: `screen.width=1920`, `viewport.width=1440` (mismatch)
- **Detection providers**: PerimeterX, Cloudflare, Imperva
- **Fix priority**: 🟡 HIGH

#### **11. Timezone** (Locale)
- **What it checks**: Whether timezone offset is consistent across APIs
- **How it fails**: Timezone from different sources (Intl.DateTimeFormat, getTimezoneOffset, etc.) don't match
- **Why it fails**: Inconsistent timezone spoofing across layers
- **How to fix**:
  1. Open Fingerprint Editor → Locale
  2. Set "Timezone" to consistent value (e.g., 'America/New_York')
  3. Verify all timezone APIs return same offset
  4. Script: `src/main/fingerprint/scripts/performance.ts`
- **Example values**:
  - ✅ PASS: All APIs return same offset (e.g., -300 for EST)
  - ❌ FAIL: Intl says UTC-5, but new Date().getTimezoneOffset() says -360
- **Detection providers**: PerimeterX, DataDome, Cloudflare
- **Fix priority**: 🟡 HIGH

#### **12. Language consistency** (Locale)
- **What it checks**: Whether language strings are consistent across navigator.language, Intl, and Accept-Language header
- **How it fails**: `navigator.language !== navigator.languages[0]`
- **Why it fails**: Language inconsistency in spoofing layers
- **How to fix**:
  1. Open Fingerprint Editor → Locale
  2. Set "Language" to single language (e.g., 'en-US')
  3. Ensure Accept-Language header includes same language
  4. Script: `src/main/fingerprint/scripts/navigator.ts`
- **Example values**:
  - ✅ PASS: `navigator.language === 'en-US'`, `languages[0] === 'en-US'`
  - ❌ FAIL: `language='en-US'`, `languages[0]='fr-FR'`
- **Detection providers**: PerimeterX, DataDome, Cloudflare
- **Fix priority**: 🟡 HIGH

#### **13. Connection API** (API)
- **What it checks**: Whether `navigator.connection` reports realistic network info
- **How it fails**: `navigator.connection` returns undefined or unrealistic values
- **Why it fails**: Connection API not implemented in headless
- **How to fix**:
  1. Open Fingerprint Editor → API
  2. Enable "Network Information API spoofing"
  3. Set "Effective Type" to '4g' (realistic)
  4. Script: `src/main/fingerprint/scripts/network.ts`
- **Example values**:
  - ✅ PASS: `connection.effectiveType === '4g'`, `connection.downlink >= 1`
  - ❌ FAIL: `connection === undefined`
- **Detection providers**: PerimeterX, Imperva, Network API detection
- **Fix priority**: 🟢 MEDIUM

#### **14. Storage quota** (API)
- **What it checks**: Whether `navigator.storage.estimate()` returns realistic quota
- **How it fails**: Storage quota returns zero or unrealistic values
- **Why it fails**: Storage quota not implemented or broken in headless
- **How to fix**:
  1. Open Fingerprint Editor → API
  2. Enable "Storage API spoofing"
  3. Set quota to realistic value (1-100 GB)
  4. Script: `src/main/fingerprint/scripts/storage.ts`
- **Example values**:
  - ✅ PASS: `quota >= 1000000000` (>= 1GB)
  - ❌ FAIL: `quota === 0`
- **Detection providers**: Imperva, Storage quota detection
- **Fix priority**: 🟢 MEDIUM

#### **15. Error stack** (Browser)
- **What it checks**: Whether error.stack has webdriver or automation keywords
- **How it fails**: Stack trace contains 'webdriver', 'chrome-remote', 'puppeteer', etc.
- **Why it fails**: Headless Chrome includes webdriver library paths
- **How to fix**:
  1. Open Fingerprint Editor → CDP Evasion → Advanced CDP Evasion
  2. Enable "Stack trace sanitization"
  3. Verify stacks don't contain automation keywords
  4. Script: `src/main/fingerprint/scripts/cdp-evasion.ts`
- **Example values**:
  - ✅ PASS: Stack has normal JavaScript filenames
  - ❌ FAIL: Stack includes 'chrome-remote-protocol', 'webdriver', etc.
- **Detection providers**: PerimeterX, Imperva, Cloudflare
- **Fix priority**: 🔴 CRITICAL

#### **16. Function.toString** (Browser)
- **What it checks**: Whether Function.toString() returns realistic function source code
- **How it fails**: Function.toString() returns '[native code]' or empty for overridden functions
- **Why it fails**: Function overrides not properly implemented
- **How to fix**:
  1. Open Fingerprint Editor → CDP Evasion
  2. Enable "Restore Function.toString"
  3. Script: `src/main/fingerprint/scripts/cdp-evasion.ts`
- **Example values**:
  - ✅ PASS: `Math.abs.toString()` returns `[native code]`
  - ❌ FAIL: Returns empty string or malformed function source
- **Detection providers**: Imperva, Cloudflare, Function inspection detection
- **Fix priority**: 🟡 HIGH

#### **17. Headless signals** (Automation)
- **What it checks**: Whether browser reports non-headless user agent and behavior
- **How it fails**: User Agent contains 'HeadlessChrome' or no '/X11' in Linux UA
- **Why it fails**: User agent not properly spoofed to hide headless mode
- **How to fix**:
  1. Open Fingerprint Editor → Browser
  2. Set "User Agent" to non-headless UA (remove 'Headless' keyword)
  3. Ensure preset doesn't include 'Headless'
  4. Script: `src/main/fingerprint/scripts/navigator.ts`
- **Example values**:
  - ✅ PASS: UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  - ❌ FAIL: UA = 'HeadlessChrome/132.0.6834.83'
- **Detection providers**: PerimeterX, DataDome, Cloudflare, Imperva
- **Fix priority**: 🔴 CRITICAL

#### **18. CDC variables** (Automation)
- **What it checks**: Whether Chrome DevTools Protocol (CDP) markers are hidden
- **How it fails**: Variables like `__HEADLESS__`, `__RUNNER__`, `__USED_AUTOMATION__` exist
- **Why it fails**: CDP environment markers not stripped in headless
- **How to fix**:
  1. Open Fingerprint Editor → CDP Evasion → Advanced CDP Evasion
  2. Enable "Hide CDC variables"
  3. Verify window object doesn't contain automation markers
  4. Script: `src/main/fingerprint/scripts/cdp-evasion.ts`
- **Example values**:
  - ✅ PASS: Variables don't exist on window object
  - ❌ FAIL: `window.__HEADLESS__ === true` or similar markers present
- **Detection providers**: PerimeterX, DataDome, Imperva
- **Fix priority**: 🔴 CRITICAL

#### **19. Performance entries** (Timing)
- **What it checks**: Whether Performance API reports non-suspicious entries
- **How it fails**: Performance entries contain CDP, devtools, or resource timing gaps
- **Why it fails**: Headless doesn't record realistic performance data
- **How to fix**:
  1. Open Fingerprint Editor → Timing & Behavior
  2. Enable "Performance timing quantization"
  3. Script: `src/main/fingerprint/scripts/performance.ts`
- **Example values**:
  - ✅ PASS: Normal performance entries with realistic timings
  - ❌ FAIL: Missing entries, zero timings, or suspicious gaps
- **Detection providers**: PerimeterX, Imperva
- **Fix priority**: 🟡 HIGH

#### **20. Notification permission** (API)
- **What it checks**: Whether notification permission is not always 'denied' (headless indicator)
- **How it fails**: `Notification.permission === 'denied'` (headless default)
- **Why it fails**: Headless environment defaults to denied notifications
- **How to fix**:
  1. Open Fingerprint Editor → API
  2. Enable "Permission spoofing"
  3. Set "Notification" to 'granted' or 'prompt'
  4. Script: `src/main/fingerprint/scripts/permissions.ts`
- **Example values**:
  - ✅ PASS: `'granted'` or `'prompt'`
  - ❌ FAIL: `'denied'` (headless default)
- **Detection providers**: PerimeterX, Cloudflare
- **Fix priority**: 🟡 HIGH

---

### Phase 6: Behavior & Timing Vectors (10 vectors)

Advanced vectors focusing on behavior simulation and timing consistency.

#### **21. Date.now precision** (Timing)
- **What it checks**: Whether Date.now() returns realistic precision
- **How it fails**: Precision too fine (micro/nanoseconds) or suspiciously quantized
- **Why it fails**: Timing manipulation too aggressive
- **How to fix**: Open Fingerprint Editor → Timing, reduce "Timing precision noise"

#### **22. WebAssembly support** (API)
- **What it checks**: Whether `typeof WebAssembly !== 'undefined'`
- **How it fails**: WebAssembly is undefined
- **Why it fails**: Modern browser doesn't have WASM support
- **How to fix**: Update browser preset to modern Chrome/Firefox version

#### **23. Object.defineProperty consistency** (Browser)
- **What it checks**: Whether Object.defineProperty works consistently
- **How it fails**: Defining properties fails silently or throws errors
- **Why it fails**: Object.defineProperty hooked but not properly implemented
- **How to fix**: Open Fingerprint Editor → CDP Evasion, ensure hooks are complete

#### **24. Worker webdriver** (Automation)
- **What it checks**: Whether WebWorker detection in dedicated workers
- **How it fails**: webdriver flag present in worker context
- **Why it fails**: Webdriver hiding not applied to worker threads
- **How to fix**: Enable "Hide webdriver in workers" in CDP Evasion

#### **25. CSS media consistency** (Hardware)
- **What it checks**: Whether CSS media queries match OS settings
- **How it fails**: prefers-reduced-motion, prefers-color-scheme don't match actual settings
- **Why it fails**: Media preference spoofing not implemented
- **How to fix**: Open Fingerprint Editor → Hardware, set media preferences

#### **26. Battery API shape** (API)
- **What it checks**: Whether Battery API exists and has correct shape
- **How it fails**: Battery API undefined or missing properties
- **Why it fails**: Battery API deprecated but still checked
- **How to fix**: Enable "Battery API stub" in Fingerprint Editor → API

#### **27. Viewport consistency** (Hardware)
- **What it checks**: Whether viewport dimensions match window.innerWidth/Height
- **How it fails**: `viewport.width !== window.innerWidth`
- **Why it fails**: Inconsistent viewport spoofing
- **How to fix**: Set viewport and screen resolution to same dimensions

#### **28. Selenium artifacts** (Automation)
- **What it checks**: Whether Selenium-specific markers are absent
- **How it fails**: Variables like `document.$cdc_*`, `window.fxdriver` exist
- **Why it fails**: Selenium libraries left in headless environment
- **How to fix**: Enable "Remove Selenium artifacts" in CDP Evasion

#### **29. Service Worker support** (API)
- **What it checks**: Whether ServiceWorker registration works
- **How it fails**: `navigator.serviceWorker === undefined`
- **Why it fails**: Headless may disable service workers
- **How to fix**: Enable "Service Worker stub" in Fingerprint Editor

#### **30. Document focus** (Browser)
- **What it checks**: Whether document.hasFocus() returns true
- **How it fails**: Returns false (browser not focused in headless)
- **Why it fails**: Headless browser is never "focused"
- **How to fix**: Enable "Always focused" in Fingerprint Editor → Behavior

---

### Phase 8: Deep Detection Vectors (15 vectors)

Advanced vectors for modern detection techniques.

#### **31. Intl locale consistency** (Locale)
- **What it checks**: Whether Intl.DateTimeFormat reflects configured locale
- **How it fails**: Intl locale doesn't match navigator.language
- **How to fix**: Set Intl locale to match language setting

#### **32. UserAgentData brands** (API)
- **What it checks**: Whether `navigator.userAgentData.brands` array is realistic
- **How it fails**: Brands missing or malformed
- **How to fix**: Enable "User-Agent Client Hints" spoofing

#### **33. UserAgentData platform** (API)
- **What it checks**: Whether `navigator.userAgentData.platform` matches navigator.platform
- **How it fails**: Platform strings don't align
- **How to fix**: Ensure UACH platform matches selected OS

#### **34. WebGPU presence** (API)
- **What it checks**: Whether navigator.gpu exists (WebGPU)
- **How it fails**: WebGPU undefined
- **How to fix**: Update to modern Chrome version (>= 115)

#### **35. Math FPU fingerprint** (API)
- **What it checks**: Whether Math operations produce consistent results
- **How it fails**: Math functions return unexpected values
- **How to fix**: Enable "Math FPU consistency" in CDP Evasion

#### **36. Proto chain integrity** (Browser)
- **What it checks**: Whether prototype chain is intact
- **How it fails**: Prototype links are broken or modified
- **How to fix**: Enable "Restore prototype chain" in CDP Evasion

#### **37. Media capabilities** (API)
- **What it checks**: Whether MediaCapabilities API works
- **How it fails**: Returns undefined or error
- **How to fix**: Enable "Media Capabilities stub" in Fingerprint Editor

#### **38. Keyboard API** (API)
- **What it checks**: Whether Keyboard API exists
- **How it fails**: navigator.keyboard === undefined
- **How to fix**: Enable "Keyboard API stub" (if needed for target site)

#### **39. WebRTC SDP fingerprint** (API)
- **What it checks**: Whether WebRTC SDP includes realistic host candidates
- **How it fails**: SDP contains CDP or localhost addresses
- **How to fix**: Enable "WebRTC leak prevention" in Network settings

#### **40. Device pixel ratio** (Hardware)
- **What it checks**: Whether devicePixelRatio matches screen settings
- **How it fails**: devicePixelRatio mismatches screen resolution
- **How to fix**: Set DPI/device pixel ratio consistent with screen

#### **41. Navigation timing** (Timing)
- **What it checks**: Whether navigation timing entries are realistic
- **How it fails**: Timings are all zero or suspiciously quantized
- **How to fix**: Enable "Navigation timing smoothing" in Timing

#### **42. Speech synthesis** (API)
- **What it checks**: Whether SpeechSynthesis voices are available
- **How it fails**: getVoices() returns empty array
- **How to fix**: Enable "Speech synthesis voices" stub

#### **43. Trust Token API** (API)
- **What it checks**: Whether Trust Token API has correct shape
- **How it fails**: Trust Token API missing or malformed
- **How to fix**: Enable "Trust Token API stub" (if target uses it)

#### **44. SharedArrayBuffer** (API)
- **What it checks**: Whether SharedArrayBuffer is available
- **How it fails**: Undefined (requires cross-origin isolation headers)
- **How to fix**: Not critical for most sites (HTTP header issue)

#### **45. Intl supported values** (Locale)
- **What it checks**: Whether Intl.DateTimeFormat has complete supported values
- **How it fails**: Intl.supportedValuesOf returns incomplete locale list
- **How to fix**: Update to modern Chrome/Firefox version

---

### Phase 12.A.2: Network/UA Alignment (5 vectors)

Vectors ensuring HTTP headers align with JavaScript API values.

#### **46. Binary UA alignment** (Network/UA)
- **What it checks**: Whether binary User-Agent header matches navigator.userAgent
- **How it fails**: HTTP UA doesn't match JS navigator UA
- **How to fix**: Update network proxy settings to use same UA

#### **47. UACH brands alignment** (Network/UA)
- **What it checks**: Whether Sec-CH-UA header brands match navigator.userAgentData.brands
- **How it fails**: Header brands list doesn't match JS array
- **How to fix**: Enable "Auto-sync UACH headers" in Network settings

#### **48. UACH platform alignment** (Network/UA)
- **What it checks**: Whether Sec-CH-UA-Platform matches navigator.userAgentData.platform
- **How it fails**: Header platform doesn't match API value
- **How to fix**: Enable "Auto-sync platform header" in Network settings

#### **49. UACH mobile/touch alignment** (Network/UA)
- **What it checks**: Whether Sec-CH-UA-Mobile/UA-Platform-Version align
- **How it fails**: Mobile flag doesn't match touchEnabled or platform
- **How to fix**: Set mobile flag consistent with browser preset

#### **50. Accept-Language alignment** (Network/UA)
- **What it checks**: Whether Accept-Language header matches navigator.language
- **How it fails**: Header language doesn't match navigator.language value
- **How to fix**: Enable "Auto-sync Accept-Language header" in Network settings

---

## By Detection Provider

### PerimeterX (Most comprehensive)
Detected by: 1, 2, 3, 4, 6, 7, 8, 10, 11, 12, 13, 15, 17, 18, 19

### DataDome (Behavior-focused)
Detected by: 1, 2, 3, 4, 6, 7, 10, 11, 12, 17, 18

### Cloudflare (API-focused)
Detected by: 1, 2, 4, 5, 6, 10, 11, 12, 13, 16, 17

### Imperva (Graphics-heavy)
Detected by: 1, 2, 7, 8, 9, 13, 15, 16, 19

---

## Troubleshooting Failed Vectors

### Quick Diagnosis Flowchart

```
Vector fails → Check category:
│
├─ AUTOMATION (webdriver, CDC, Selenium)
│  └─ Enable CDP Evasion in Fingerprint Editor
│
├─ BROWSER (plugins, chrome.runtime, navigator)
│  └─ Update preset to modern Chrome/Windows version
│
├─ GRAPHICS (canvas, WebGL)
│  └─ Reduce noise level or disable spoofing
│
├─ LOCALE (timezone, language)
│  └─ Set consistent timezone + language
│
├─ TIMING (Date.now, performance entries)
│  └─ Enable timing quantization/smoothing
│
└─ API (WebAssembly, WebGPU, Storage, Network)
   └─ Update Chrome version or enable API stubs
```

### Common Failure Patterns

**Pattern 1: Multiple automaton vectors fail (1, 17, 18)**
- **Symptom**: webdriver=true, headless in UA, CDC variables present
- **Cause**: CDP Evasion not enabled
- **Fix**: Enable all CDP evasion options in Fingerprint Editor

**Pattern 2: Graphics vectors fail (7, 8)**
- **Symptom**: Canvas/WebGL noise too aggressive
- **Cause**: Noise level set too high
- **Fix**: Reduce to "Medium" or "Low" in Fingerprint Editor → Graphics

**Pattern 3: Locale vectors fail (11, 12, 31)**
- **Symptom**: Timezone/language inconsistency
- **Cause**: Different values set in different places
- **Fix**: Set single timezone + language, enable auto-sync headers

**Pattern 4: API vectors fail (5, 13, 14, 43)**
- **Symptom**: Modern APIs undefined
- **Cause**: Chrome version too old
- **Fix**: Update Chrome version (use recent preset like win11-chrome121)

---

## Testing & Validation

### How to Test a Single Vector

1. **Open Detection Dashboard**
   - Navigate to "Detection Testing"
   - Select your profile
   - Click "Run Test"

2. **View Results**
   - Expand the failing category
   - Find the vector name
   - Click "Fix" button to open Fingerprint Editor

3. **Make Changes**
   - Adjust the relevant setting
   - Save fingerprint
   - Re-run detection test

4. **Verify**
   - Vector should now show ✅ PASS
   - Overall score should improve

### Performance Tips

- **Timeout**: Each vector has 5s timeout, entire test 30s max
- **Batch testing**: Test 5-10 profiles at once for efficiency
- **Caching**: Results cached locally; export for analysis

---

## Additional Resources

- **Fingerprint Editor Guide**: `docs/FINGERPRINT_EDITOR.md` (detailed UI guide)
- **CDP Evasion Techniques**: `src/main/fingerprint/cdp-evasion.ts` (implementation details)
- **Detection Presets**: `src/main/fingerprint/presets.ts` (11 built-in presets)
- **Vector Implementation**: `src/main/detection-test.ts` (test code for each vector)

---

## FAQ

**Q: Why do some vectors fail even though my browser looks normal?**  
A: Detection vectors check deep browser APIs that users never interact with. These are specifically chosen by bot detection services.

**Q: Can I just ignore failed vectors?**  
A: No. Each failed vector increases detection risk by ~2-3%. A profile with 5 failed vectors is 10-15% more likely to be detected.

**Q: What's the minimum passing score?**  
A: 
- ✅ **90%+**: Safe for most sites
- ⚠️ **70-89%**: Works for many sites, risk with advanced detection
- ❌ **<70%**: High detection risk, likely to be blocked

**Q: How often should I test a profile?**  
A: Test after:
- Creating new profile
- Updating fingerprint settings
- Updating Chrome version
- Before high-value activities

---

**Last Updated**: 2026-04-08  
**Maintained By**: Ghost Browser Team  
**Feedback**: Report detection issues to #detection channel
