# Fingerprint Engine

## Overview

The fingerprint engine spoofs browser identity across four implementation layers to defeat bot-detection frameworks (CreepJS, BotD, DataDome, Cloudflare, etc.).

```
Layer 1 — Core JS Fingerprint     (18 scripts, evaluateOnNewDocument)
Layer 2 — Advanced CDP Evasion    (14 methods, before page JS)
Layer 3 — Behavior + Timing       (Phase 6, optional per-profile config)
Layer 4 — Chromium C++ Patches    (30-patch catalog; JS/CDP active, native planned)
```

---

## Fingerprint Scripts (Layer 1)

All scripts are injected via `page.evaluateOnNewDocument()` before any page JavaScript runs.

### navigator.ts

Overrides the following `Navigator` properties:

| Property | Override |
|----------|---------|
| `userAgent` | preset UA string |
| `platform` | `Win32` / `MacIntel` / `Linux x86_64` / `iPhone` / `iPad` |
| `vendor` | `Google Inc.` / `` (Safari) |
| `language` | BCP-47 locale (e.g. `en-US`, `vi-VN`) |
| `languages` | locale array |
| `deviceMemory` | 1 / 2 / 4 / 8 / 16 / 32 GB |
| `hardwareConcurrency` | 2 / 4 / 6 / 8 / 12 / 16 |
| `maxTouchPoints` | 0 (desktop) / 5 (mobile) |
| `getBattery()` | stubbed BatteryManager |
| `mediaDevices.enumerateDevices()` | configurable audio in/out + video in count |
| `screen.*` | width, height, availWidth, availHeight, colorDepth, pixelRatio |

### canvas.ts

Wraps `HTMLCanvasElement.prototype`:
- `toDataURL()` / `toBlob()` — injects ±1 bit noise per pixel channel via seeded PRNG
- `getContext('2d').getImageData()` — same noise on raw pixel data
- Mode `block` — returns empty 1×1 canvas (maximum protection, breaks some sites)
- Mode `real` — passthrough (no spoofing)

### webgl.ts

- Intercepts `WebGLRenderingContext.getParameter()` for `UNMASKED_VENDOR_WEBGL` and `UNMASKED_RENDERER_WEBGL`
- Returns preset `vendor` / `renderer` strings
- Adds deterministic noise to `readPixels()` output

### audio.ts

- Wraps `AnalyserNode.getFloatFrequencyData()` and `getByteFrequencyData()` — adds ±1e-7 noise per sample
- Wraps `OscillatorNode` start/stop for consistent timing
- Seeded PRNG ensures same profile always produces the same audio fingerprint

### fonts.ts

- Overrides `document.fonts.check()` to only return `true` for fonts in the preset whitelist
- Adds sub-pixel noise (±0.01 px) to `CanvasRenderingContext2D.measureText().width`

### webrtc.ts

- Patches `RTCPeerConnection` to block `srflx` (server-reflexive) and `host` ICE candidates that expose local/public IP
- Spoofs the mDNS hostname used in `host` candidates

### clientrects.ts

- Wraps `Element.prototype.getClientRects()` and `getBoundingClientRect()`
- Adds ±0.5px seeded noise to all DOMRect `x`, `y`, `width`, `height` values

### speech.ts

- Overrides `speechSynthesis.getVoices()` to filter to a locale-matched subset
- Mode `real` — passthrough

### permissions.ts

- Wraps `navigator.permissions.query()` with 16 permission defaults:
  - `geolocation`, `notifications`, `camera`, `microphone` → `prompt`
  - `midi`, `clipboard-write`, `background-sync` → `granted`
  - etc.

### storage.ts

- Intercepts `navigator.storage.estimate()` — returns `quota: 50 GB`

### network.ts

- Defines `navigator.connection` with `effectiveType` (4g/3g/wifi/slow), `downlink`, `rtt`, `saveData`

### performance.ts

- Filters automation entries from `performance.getEntries()`
- Quantizes `performance.now()` to reduce cross-origin timing precision

### plugins.ts

- Returns a realistic `PluginArray` (Chrome PDF Plugin, Widevine, etc.) instead of the empty list Chromium exposes in headless mode

### behavior.ts *(Phase 6)*

- **Mouse jitter**: intercepts `pointermove` / `mousemove` events, adds Gaussian noise (σ = 0.3 px) to `clientX/Y`
- **Typing cadence**: randomizes `keydown` / `keyup` event timestamps ±25 ms
- **Scroll inertia**: modifies `wheel` `deltaY` to simulate natural momentum decay

All values seeded from profile UUID — identical behavior pattern per profile across sessions.

### timing.ts *(Phase 6)*

- `Date.now()` — quantized to `dateNoisePrecision` block (50 / 100 / 250 ms)
- `performance.now()` — clamped to same precision when `performanceClamp: true`
- `requestAnimationFrame` callback timestamps — ±1.2 ms jitter when `rafJitter: true`

### intl.ts *(Phase 8)*

- Patches `Intl.DateTimeFormat`, `Intl.NumberFormat`, `Intl.Collator` constructors so `resolvedOptions()` always reports the spoofed locale + timezone
- Patches `Intl.supportedValuesOf()` to return stable bounded subsets (prevents fingerprinting via list length or content)

### useragentdata.ts *(Phase 8)*

- Replaces `navigator.userAgentData` with a full stub:
  - `brands` — `[Not/A)Brand, Chromium, Google Chrome]` at the preset version
  - `mobile` — derived from `HardwareConfig.maxTouchPoints` + `OsConfig.platform`
  - `getHighEntropyValues(['platformVersion', 'architecture', 'model', ...])` — derived from preset

### webgpu.ts *(Phase 8)*

- If `navigator.gpu` absent — provides a minimal stub with correct shape
- If `navigator.gpu` present — patches `requestAdapterInfo()` to return vendor/device consistent with the WebGL renderer string

---

## CDP Evasion (Layer 2)

Applied via `page.evaluateOnNewDocument()` **before** the fingerprint scripts, plus a CDP session for protocol-level changes.

| Method | What it fixes |
|--------|--------------|
| `hideChromeDriver()` | Deletes `window.cdc_*` / `window.__cdc_*` ChromeDriver variables |
| `patchChromeRuntime()` | Creates `window.chrome.runtime`, `.app`, `.loadTimes`, `.csi` stubs |
| `hideSourceUrl()` | Strips `__puppeteer_evaluation_script__` from `Error.prepareStackTrace` |
| `patchPermissionsApi()` | 16 realistic permission defaults for `navigator.permissions.query()` |
| `patchIframeContentWindow()` | MutationObserver patches `navigator.webdriver` in injected iframes |
| `hideStackTraces()` | `Error.prototype.stack` getter filters automation stack frames |
| `patchHeadlessSignals()` | Fixes `outerWidth/Height = 0`, `Notification.permission = 'denied'` |
| `patchConsoleDebug()` | Proxy wraps `Function.prototype.toString` to return `[native code]` for patched functions |
| `patchObjectDefinePropertyTrap()` *(Phase 6)* | Normalizes `getOwnPropertyDescriptor` flags for navigator overrides |
| `patchWorkerNavigator()` *(Phase 6)* | Wraps `Worker` constructor to inject webdriver patch via blob `importScripts` |
| `maskBlinkInternals()` *(Phase 6)* | Deletes Selenium/WebDriver markers (`__selenium_*`, `__webdriver_*`, `$cdc_*`) |
| `patchMathFpu()` *(Phase 8)* | Pins `Math.sin/cos/tan/atan2` to x86 IEEE 754 reference values |
| `patchProtoChains()` *(Phase 8)* | Removes enumerable keys from `Function.prototype` / `Object.prototype` |
| `patchMediaCapabilities()` *(Phase 8)* | `decodingInfo()` always resolves `smooth: true, powerEfficient: true` |
| `patchTrustTokens()` *(Phase 8)* | Stubs `document.hasPrivateToken()` + `hasRedemptionRecord()` |

CDP session commands:
- `Page.setBypassCSP({ enabled: true })`
- `Runtime.setMaxCallStackSizeToCapture({ size: 0 })`
- `Runtime.setCustomObjectFormatterEnabled({ enabled: false })` *(Phase 8)*

---

## Built-in Presets

| Key | OS | Browser | Screen | GPU |
|-----|----|---------|--------|-----|
| `win10-chrome120` | Windows 10 | Chrome 120 | 1920×1080 | NVIDIA GTX 1660 |
| `win11-chrome121` | Windows 11 | Chrome 121 | 2560×1440 | AMD RX 6700 XT |
| `mac-ventura-chrome120` | macOS Ventura | Chrome 120 | 1440×900 | Apple M1 |
| `mac-sonoma-chrome121` | macOS Sonoma | Chrome 121 | 1512×982 | Apple M2 |
| `linux-ubuntu-chrome120` | Ubuntu 22.04 | Chrome 120 | 1920×1080 | Intel UHD 630 |
| `android-samsung-chrome120` | Android 13 (Galaxy A54) | Chrome 120 | 412×915 | Snapdragon 870 |
| `android-pixel-chrome121` | Android 14 (Pixel 7) | Chrome 121 | 412×915 | Mali-G710 |
| `android-oppo-chrome120` | Android 13 (OPPO Reno) | Chrome 120 | 393×873 | Snapdragon 870 |
| `ios-iphone14-safari17` | iOS 17.2 (iPhone 14) | Safari 17 | 390×844 | Apple A15 |
| `ios-iphone15-safari17` | iOS 17.3 (iPhone 15) | Safari 17 | 393×852 | Apple A16 |
| `ios-ipad-safari17` | iPadOS 17.2 (iPad Air) | Safari 17 | 820×1180 | Apple M1 |

`resolveFingerprint(presetKey, profileId)` deep-clones the preset and injects:
- `canvas.noiseSeed = djb2(profileId) & 0x7fffffff`
- `webgl.noiseSeed` / `audio.noiseSeed` — same seed
- Phase 6 defaults: `behavior` + `timing` configs if absent

---

## Chromium Patch Catalog (Phase 8)

30 patches tracked in `ChromiumPatchManager`:

| Level | Count | Status |
|-------|-------|--------|
| JS Shim | 14 | Active |
| CDP Override | 7 | Active |
| Requires custom Chromium build | 9 | Planned |

Planned C++ patches include:
- V8 internal symbol removal (`v8/src/inspector/v8-debugger.cc`)
- GPU process vendor override (`gpu/config/gpu_info_collector.cc`)
- Native canvas noise at GPU raster layer (`cc/paint/skia_paint_canvas.cc`)
- Native font metrics jitter (`blink/renderer/platform/fonts/font_metrics.cc`)
- WebRTC DTLS certificate randomization (`third_party/webrtc/rtc_base/ssl_identity.cc`)
- Kernel-level high-resolution timer noise (`base/time/time_now_*.cc`)
- Native audio buffer noise (`blink/renderer/modules/webaudio/audio_buffer.cc`)
