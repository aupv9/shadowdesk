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
import { CdpEvasion } from './cdp-evasion'

export class FingerprintInjector {
  private cdpEvasion = new CdpEvasion()

  async injectAll(page: Page, fp: FingerprintConfig): Promise<void> {
    const scripts = [
      buildNavigatorScript(fp.browser, fp.hardware, fp.screen, fp.media),
      buildPluginScript(fp.plugins ?? { mode: 'realistic' }, fp.os),
      buildCanvasScript(fp.canvas),
      buildWebGlScript(fp.webgl),
      buildAudioScript(fp.audio),
      buildFontsScript(fp.fonts),
      buildWebRtcScript(fp.webrtc),
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
      buildUserAgentDataScript(fp.browser, fp.os)
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

      // Geolocation (disabled by default — prevent sites from getting location)
      await session.send('Emulation.setGeolocationOverride', {})

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
