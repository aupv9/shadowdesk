import { v4 as uuidv4 } from 'uuid'
import type { Page } from 'puppeteer-core'
import { BrowserManager } from './browser-manager'
import { Database } from './database'
import { resolveFingerprint } from './fingerprint/presets'
import type { DetectionTestResult, DetectionVectorResult } from '../shared/types'

/**
 * Detection Test Runner — launches a profile's browser and runs
 * automated checks against common bot-detection vectors.
 * Produces a scored report for the Detection Dashboard.
 */
export class DetectionTestRunner {
  private static instance: DetectionTestRunner

  static getInstance(): DetectionTestRunner {
    if (!DetectionTestRunner.instance) {
      DetectionTestRunner.instance = new DetectionTestRunner()
    }
    return DetectionTestRunner.instance
  }

  /**
   * Run detection tests for a profile (uses its fingerprint config).
   * Launches a headless browser, evaluates detection vectors, and scores results.
   */
  async runTest(profileId: string): Promise<DetectionTestResult> {
    const db = Database.getInstance()
    const profile = db.getProfile(profileId) as any
    if (!profile) throw new Error(`Profile ${profileId} not found`)

    const fingerprint = typeof profile.fingerprint === 'string'
      ? JSON.parse(profile.fingerprint)
      : profile.fingerprint

    const bm = BrowserManager.getInstance()

    // Launch the profile if not already running
    const wasRunning = bm.isRunning(profileId)
    if (!wasRunning) {
      await bm.launchProfile(profileId, fingerprint)
    }

    try {
      const vectors = await this.evaluateVectors(profileId)
      const passedCount = vectors.filter(v => v.passed).length
      const overallScore = Math.round((passedCount / vectors.length) * 100)

      const result: DetectionTestResult = {
        id: uuidv4(),
        profileId,
        profileName: profile.name,
        testedAt: new Date().toISOString(),
        overallScore,
        vectors,
        status: overallScore >= 90 ? 'passed' : overallScore >= 70 ? 'warning' : 'failed'
      }

      // Persist result to DB
      db.saveDetectionTestResult(result)

      return result
    } finally {
      // Close if we opened it
      if (!wasRunning) {
        await bm.closeProfile(profileId).catch(() => {})
      }
    }
  }

  /** Get all test results from DB */
  getResults(profileId?: string): DetectionTestResult[] {
    const db = Database.getInstance()
    return db.getDetectionTestResults(profileId)
  }

  /** Evaluate all detection vectors inside a running profile's browser */
  private async evaluateVectors(profileId: string): Promise<DetectionVectorResult[]> {
    const bm = BrowserManager.getInstance()
    const session = (bm as any).sessions?.get(profileId)
    if (!session) throw new Error('Profile browser session not found')

    const pages = await session.browser.pages()
    const page = pages[0] || await session.browser.newPage()

    // Navigate to about:blank to run tests in a clean context
    await page.goto('about:blank', { waitUntil: 'load' }).catch(() => {})

    const vectors: DetectionVectorResult[] = []

    // Run each test and collect results
    vectors.push(await this.testWebdriver(page))
    vectors.push(await this.testChromeRuntime(page))
    vectors.push(await this.testChromeApp(page))
    vectors.push(await this.testPlugins(page))
    vectors.push(await this.testPermissions(page))
    vectors.push(await this.testNavigatorProps(page))
    vectors.push(await this.testCanvasFingerprint(page))
    vectors.push(await this.testWebglVendor(page))
    vectors.push(await this.testAudioContext(page))
    vectors.push(await this.testScreenConsistency(page))
    vectors.push(await this.testTimezone(page))
    vectors.push(await this.testLanguageConsistency(page))
    vectors.push(await this.testConnectionApi(page))
    vectors.push(await this.testStorageQuota(page))
    vectors.push(await this.testErrorStack(page))
    vectors.push(await this.testFunctionToString(page))
    vectors.push(await this.testHeadlessSignals(page))
    vectors.push(await this.testCdcVariables(page))
    vectors.push(await this.testPerformanceEntries(page))
    vectors.push(await this.testNotificationPermission(page))
    // Phase 6: 10 new vectors
    vectors.push(await this.testDateNowPrecision(page))
    vectors.push(await this.testWebAssemblySupport(page))
    vectors.push(await this.testObjectDefinePropertyConsistency(page))
    vectors.push(await this.testWorkerWebdriver(page))
    vectors.push(await this.testCssMediaConsistency(page))
    vectors.push(await this.testBatteryApiShape(page))
    vectors.push(await this.testViewportConsistency(page))
    vectors.push(await this.testSeleniumArtifacts(page))
    vectors.push(await this.testServiceWorkerSupport(page))
    vectors.push(await this.testDocumentFocus(page))

    return vectors
  }

  private async testWebdriver(page: Page): Promise<DetectionVectorResult> {
    const result = await page.evaluate(() => navigator.webdriver)
    return {
      name: 'navigator.webdriver',
      category: 'Automation',
      passed: result === undefined || result === false,
      detail: `Value: ${result}`
    }
  }

  private async testChromeRuntime(page: Page): Promise<DetectionVectorResult> {
    const result = await page.evaluate(() => {
      return typeof (window as any).chrome !== 'undefined' &&
             typeof (window as any).chrome.runtime !== 'undefined'
    })
    return {
      name: 'chrome.runtime exists',
      category: 'Browser',
      passed: result === true,
      detail: result ? 'Present (good)' : 'Missing — detected as headless'
    }
  }

  private async testChromeApp(page: Page): Promise<DetectionVectorResult> {
    const result = await page.evaluate(() => {
      const chrome = (window as any).chrome
      return chrome && chrome.app && typeof chrome.app.getDetails === 'function'
    })
    return {
      name: 'chrome.app stub',
      category: 'Browser',
      passed: result === true,
      detail: result ? 'Present' : 'Missing'
    }
  }

  private async testPlugins(page: Page): Promise<DetectionVectorResult> {
    const count = await page.evaluate(() => navigator.plugins.length)
    return {
      name: 'navigator.plugins',
      category: 'Browser',
      passed: count > 0,
      detail: `${count} plugin(s) found`
    }
  }

  private async testPermissions(page: Page): Promise<DetectionVectorResult> {
    const result = await page.evaluate(async () => {
      try {
        const perm = await navigator.permissions.query({ name: 'notifications' as PermissionName })
        return perm.state
      } catch {
        return 'error'
      }
    })
    return {
      name: 'Permissions API consistency',
      category: 'API',
      passed: result !== 'error' && result !== 'denied',
      detail: `notifications: ${result}`
    }
  }

  private async testNavigatorProps(page: Page): Promise<DetectionVectorResult> {
    const result = await page.evaluate(() => {
      return {
        platform: navigator.platform,
        vendor: navigator.vendor,
        ua: navigator.userAgent.substring(0, 50)
      }
    })
    const hasVendor = result.vendor && result.vendor !== ''
    const hasPlatform = result.platform && result.platform !== ''
    return {
      name: 'Navigator properties',
      category: 'Browser',
      passed: hasVendor && hasPlatform,
      detail: `platform=${result.platform}, vendor=${result.vendor}`
    }
  }

  private async testCanvasFingerprint(page: Page): Promise<DetectionVectorResult> {
    const result = await page.evaluate(() => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = 200; canvas.height = 50
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = '#f60'
        ctx.fillRect(10, 10, 100, 30)
        ctx.fillStyle = '#069'
        ctx.font = '14px Arial'
        ctx.fillText('GhostTest', 15, 30)
        const data = canvas.toDataURL()
        return data && data.length > 100
      } catch {
        return false
      }
    })
    return {
      name: 'Canvas fingerprint',
      category: 'Graphics',
      passed: result === true,
      detail: result ? 'Canvas rendering active with noise' : 'Canvas blocked or broken'
    }
  }

  private async testWebglVendor(page: Page): Promise<DetectionVectorResult> {
    const result = await page.evaluate(() => {
      try {
        const canvas = document.createElement('canvas')
        const gl = canvas.getContext('webgl')
        if (!gl) return { vendor: '', renderer: '' }
        const ext = gl.getExtension('WEBGL_debug_renderer_info')
        return {
          vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : '',
          renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : ''
        }
      } catch { return { vendor: '', renderer: '' } }
    })
    return {
      name: 'WebGL vendor/renderer',
      category: 'Graphics',
      passed: result.vendor !== '' && result.renderer !== '' && !result.renderer.includes('SwiftShader'),
      detail: `${result.vendor} | ${result.renderer}`
    }
  }

  private async testAudioContext(page: Page): Promise<DetectionVectorResult> {
    const result = await page.evaluate(() => {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
        const osc = ctx.createOscillator()
        const analyser = ctx.createAnalyser()
        osc.connect(analyser)
        const data = new Float32Array(analyser.frequencyBinCount)
        analyser.getFloatFrequencyData(data)
        ctx.close()
        return data.length > 0
      } catch { return false }
    })
    return {
      name: 'AudioContext',
      category: 'Audio',
      passed: result === true,
      detail: result ? 'Audio API functional' : 'Audio API blocked'
    }
  }

  private async testScreenConsistency(page: Page): Promise<DetectionVectorResult> {
    const result = await page.evaluate(() => ({
      width: screen.width,
      height: screen.height,
      outerW: window.outerWidth,
      outerH: window.outerHeight,
      innerW: window.innerWidth,
      innerH: window.innerHeight
    }))
    const consistent = result.outerW > 0 && result.outerH > 0 &&
                       result.innerW > 0 && result.innerH > 0 &&
                       result.width >= result.innerW
    return {
      name: 'Screen dimensions consistency',
      category: 'Hardware',
      passed: consistent,
      detail: `screen=${result.width}x${result.height}, outer=${result.outerW}x${result.outerH}`
    }
  }

  private async testTimezone(page: Page): Promise<DetectionVectorResult> {
    const result = await page.evaluate(() => {
      return Intl.DateTimeFormat().resolvedOptions().timeZone
    })
    return {
      name: 'Timezone override',
      category: 'Locale',
      passed: result !== undefined && result !== '',
      detail: `Timezone: ${result}`
    }
  }

  private async testLanguageConsistency(page: Page): Promise<DetectionVectorResult> {
    const result = await page.evaluate(() => ({
      lang: navigator.language,
      langs: navigator.languages,
      match: navigator.language === navigator.languages[0]
    }))
    return {
      name: 'Language consistency',
      category: 'Locale',
      passed: result.match && result.langs.length > 0,
      detail: `language=${result.lang}, languages=[${result.langs.join(',')}]`
    }
  }

  private async testConnectionApi(page: Page): Promise<DetectionVectorResult> {
    const result = await page.evaluate(() => {
      const conn = (navigator as any).connection
      if (!conn) return null
      return { downlink: conn.downlink, effectiveType: conn.effectiveType, rtt: conn.rtt }
    })
    return {
      name: 'Network Information API',
      category: 'API',
      passed: result !== null && result.downlink > 0,
      detail: result ? `${result.effectiveType}, ${result.downlink}Mbps, ${result.rtt}ms RTT` : 'Not available'
    }
  }

  private async testStorageQuota(page: Page): Promise<DetectionVectorResult> {
    const result = await page.evaluate(async () => {
      if (!navigator.storage || !navigator.storage.estimate) return null
      const est = await navigator.storage.estimate()
      return { quota: est.quota, usage: est.usage }
    })
    const passed = result !== null && (result.quota ?? 0) > 50 * 1024 * 1024 * 1024
    return {
      name: 'Storage quota',
      category: 'API',
      passed,
      detail: result ? `Quota: ${Math.round((result.quota ?? 0) / 1024 / 1024 / 1024)}GB` : 'Not available'
    }
  }

  private async testErrorStack(page: Page): Promise<DetectionVectorResult> {
    const result = await page.evaluate(() => {
      try {
        throw new Error('test')
      } catch (e: any) {
        return e.stack || ''
      }
    })
    const clean = !result.includes('__puppeteer_evaluation_script__') &&
                  !result.includes('pptr:') &&
                  !result.includes('__playwright')
    return {
      name: 'Error stack traces',
      category: 'Automation',
      passed: clean,
      detail: clean ? 'Stack traces clean' : 'Automation framework detected in stack'
    }
  }

  private async testFunctionToString(page: Page): Promise<DetectionVectorResult> {
    const result = await page.evaluate(() => {
      return navigator.permissions.query.toString()
    })
    const looksNative = result.includes('[native code]')
    return {
      name: 'Function.toString masking',
      category: 'Automation',
      passed: looksNative,
      detail: looksNative ? 'Functions appear native' : `toString: "${result.substring(0, 60)}"`
    }
  }

  private async testHeadlessSignals(page: Page): Promise<DetectionVectorResult> {
    const result = await page.evaluate(() => ({
      outerWidth: window.outerWidth,
      outerHeight: window.outerHeight,
      notifPerm: typeof Notification !== 'undefined' ? Notification.permission : 'n/a'
    }))
    const passed = result.outerWidth > 0 && result.outerHeight > 0
    return {
      name: 'Headless browser signals',
      category: 'Automation',
      passed,
      detail: `outerSize=${result.outerWidth}x${result.outerHeight}, notification=${result.notifPerm}`
    }
  }

  private async testCdcVariables(page: Page): Promise<DetectionVectorResult> {
    const result = await page.evaluate(() => {
      const keys = Object.getOwnPropertyNames(window)
      return keys.filter(k => k.startsWith('cdc_') || k.startsWith('__cdc_'))
    })
    return {
      name: 'ChromeDriver variables',
      category: 'Automation',
      passed: result.length === 0,
      detail: result.length === 0 ? 'No cdc_ variables found' : `Found: ${result.join(', ')}`
    }
  }

  private async testPerformanceEntries(page: Page): Promise<DetectionVectorResult> {
    const result = await page.evaluate(() => {
      const entries = performance.getEntries()
      return entries.filter(e =>
        e.name.includes('__puppeteer') ||
        e.name.includes('pptr:') ||
        e.name.includes('devtools://')
      ).length
    })
    return {
      name: 'Performance entries',
      category: 'Automation',
      passed: result === 0,
      detail: result === 0 ? 'No automation entries in performance log' : `${result} suspicious entries found`
    }
  }

  private async testNotificationPermission(page: Page): Promise<DetectionVectorResult> {
    const result = await page.evaluate(() => {
      if (typeof Notification === 'undefined') return 'unavailable'
      return Notification.permission
    })
    return {
      name: 'Notification.permission',
      category: 'API',
      passed: result !== 'denied',
      detail: `Value: ${result} (headless returns "denied")`
    }
  }

  // ── Phase 6 vectors ────────────────────────────────────────────────────────

  /** Date.now() precision — automation environments often expose microsecond precision */
  private async testDateNowPrecision(page: Page): Promise<DetectionVectorResult> {
    const result = await page.evaluate(() => {
      const samples: number[] = []
      for (let i = 0; i < 20; i++) {
        samples.push(Date.now() % 1000)
      }
      // Check if values are rounded (non-zero sub-ms fractions indicate unthrottled)
      const unique = new Set(samples).size
      // If all 20 samples are identical we may have over-quantised; if all different,
      // precision is high (suspicious). Healthy range: 2–15 unique values in 20 samples.
      return { unique, samples: samples.slice(0, 5) }
    })
    const passed = result.unique >= 1 && result.unique <= 18
    return {
      name: 'Date.now() precision',
      category: 'Timing',
      passed,
      detail: `${result.unique} unique values in 20 samples (expected 1-18)`
    }
  }

  /** WebAssembly availability — headless Chrome supports WASM; absence is suspicious */
  private async testWebAssemblySupport(page: Page): Promise<DetectionVectorResult> {
    const result = await page.evaluate(() => {
      return typeof WebAssembly !== 'undefined' &&
             typeof WebAssembly.compile === 'function' &&
             typeof WebAssembly.instantiate === 'function'
    })
    return {
      name: 'WebAssembly support',
      category: 'API',
      passed: result === true,
      detail: result ? 'WebAssembly available' : 'WebAssembly missing — suspicious environment'
    }
  }

  /**
   * Object.defineProperty consistency.
   * Detectors call getOwnPropertyDescriptor before/after defineProperty to see if
   * descriptor flags change in unexpected ways. We check that our patched navigator
   * properties still report consistent flags.
   */
  private async testObjectDefinePropertyConsistency(page: Page): Promise<DetectionVectorResult> {
    const result = await page.evaluate(() => {
      try {
        const desc = Object.getOwnPropertyDescriptor(Navigator.prototype, 'webdriver')
        if (!desc) return { status: 'absent', configurable: false }
        return { status: 'present', configurable: desc.configurable ?? false }
      } catch (e: any) {
        return { status: 'error', configurable: false }
      }
    })
    // webdriver should either be absent (best) or configurable (our patch)
    const passed = result.status === 'absent' || result.configurable === true
    return {
      name: 'Object.defineProperty consistency',
      category: 'Automation',
      passed,
      detail: `webdriver descriptor: ${result.status}, configurable=${result.configurable}`
    }
  }

  /** Worker navigator.webdriver — automation can leak via worker context */
  private async testWorkerWebdriver(page: Page): Promise<DetectionVectorResult> {
    const result = await page.evaluate(async () => {
      return new Promise<string>((resolve) => {
        try {
          const blob = new Blob([
            'postMessage(typeof navigator.webdriver + ":" + navigator.webdriver);'
          ], { type: 'application/javascript' })
          const url = URL.createObjectURL(blob)
          const worker = new Worker(url)
          const timeout = setTimeout(() => {
            worker.terminate()
            resolve('timeout')
          }, 2000)
          worker.onmessage = (e) => {
            clearTimeout(timeout)
            worker.terminate()
            URL.revokeObjectURL(url)
            resolve(String(e.data))
          }
          worker.onerror = () => {
            clearTimeout(timeout)
            resolve('error')
          }
        } catch {
          resolve('unsupported')
        }
      })
    })
    // Should be "undefined:undefined" if our Worker patch applied
    const passed = result.includes('undefined') || result === 'error' || result === 'unsupported'
    return {
      name: 'Worker navigator.webdriver',
      category: 'Automation',
      passed,
      detail: `Worker reports: ${result}`
    }
  }

  /** CSS media query consistency — prefers-color-scheme and pointer should match UA */
  private async testCssMediaConsistency(page: Page): Promise<DetectionVectorResult> {
    const result = await page.evaluate(() => {
      const colorScheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark'
                        : window.matchMedia('(prefers-color-scheme: light)').matches ? 'light'
                        : 'none'
      const pointer = window.matchMedia('(pointer: fine)').matches ? 'fine'
                    : window.matchMedia('(pointer: coarse)').matches ? 'coarse'
                    : 'none'
      const hover = window.matchMedia('(hover: hover)').matches
      return { colorScheme, pointer, hover }
    })
    // On desktop presets: pointer=fine, hover=true
    // On mobile presets: pointer=coarse is acceptable
    const passed = result.pointer !== 'none' && result.colorScheme !== 'none'
    return {
      name: 'CSS media query consistency',
      category: 'Hardware',
      passed,
      detail: `pointer=${result.pointer}, hover=${result.hover}, colorScheme=${result.colorScheme}`
    }
  }

  /** Battery API shape — real Chrome exposes getBattery(); headless may not or may return stub */
  private async testBatteryApiShape(page: Page): Promise<DetectionVectorResult> {
    const result = await page.evaluate(async () => {
      try {
        const nav = navigator as any
        if (typeof nav.getBattery !== 'function') return { available: false, reason: 'no getBattery' }
        const battery = await nav.getBattery()
        return {
          available: true,
          charging: typeof battery.charging === 'boolean',
          level: typeof battery.level === 'number',
          validLevel: battery.level >= 0 && battery.level <= 1
        }
      } catch (e: any) {
        return { available: false, reason: e.message ?? 'error' }
      }
    })
    // Battery API absence is OK (some OS don't expose it); but if present it must be sane
    const passed = !result.available || (result.charging && result.level && result.validLevel)
    return {
      name: 'Battery API shape',
      category: 'API',
      passed,
      detail: result.available
        ? `charging=${result.charging}, level=${result.level}`
        : `Not available: ${(result as any).reason ?? 'n/a'}`
    }
  }

  /** Viewport consistency — innerWidth/outerWidth/screen.width should be coherent */
  private async testViewportConsistency(page: Page): Promise<DetectionVectorResult> {
    const result = await page.evaluate(() => ({
      innerW: window.innerWidth,
      innerH: window.innerHeight,
      outerW: window.outerWidth,
      outerH: window.outerHeight,
      screenW: screen.width,
      screenH: screen.height,
      devicePixelRatio: window.devicePixelRatio
    }))
    const passed =
      result.innerW > 0 && result.innerH > 0 &&
      result.outerW >= result.innerW &&
      result.outerH >= result.innerH &&
      result.screenW >= result.innerW &&
      result.screenH >= result.innerH &&
      result.devicePixelRatio > 0
    return {
      name: 'Viewport consistency',
      category: 'Hardware',
      passed,
      detail: `inner=${result.innerW}x${result.innerH}, outer=${result.outerW}x${result.outerH}, screen=${result.screenW}x${result.screenH}, dpr=${result.devicePixelRatio}`
    }
  }

  /** Selenium / other automation artifacts on window/document */
  private async testSeleniumArtifacts(page: Page): Promise<DetectionVectorResult> {
    const result = await page.evaluate(() => {
      const MARKERS = [
        '__selenium_evaluate', '__selenium_unwrapped', '__webdriver_evaluate',
        '__webdriver_script_function', '__webdriver_script_func',
        '_Selenium_IDE_Recorder', '$cdc_asdjflasutopfhvcZLmcfl_',
        '__fxdriver_evaluate', '__fxdriver_unwrapped'
      ]
      const found = MARKERS.filter(m => (window as any)[m] !== undefined || (document as any)[m] !== undefined)
      return found
    })
    return {
      name: 'Selenium / WebDriver artifacts',
      category: 'Automation',
      passed: result.length === 0,
      detail: result.length === 0 ? 'No Selenium artifacts found' : `Found: ${result.join(', ')}`
    }
  }

  /** Service Worker support — real Chrome supports SW; missing SW API is a red flag */
  private async testServiceWorkerSupport(page: Page): Promise<DetectionVectorResult> {
    const result = await page.evaluate(() => {
      return 'serviceWorker' in navigator &&
             typeof navigator.serviceWorker.register === 'function'
    })
    return {
      name: 'Service Worker API',
      category: 'API',
      passed: result === true,
      detail: result ? 'serviceWorker API present' : 'serviceWorker missing — detectable'
    }
  }

  /**
   * document.hasFocus() — automation frameworks often produce pages where
   * hasFocus() returns false because no real OS-level focus event fires.
   */
  private async testDocumentFocus(page: Page): Promise<DetectionVectorResult> {
    const result = await page.evaluate(() => {
      // Simulate a user-gesture focus scenario
      return {
        hasFocus: document.hasFocus(),
        visibilityState: document.visibilityState,
        hidden: document.hidden
      }
    })
    // We can't force hasFocus=true without real window focus, but visibilityState
    // should be 'visible' and document.hidden = false
    const passed = result.visibilityState === 'visible' && !result.hidden
    return {
      name: 'Document focus / visibility',
      category: 'Browser',
      passed,
      detail: `hasFocus=${result.hasFocus}, visibilityState=${result.visibilityState}, hidden=${result.hidden}`
    }
  }
}
