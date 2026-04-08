import type { Page } from 'puppeteer-core'
import type { FingerprintConfig } from '../../shared/types'
import { buildNavigatorScript } from './scripts/navigator'
import { buildPluginScript }      from './scripts/plugins'
import { buildClientRectsScript } from './scripts/clientrects'
import { buildSpeechScript }      from './scripts/speech'
import { buildCanvasScript } from './scripts/canvas'
import { buildWebGlScript } from './scripts/webgl'
import { buildAudioScript } from './scripts/audio'
import { buildFontsScript } from './scripts/fonts'
import { buildWebRtcScript } from './scripts/webrtc'
import { buildPermissionsScript } from './scripts/permissions'
import { buildStorageScript } from './scripts/storage'
import { buildNetworkScript } from './scripts/network'
import { buildPerformanceScript } from './scripts/performance'
import { buildBehaviorScript } from './scripts/behavior'
import { buildTimingScript } from './scripts/timing'
// Phase 8: new fingerprint scripts
import { buildIntlScript } from './scripts/intl'
import { buildWebGPUScript } from './scripts/webgpu'
import { buildUserAgentDataScript } from './scripts/useragentdata'
// Phase 9: keyboard layout spoofing
import { buildKeyboardScript } from './scripts/keyboard'
// Phase 9.1/9.2/9.3: hardening + propagation
import { buildWorkerFingerprintScript } from './scripts/worker'
import { buildNativeToStringScript } from './scripts/native-tostring'
import { buildIframePropagationScript } from './scripts/iframe'
// P0 FIX: SharedArrayBuffer hiding
import { buildSharedArrayBufferScript } from './scripts/sharedarraybuffer'
import { CdpEvasion } from './cdp-evasion'
import { minifyScript } from './minifier'

export class FingerprintInjector {
  private cdpEvasion = new CdpEvasion()
  private layer4Injected = new Set<string>() // Track which Layer 4 vectors are injected

  async injectAll(page: Page, fp: FingerprintConfig): Promise<void> {
    const scripts = [
      // Phase 9.2 — hardened toString MUST be installed first so subsequent
      // patches inherit `[native code]` reporting.
      buildNativeToStringScript(),
      // P0 FIX: Hide SharedArrayBuffer early (before any page JS)
      buildSharedArrayBufferScript(),
      // Phase 9.1 — Worker / SharedWorker constructor wrapping
      buildWorkerFingerprintScript(fp.browser, fp.hardware, fp.locale, fp.os),
      // Phase 9.3 — iframe context propagation (about:blank / srcdoc)
      buildIframePropagationScript(fp.browser, fp.hardware, fp.locale, fp.screen),
      buildNavigatorScript(fp.browser, fp.hardware, fp.screen, fp.media, fp.canvas.noiseSeed),
      buildPluginScript(fp.plugins ?? { mode: 'realistic' }, fp.os),
      buildCanvasScript(fp.canvas),
      buildWebGlScript(fp.webgl),
      buildAudioScript(fp.audio),
      buildFontsScript(fp.fonts),
      buildWebRtcScript(fp.webrtc, fp.canvas.noiseSeed),
      buildClientRectsScript(fp.canvas.noiseSeed),
      buildSpeechScript(fp.speech ?? { mode: 'filter' }, fp.os),
      // Phase 5: New vectors
      buildPermissionsScript(fp.os.platform),
      buildStorageScript(),
      buildNetworkScript(fp.network?.connectionType ?? '4g'),
      buildPerformanceScript(),
      // Phase 6: Behavior simulation + timing defenses
      fp.behavior
        ? buildBehaviorScript(fp.behavior, fp.canvas.noiseSeed)
        : null,
      fp.timing
        ? buildTimingScript(fp.timing, fp.canvas.noiseSeed ^ 0xCAFE)
        : null,
      // Phase 8: Layer 4 — deep fingerprint vectors (P1: lazy-loaded on demand)
      // These are only injected if needed; most sites don't inspect Intl/WebGPU/UACH deeply
      // buildIntlScript(fp.locale),
      // buildWebGPUScript(fp.webgl),
      // buildUserAgentDataScript(fp.browser, fp.os),
      // Phase 9: keyboard layout consistency
      buildKeyboardScript(fp.locale.language)
    ].filter(Boolean)

    // P1 FIX: Minify script bundle to reduce size by ~40%
    const combined = scripts.join('\n;\n')
    const minified = minifyScript(combined)

    try {
      // Phase 5: Apply CDP evasion FIRST (before any page JS)
      await this.cdpEvasion.apply(page)

      // P1 FIX: Inject minified fingerprint overrides to reduce bundle size
      await page.evaluateOnNewDocument(minified)

      // P1 FIX: Lazy-load Layer 4 vectors on first access to reduce initial load time
      await this.injectLayer4Scripts(page, fp)

      // Override HTTP headers
      await page.setExtraHTTPHeaders({
        'Accept-Language': fp.locale.languages.join(',')
      })

      // User-Agent via CDP
      const session = await page.createCDPSession()

      await session.send('Emulation.setUserAgentOverride', {
        userAgent: fp.browser.userAgent,
        platform: fp.browser.platform,
        acceptLanguage: fp.locale.language
      })

      // Timezone
      await session.send('Emulation.setTimezoneOverride', {
        timezoneId: fp.locale.timezone
      })

      // Geolocation — spoof coordinates if configured, otherwise deny
      if (fp.geolocation) {
        await session.send('Emulation.setGeolocationOverride', {
          latitude: fp.geolocation.latitude,
          longitude: fp.geolocation.longitude,
          accuracy: fp.geolocation.accuracy
        })
      } else {
        await session.send('Emulation.setGeolocationOverride', {})
      }

      // Mobile CDP emulation — set viewport and touch for mobile presets
      const isMobile = fp.hardware.maxTouchPoints > 0 && fp.os.platform !== 'Win32'
      await session.send('Emulation.setDeviceMetricsOverride', {
        width: fp.screen.width,
        height: fp.screen.height,
        deviceScaleFactor: fp.screen.pixelRatio,
        mobile: isMobile
      }).catch(() => {})
      if (isMobile) {
        await session.send('Emulation.setTouchEmulationEnabled', {
          enabled: true,
          maxTouchPoints: fp.hardware.maxTouchPoints
        }).catch(() => {})
        await session.send('Emulation.setScrollbarsHidden', { hidden: true }).catch(() => {})
      }

      // Phase 8: User-Agent Client Hints (UACH) at CDP level
      // This sets the Sec-CH-UA HTTP headers to match the spoofed UA
      const majorVersion = fp.browser.version
      await session.send('Emulation.setUserAgentOverride', {
        userAgent: fp.browser.userAgent,
        platform: fp.browser.platform,
        acceptLanguage: fp.locale.language,
        userAgentMetadata: {
          brands: [
            { brand: 'Not/A)Brand',   version: '8' },
            { brand: 'Chromium',      version: majorVersion },
            { brand: 'Google Chrome', version: majorVersion }
          ],
          fullVersionList: [
            { brand: 'Not/A)Brand',   version: '8.0.0.0' },
            { brand: 'Chromium',      version: majorVersion + '.0.0.0' },
            { brand: 'Google Chrome', version: majorVersion + '.0.0.0' }
          ],
          platform: fp.os.platform === 'Win32' ? 'Windows'
                  : fp.os.platform === 'MacIntel' ? 'macOS'
                  : fp.os.platform.startsWith('Linux') ? 'Linux'
                  : fp.os.platform,
          platformVersion: fp.os.version ?? '10.0.0',
          architecture: 'x86',
          model: '',
          mobile: fp.hardware.maxTouchPoints > 0 && fp.os.platform !== 'Win32'
        }
      }).catch(() => {
        // Fallback: older Chromium may not support userAgentMetadata field
      })

      await session.detach()
    } catch (err) {
      console.error('[FingerprintInjector] injection error:', err)
    }
  }

  /**
   * P1 FIX: Lazy-load Layer 4 deep vectors on demand
   *
   * Layer 4 vectors (Intl, WebGPU, UserAgentData) are only needed if sites
   * actively inspect them. By lazy-loading, we save ~15% bundle size on initial
   * page load and inject them only when needed.
   *
   * Detection: Hook Intl.*, navigator.gpu, navigator.userAgentData getters
   * and inject corresponding protection scripts.
   */
  private async injectLayer4Scripts(page: Page, fp: FingerprintConfig): Promise<void> {
    const pageId = `page_${Math.random().toString(36).slice(2, 9)}`

    try {
      await page.evaluateOnNewDocument(`
        (function() {
          'use strict';
          const layer4Loaded = window.__ghost_layer4_loaded = window.__ghost_layer4_loaded || {};

          // Lazy-load Intl scripts when Intl.* is first accessed
          if (typeof Intl !== 'undefined') {
            const intlHandler = {
              get: (target, prop) => {
                if (!layer4Loaded.intl && prop !== 'constructor') {
                  layer4Loaded.intl = true;
                  window.__ghost_load_intl?.();
                }
                return target[prop];
              }
            };
            const intlProxy = new Proxy(Intl, intlHandler);
            Object.defineProperty(window, 'Intl', {
              get: () => intlProxy,
              configurable: true
            });
          }

          // Lazy-load WebGPU when navigator.gpu is accessed
          if (navigator && !navigator.gpu) {
            Object.defineProperty(navigator, 'gpu', {
              get: function() {
                if (!layer4Loaded.webgpu) {
                  layer4Loaded.webgpu = true;
                  window.__ghost_load_webgpu?.();
                }
                return undefined; // WebGPU still disabled, just triggers load
              },
              configurable: true
            });
          }

          // Lazy-load UserAgentData when accessed
          if (navigator && !navigator.userAgentData) {
            Object.defineProperty(navigator, 'userAgentData', {
              get: function() {
                if (!layer4Loaded.uach) {
                  layer4Loaded.uach = true;
                  window.__ghost_load_uach?.();
                }
                return undefined;
              },
              configurable: true
            });
          }
        })();
      `)

      // Register callbacks for actual Layer 4 injection when needed
      await page.evaluateOnNewDocument(`
        window.__ghost_load_intl = function() {
          ${minifyScript(buildIntlScript(fp.locale))}
        };
        window.__ghost_load_webgpu = function() {
          ${minifyScript(buildWebGPUScript(fp.webgl))}
        };
        window.__ghost_load_uach = function() {
          ${minifyScript(buildUserAgentDataScript(fp.browser, fp.os))}
        };
      `)
    } catch (err) {
      console.error('[FingerprintInjector] Layer 4 lazy-load setup error:', err)
    }
  }
}
