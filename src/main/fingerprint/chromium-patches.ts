import type { ChromiumPatch, ChromiumPatchStatus } from '../../shared/types'

/**
 * Phase 8 — Chromium Patch Manager
 *
 * Maintains a registry of anti-detect patches at three implementation levels:
 *   1. js-shim        — pure JS override, active for all profiles
 *   2. cdp-override   — applied via Chrome DevTools Protocol
 *   3. requires-build — needs a custom Chromium fork (Phase 8 roadmap item)
 *
 * The manager provides the UI with a complete catalog so users can see exactly
 * what is protected and what still requires a custom Chromium build.
 */

const PATCH_CATALOG: ChromiumPatch[] = [
  // ── JS Shims (Layers 1-3, now fully active) ───────────────────────────────

  {
    id: 'nav-webdriver',
    name: 'navigator.webdriver removal',
    description: 'Hides the navigator.webdriver property that Chromium sets to true in automated sessions.',
    category: 'automation',
    level: 'js-shim',
    active: true,
    impact: 'high',
    technicalNote: 'Overrides Navigator.prototype.webdriver via Object.defineProperty with getter returning undefined.'
  },
  {
    id: 'nav-plugins',
    name: 'Plugin list spoofing',
    description: 'Replaces the empty plugin list Chromium exposes in headless mode with a realistic set of plugins.',
    category: 'fingerprint',
    level: 'js-shim',
    active: true,
    impact: 'medium',
    technicalNote: 'Overrides PluginArray via Navigator.prototype.plugins getter.'
  },
  {
    id: 'canvas-noise',
    name: 'Canvas pixel noise',
    description: 'Injects deterministic per-profile noise into Canvas toDataURL/toBlob/getImageData output.',
    category: 'fingerprint',
    level: 'js-shim',
    active: true,
    impact: 'high',
    technicalNote: 'Wraps HTMLCanvasElement.prototype methods; noise is seeded from profile UUID hash.'
  },
  {
    id: 'webgl-vendor',
    name: 'WebGL vendor/renderer override',
    description: 'Replaces UNMASKED_VENDOR_WEBGL and UNMASKED_RENDERER_WEBGL with preset GPU strings.',
    category: 'fingerprint',
    level: 'js-shim',
    active: true,
    impact: 'high',
    technicalNote: 'Intercepts WebGLRenderingContext.getParameter for extension constants.'
  },
  {
    id: 'audio-noise',
    name: 'AudioContext noise injection',
    description: 'Adds deterministic noise to AudioContext analyser output and oscillator data.',
    category: 'fingerprint',
    level: 'js-shim',
    active: true,
    impact: 'medium',
    technicalNote: 'Wraps AnalyserNode.getFloatFrequencyData and OscillatorNode.start.'
  },
  {
    id: 'webrtc-leak',
    name: 'WebRTC IP leak prevention',
    description: 'Disables WebRTC local IP exposure and spoofs the mDNS hostname.',
    category: 'network',
    level: 'js-shim',
    active: true,
    impact: 'high',
    technicalNote: 'Intercepts RTCPeerConnection ICE candidate gathering and filters srflx/host candidates.'
  },
  {
    id: 'font-whitelist',
    name: 'Font enumeration whitelist',
    description: 'Restricts document.fonts.check() to a preset whitelist, preventing font enumeration.',
    category: 'fingerprint',
    level: 'js-shim',
    active: true,
    impact: 'medium',
    technicalNote: 'Overrides FontFaceSet.prototype.check with a whitelist lookup.'
  },
  {
    id: 'clientrects-noise',
    name: 'ClientRects precision noise',
    description: 'Adds sub-pixel noise to Element.getClientRects() and getBoundingClientRect().',
    category: 'fingerprint',
    level: 'js-shim',
    active: true,
    impact: 'low',
    technicalNote: 'Wraps DOMRect properties with seeded PRNG noise (±0.5px).'
  },
  {
    id: 'storage-quota',
    name: 'Storage quota spoofing',
    description: 'Reports a realistic 50 GB storage quota instead of the real (often smaller) disk size.',
    category: 'fingerprint',
    level: 'js-shim',
    active: true,
    impact: 'low',
    technicalNote: 'Intercepts navigator.storage.estimate() via Promise wrapper.'
  },
  {
    id: 'network-info',
    name: 'Network Information API spoofing',
    description: 'Spoofs navigator.connection with realistic effectiveType, downlink, and RTT values.',
    category: 'network',
    level: 'js-shim',
    active: true,
    impact: 'low',
    technicalNote: 'Defines navigator.connection via Object.defineProperty with preset values.'
  },
  {
    id: 'behavior-sim',
    name: 'Behaviour simulation (mouse/keyboard/scroll)',
    description: 'Injects micro-jitter into pointer events, typing cadence noise, and scroll inertia.',
    category: 'automation',
    level: 'js-shim',
    active: true,
    impact: 'medium',
    technicalNote: 'Event listener wrappers using seeded Gaussian PRNG applied to event coordinates/timestamps.'
  },
  {
    id: 'timing-quantize',
    name: 'Timing API quantization',
    description: 'Quantizes Date.now(), performance.now(), and requestAnimationFrame timestamps to reduce timing precision.',
    category: 'timing',
    level: 'js-shim',
    active: true,
    impact: 'medium',
    technicalNote: 'Overrides Date.now and performance.now to round to configured precision blocks (50/100/250 ms).'
  },

  // ── CDP Overrides (Layer 2) ───────────────────────────────────────────────

  {
    id: 'cdp-ua-override',
    name: 'CDP User-Agent override',
    description: 'Sets User-Agent string, platform, and accept-language at the CDP Emulation layer.',
    category: 'fingerprint',
    level: 'cdp-override',
    active: true,
    impact: 'high',
    technicalNote: 'Uses Emulation.setUserAgentOverride CDP command before page navigation.'
  },
  {
    id: 'cdp-timezone',
    name: 'CDP Timezone override',
    description: 'Forces the browser to report a specific IANA timezone via CDP.',
    category: 'locale',
    level: 'cdp-override',
    active: true,
    impact: 'medium',
    technicalNote: 'Uses Emulation.setTimezoneOverride CDP command.'
  },
  {
    id: 'cdp-chrome-runtime',
    name: 'chrome.runtime stub',
    description: 'Injects a realistic chrome.runtime, chrome.app, chrome.loadTimes, and chrome.csi stub.',
    category: 'automation',
    level: 'cdp-override',
    active: true,
    impact: 'high',
    technicalNote: 'Injected via evaluateOnNewDocument before page scripts run.'
  },
  {
    id: 'cdp-error-stack',
    name: 'Error stack trace sanitization',
    description: 'Removes Puppeteer/Playwright script references from Error.stack output.',
    category: 'automation',
    level: 'cdp-override',
    active: true,
    impact: 'medium',
    technicalNote: 'Overrides Error.prepareStackTrace and Error.prototype.stack getter.'
  },
  {
    id: 'cdp-worker-nav',
    name: 'Worker navigator.webdriver patch',
    description: 'Patches navigator.webdriver inside Worker contexts via blob URL injection.',
    category: 'automation',
    level: 'cdp-override',
    active: true,
    impact: 'high',
    technicalNote: 'Wraps window.Worker constructor to prepend a webdriver patch via importScripts.'
  },
  {
    id: 'cdp-blink-mask',
    name: 'Blink internals masking',
    description: 'Deletes Selenium/WebDriver leak markers from window and document.',
    category: 'automation',
    level: 'cdp-override',
    active: true,
    impact: 'high',
    technicalNote: 'Iterates MASK list and deletes props; wraps window in a Proxy to intercept future access.'
  },

  // ── Phase 8: New JS Shims ─────────────────────────────────────────────────

  {
    id: 'intl-locale-norm',
    name: 'Intl API locale normalization',
    description: 'Normalizes Intl.DateTimeFormat, NumberFormat, and Collator to consistently report the spoofed locale.',
    category: 'locale',
    level: 'js-shim',
    active: true,
    impact: 'medium',
    technicalNote: 'Wraps Intl constructors to override resolvedOptions().locale and timeZone.'
  },
  {
    id: 'uach-spoof',
    name: 'User-Agent Client Hints (UACH) spoofing',
    description: 'Patches navigator.userAgentData.getHighEntropyValues() to return values consistent with the spoofed UA.',
    category: 'fingerprint',
    level: 'js-shim',
    active: true,
    impact: 'high',
    technicalNote: 'Replaces navigator.userAgentData with a stub derived from the fingerprint BrowserConfig/OsConfig.'
  },
  {
    id: 'webgpu-stub',
    name: 'WebGPU adapter info spoofing',
    description: 'Patches navigator.gpu.requestAdapterInfo() to return GPU info consistent with WebGL vendor/renderer.',
    category: 'gpu',
    level: 'js-shim',
    active: true,
    impact: 'medium',
    technicalNote: 'Wraps navigator.gpu.requestAdapter to patch the returned adapter requestAdapterInfo method.'
  },
  {
    id: 'uach-cdp',
    name: 'UACH CDP-level override',
    description: 'Sets User-Agent Client Hints at the CDP Emulation layer for HTTP headers.',
    category: 'fingerprint',
    level: 'cdp-override',
    active: true,
    impact: 'high',
    technicalNote: 'Uses Emulation.setUserAgentOverride with userAgentMetadata parameter.'
  },

  // ── Requires Custom Chromium Build ────────────────────────────────────────

  {
    id: 'cpp-v8-symbols',
    name: 'V8 internal symbol removal',
    description: 'Removes V8 runtime symbols exposed by the Chromium DevTools protocol that reveal automation context.',
    category: 'automation',
    level: 'requires-build',
    active: false,
    impact: 'high',
    technicalNote: 'Requires patching v8/src/inspector/v8-debugger.cc to suppress automation-specific symbols.'
  },
  {
    id: 'cpp-gpu-process',
    name: 'GPU process vendor string patch',
    description: 'Patches the Chromium GPU process to return spoofed adapter info at the native GpuInit layer.',
    category: 'gpu',
    level: 'requires-build',
    active: false,
    impact: 'high',
    technicalNote: 'Requires patching gpu/config/gpu_info_collector.cc to override GL_VENDOR/GL_RENDERER.'
  },
  {
    id: 'cpp-canvas-gpu',
    name: 'GPU-accelerated canvas noise (native)',
    description: 'Applies canvas noise at the GPU compositing layer, bypassing JS-level detection of software rendering.',
    category: 'fingerprint',
    level: 'requires-build',
    active: false,
    impact: 'high',
    technicalNote: 'Requires patching cc/paint/skia_paint_canvas.cc to inject noise before GPU raster.'
  },
  {
    id: 'cpp-font-metrics',
    name: 'Native font metrics jitter',
    description: 'Applies sub-pixel jitter to font measurement results at the Blink rendering engine level.',
    category: 'fingerprint',
    level: 'requires-build',
    active: false,
    impact: 'medium',
    technicalNote: 'Requires patching third_party/blink/renderer/platform/fonts/font_metrics.cc.'
  },
  {
    id: 'cpp-webrtc-dtls',
    name: 'WebRTC DTLS fingerprint randomization',
    description: 'Randomizes the DTLS certificate used in WebRTC SDP offers, making the fingerprint unique per session.',
    category: 'network',
    level: 'requires-build',
    active: false,
    impact: 'high',
    technicalNote: 'Requires patching third_party/webrtc/rtc_base/ssl_identity.cc certificate generation.'
  },
  {
    id: 'cpp-timing-noise',
    name: 'High-resolution timer noise (kernel)',
    description: 'Adds noise to high-resolution timers at the OS/kernel level, immune to JS-layer detection.',
    category: 'timing',
    level: 'requires-build',
    active: false,
    impact: 'high',
    technicalNote: 'Requires patching base/time/time_now_posix.cc or time_now_win.cc to add kernel-level jitter.'
  },
  {
    id: 'cpp-audio-buffer',
    name: 'Audio buffer noise (native)',
    description: 'Injects noise into audio buffers at the native WebAudio layer before JS can access them.',
    category: 'fingerprint',
    level: 'requires-build',
    active: false,
    impact: 'medium',
    technicalNote: 'Requires patching third_party/blink/renderer/modules/webaudio/audio_buffer.cc.'
  }
]

export class ChromiumPatchManager {
  private static instance: ChromiumPatchManager
  private patches: ChromiumPatch[] = PATCH_CATALOG.map(p => ({ ...p }))

  static getInstance(): ChromiumPatchManager {
    if (!ChromiumPatchManager.instance) {
      ChromiumPatchManager.instance = new ChromiumPatchManager()
    }
    return ChromiumPatchManager.instance
  }

  getStatus(): ChromiumPatchStatus {
    return {
      total:         this.patches.length,
      active:        this.patches.filter(p => p.active).length,
      jsShims:       this.patches.filter(p => p.level === 'js-shim' && p.active).length,
      cdpOverrides:  this.patches.filter(p => p.level === 'cdp-override' && p.active).length,
      requiresBuild: this.patches.filter(p => p.level === 'requires-build').length,
      patches:       this.patches
    }
  }

  getPatch(id: string): ChromiumPatch | undefined {
    return this.patches.find(p => p.id === id)
  }

  /** Returns only patches at a given level */
  getPatchesByLevel(level: ChromiumPatch['level']): ChromiumPatch[] {
    return this.patches.filter(p => p.level === level)
  }

  /** Returns only patches in a given category */
  getPatchesByCategory(category: ChromiumPatch['category']): ChromiumPatch[] {
    return this.patches.filter(p => p.category === category)
  }
}
