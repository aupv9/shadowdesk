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

export class FingerprintInjector {
  private cdpEvasion = new CdpEvasion()

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
      // Phase 8: Layer 4 — deep fingerprint vectors
      buildIntlScript(fp.locale),
      buildWebGPUScript(fp.webgl),
      buildUserAgentDataScript(fp.browser, fp.os),
      // Phase 9: keyboard layout consistency
      buildKeyboardScript(fp.locale.language)
    ].filter(Boolean)

    const combined = scripts.join('\n;\n')

    try {
      // Phase 5: Apply CDP evasion FIRST (before any page JS)
      await this.cdpEvasion.apply(page)

      // Inject fingerprint overrides before any page JS runs
      await page.evaluateOnNewDocument(combined)

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
}
