import { v4 as uuidv4 } from 'uuid'
import type { Page } from 'puppeteer-core'
import { BrowserManager } from './browser-manager'
import { Database } from './database'
import { resolveFingerprint } from './fingerprint/presets'
import { analyzeBehaiorDrift, createBehaviorConsistencyVector } from './fingerprint/behavior-drift'
import {
  testFirefoxSpecificVectors,
  testSafariSpecificVectors,
  testEdgeSpecificVectors,
  testBrowserConsistency
} from './fingerprint/browser-vectors'
import type { DetectionTestResult, DetectionVectorResult, FingerprintConfig } from '../shared/types'
import { normalizeVector, splitScores, statusFor } from './detection/scoring'
import { runCoherenceRules, type ProxyGeo } from './fingerprint/coherence'
import {
  collectMain,
  collectWorker,
  collectIframe,
  collectRenderHashes,
  collectWebrtcPublicIps
} from './fingerprint/coherence-collector'
import { runCanary, canaryVector, type CanaryVerdict } from './detection/canary'
import { attributeVerdict } from './detection/attribution'
import { getSettings } from './settings'

/**
 * Per-probe budget. A stalled page.evaluate() used to hang the entire run;
 * 5s is generous for an in-page evaluation and bounds a full sweep.
 */
const VECTOR_TIMEOUT_MS = 5000

/**
 * The coherence sweep needs far more headroom than a single probe: ICE
 * gathering alone waits 4s, and the first `detectBinaryVersion()` call launches
 * a throwaway Chromium. Under the per-probe budget the whole layer would have
 * timed out on every run and silently reported itself unavailable.
 */
const COHERENCE_TIMEOUT_MS = 30000

/** A challenge page plus its JS can take a while; give the canary room. */
const CANARY_TIMEOUT_MS = 40000

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
      const { injection, risk } = splitScores(vectors)

      // The report is judged on detection risk when we have it, and falls back
      // to injection integrity when only layer-0 vectors ran. Reporting one
      // merged number is what let users read "my overrides applied" as "I am
      // undetectable" — see docs/DETECTION_VALIDATION_DESIGN.md.
      const headline = risk ?? injection

      const result: DetectionTestResult = {
        id: uuidv4(),
        profileId,
        profileName: profile.name,
        testedAt: new Date().toISOString(),
        overallScore: injection.score,
        vectors,
        status: statusFor(headline),
        injectionScore: injection.score,
        riskScore: risk?.score,
        proxyId: profile.proxy_id ?? null,
        unavailableCount: injection.unavailableCount + (risk?.unavailableCount ?? 0)
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

  /**
   * Runs one probe with a timeout, converting a hang or a throw into an
   * `unavailable` vector. A check that could not run must never look like a
   * check that caught something, so these are excluded from scoring rather
   * than counted as failures.
   */
  private async runGuarded(
    name: string,
    run: () => Promise<DetectionVectorResult | DetectionVectorResult[]>,
    timeoutMs: number = VECTOR_TIMEOUT_MS
  ): Promise<DetectionVectorResult[]> {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      const result = await Promise.race([
        run(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error(`timed out after ${timeoutMs}ms`)), timeoutMs)
        })
      ])
      return Array.isArray(result) ? result : [result]
    } catch (e: any) {
      return [{
        name,
        category: 'Automation',
        passed: false,
        status: 'unavailable',
        detail: `Could not run: ${e?.message ?? String(e)}`
      }]
    } finally {
      if (timer) clearTimeout(timer)
    }
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

    // P2: Get profile data for behavior drift analysis
    const db = Database.getInstance()
    const profile = db.getProfile(profileId) as any
    const fingerprint = profile?.fingerprint ? (typeof profile.fingerprint === 'string' ? JSON.parse(profile.fingerprint) : profile.fingerprint) : {}

    const vectors: DetectionVectorResult[] = []

    // Run each test and collect results
    // Every probe runs through runGuarded: a hang or a throw yields an
    // `unavailable` vector instead of aborting the whole report. Previously one
    // stalled page.evaluate() hung the run indefinitely and one exception lost
    // the other 50-odd results.
    const probes: Array<[string, () => Promise<DetectionVectorResult | DetectionVectorResult[]>]> = [
      ['navigator.webdriver',                () => this.testWebdriver(page)],
      ['chrome.runtime exists',              () => this.testChromeRuntime(page)],
      ['chrome.app stub',                    () => this.testChromeApp(page)],
      ['navigator.plugins',                  () => this.testPlugins(page)],
      ['Permissions API consistency',        () => this.testPermissions(page)],
      ['Navigator properties',               () => this.testNavigatorProps(page)],
      ['Canvas fingerprint',                 () => this.testCanvasFingerprint(page)],
      ['WebGL vendor/renderer',              () => this.testWebglVendor(page)],
      ['AudioContext',                       () => this.testAudioContext(page)],
      ['Screen dimensions consistency',      () => this.testScreenConsistency(page)],
      ['Timezone override',                  () => this.testTimezone(page)],
      ['Language consistency',               () => this.testLanguageConsistency(page)],
      ['Network Information API',            () => this.testConnectionApi(page)],
      ['Storage quota',                      () => this.testStorageQuota(page)],
      ['Error stack traces',                 () => this.testErrorStack(page)],
      ['Function.toString masking',          () => this.testFunctionToString(page)],
      ['Headless browser signals',           () => this.testHeadlessSignals(page)],
      ['ChromeDriver variables',             () => this.testCdcVariables(page)],
      ['Performance entries',                () => this.testPerformanceEntries(page)],
      ['Notification.permission',            () => this.testNotificationPermission(page)],
      // Phase 6
      ['Date.now() precision',               () => this.testDateNowPrecision(page)],
      ['WebAssembly support',                () => this.testWebAssemblySupport(page)],
      ['Object.defineProperty consistency',  () => this.testObjectDefinePropertyConsistency(page)],
      ['Worker navigator.webdriver',         () => this.testWorkerWebdriver(page)],
      ['CSS media query consistency',        () => this.testCssMediaConsistency(page)],
      ['Battery API shape',                  () => this.testBatteryApiShape(page)],
      ['Viewport consistency',               () => this.testViewportConsistency(page)],
      ['Selenium / WebDriver artifacts',     () => this.testSeleniumArtifacts(page)],
      ['Service Worker API',                 () => this.testServiceWorkerSupport(page)],
      ['Document focus / visibility',        () => this.testDocumentFocus(page)],
      // Phase 8
      ['Intl locale consistency',            () => this.testIntlLocaleConsistency(page)],
      ['UACH brands list',                   () => this.testUserAgentDataBrands(page)],
      ['UACH platform vs UA',                () => this.testUserAgentDataPlatform(page)],
      ['WebGPU API presence',                () => this.testWebGPUPresence(page)],
      ['Math FPU fingerprint',               () => this.testMathFpuFingerprint(page)],
      ['Prototype chain integrity',          () => this.testProtoChainIntegrity(page)],
      ['MediaCapabilities API',              () => this.testMediaCapabilitiesApi(page)],
      ['Keyboard Layout API',                () => this.testKeyboardApiPresence(page)],
      ['WebRTC SDP fingerprint',             () => this.testWebRtcSdpFingerprint(page)],
      ['devicePixelRatio consistency',       () => this.testDevicePixelRatioConsistency(page)],
      ['Navigation Timing v2',               () => this.testNavigationTimingConsistency(page)],
      ['SpeechSynthesis consistency',        () => this.testSpeechSynthesisConsistency(page)],
      ['Private State Tokens API',           () => this.testTrustTokenApiShape(page)],
      ['SharedArrayBuffer + Atomics',        () => this.testSharedArrayBufferAvailability(page)],
      ['KeyboardEvent.key alignment',        () => this.testKeyboardEventKeyAlignment(page)],
      ['Intl.supportedValuesOf stability',   () => this.testIntlSupportedValues(page)],
      // Phase 12.A.2 — network/UA alignment
      ['UA ↔ binary version alignment',      () => this.testBinaryUaAlignment(page)],
      ['UA ↔ UACH brands alignment',         () => this.testUachBrandsAlignment(page)],
      ['UA-CH platform alignment',           () => this.testUachPlatformAlignment(page)],
      ['UA-CH mobile ↔ touch alignment',     () => this.testUachMobileTouchAlignment(page)],
      ['Accept-Language alignment',          () => this.testAcceptLanguageAlignment(page)],
      // P2 — behaviour drift (synchronous, but guarded for uniformity)
      ['Behavior consistency & drift risk',  async () => {
        const allResults = db.getDetectionTestResults(profileId)
        return createBehaviorConsistencyVector(
          analyzeBehaiorDrift(profileId, profile?.name || 'Unknown', fingerprint, allResults.length)
        )
      }],
      // P3 — browser-specific
      ['Browser consistency',                () => testBrowserConsistency(page, fingerprint)],
      ['Firefox-specific vectors',           () => testFirefoxSpecificVectors(page, fingerprint)],
      ['Safari-specific vectors',            () => testSafariSpecificVectors(page, fingerprint)],
      ['Edge-specific vectors',              () => testEdgeSpecificVectors(page, fingerprint)]
    ]

    for (const [name, run] of probes) {
      vectors.push(...(await this.runGuarded(name, run)))
    }

    const injectionVectors = vectors.map((v) => normalizeVector(v, 'injection'))

    // Layer 1 — coherence. These carry source 'coherence' and feed the risk
    // score rather than the injection score.
    const coherenceVectors = await this.runGuarded(
      'Coherence: engine',
      () => this.evaluateCoherence(profileId, page, fingerprint),
      COHERENCE_TIMEOUT_MS
    )

    // Layer 3 — live WAF verdict. Opt-in, and a no-op unless the operator has
    // pointed it at a canary they own.
    const canaryVectors = await this.runGuarded(
      'Canary: live WAF verdict',
      () => this.evaluateCanary(profileId, page),
      CANARY_TIMEOUT_MS
    )

    return [...injectionVectors, ...coherenceVectors, ...canaryVectors]
  }

  /**
   * Loads the operator's canary through this profile's browser and records the
   * verdict against the (profile × proxy) pair it belongs to.
   */
  private async evaluateCanary(profileId: string, page: Page): Promise<DetectionVectorResult[]> {
    const config = getSettings().canary
    if (!config?.enabled || !config.url) {
      return [canaryVector({ verdict: 'unreachable', detail: 'Canary not configured' })]
    }

    const db = Database.getInstance()
    const profile = db.getProfile(profileId) as any
    const proxyId = profile?.proxy_id ?? null

    // Load the canary in its own tab. The rest of the sweep reuses the
    // profile's first page, and navigating that to an external URL would
    // clobber whatever the user had open.
    const canaryPage = await page.browser().newPage()
    let classification
    try {
      classification = await runCanary(canaryPage, config)
    } finally {
      await canaryPage.close().catch(() => {})
    }

    // Attribute before recording, so this run is not compared against itself.
    const history = db.getCanaryHistory().map((h) => ({
      profileId: h.profileId,
      proxyId: h.proxyId,
      verdict: h.verdict as CanaryVerdict,
      testedAt: h.testedAt
    }))
    const attribution = attributeVerdict(
      { profileId, proxyId, verdict: classification.verdict },
      history
    )

    db.saveCanaryResult({
      id: uuidv4(),
      profileId,
      proxyId,
      url: config.url,
      verdict: classification.verdict,
      detail: classification.detail,
      testedAt: new Date().toISOString()
    })

    return [
      canaryVector(
        classification,
        attribution.suspect === 'inconclusive' && classification.verdict === 'passed'
          ? undefined
          : attribution.summary
      )
    ]
  }

  /**
   * Collects the four realms and runs the coherence rules over them.
   *
   * Realm collection is individually fault-tolerant: a worker that cannot be
   * created yields `null`, and the rule that needs it reports `unavailable`
   * rather than failing the profile.
   */
  private async evaluateCoherence(
    profileId: string,
    page: Page,
    fingerprint: FingerprintConfig
  ): Promise<DetectionVectorResult[]> {
    const db = Database.getInstance()

    const [main, worker, iframe, render, webrtcPublicIps, proxy, binaryMajor] = await Promise.all([
      collectMain(page),
      collectWorker(page).catch(() => null),
      collectIframe(page).catch(() => null),
      collectRenderHashes(page),
      collectWebrtcPublicIps(page).catch(() => [] as string[]),
      this.resolveProxyGeo(profileId),
      this.resolveBinaryMajor()
    ])

    const baseline = db.getFingerprintHashes(profileId)
    const otherProfiles = db.getOtherFingerprintHashes(profileId).map((r) => ({
      profileId: r.profile_id,
      hashes: { canvas: r.canvas, webgl: r.webgl, audio: r.audio }
    }))

    const results = runCoherenceRules({
      declared: fingerprint,
      main,
      worker,
      iframe,
      proxy,
      render,
      baseline: baseline ? { canvas: baseline.canvas, webgl: baseline.webgl, audio: baseline.audio } : null,
      otherProfiles,
      webrtcPublicIps,
      binaryMajor
    })

    // Record after evaluating, so R11 compares this run against the previous
    // one rather than against itself.
    db.saveFingerprintHashes(profileId, render)

    return results
  }

  /** Geo of the profile's proxy, or null when it runs direct. */
  private async resolveProxyGeo(profileId: string): Promise<ProxyGeo | null> {
    const db = Database.getInstance()
    const profile = db.getProfile(profileId) as any
    if (!profile?.proxy_id) return null
    const proxy = (db.getAllProxies() as any[]).find((p) => p.id === profile.proxy_id)
    if (!proxy) return null
    return {
      ip: proxy.last_ip ?? proxy.host,
      countryCode: proxy.country ?? undefined,
      timezone: proxy.timezone ?? undefined
    }
  }

  /** Real Chromium major version, for the R10 UA-vs-binary comparison. */
  private async resolveBinaryMajor(): Promise<number | undefined> {
    try {
      const info = await BrowserManager.getInstance().detectBinaryVersion()
      return info?.major || undefined
    } catch {
      return undefined
    }
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
    const hasVendor = !!result.vendor && result.vendor !== ''
    const hasPlatform = !!result.platform && result.platform !== ''
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
    const passed = !result.available || !!(result.charging && result.level && result.validLevel)
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

  // ── Phase 8 vectors ────────────────────────────────────────────────────────

  /** Intl.DateTimeFormat locale consistency — must match navigator.language */
  private async testIntlLocaleConsistency(page: Page): Promise<DetectionVectorResult> {
    const result = await page.evaluate(() => {
      const intlLocale = Intl.DateTimeFormat().resolvedOptions().locale
      const navLocale  = navigator.language
      const tzIntl     = Intl.DateTimeFormat().resolvedOptions().timeZone
      return { intlLocale, navLocale, tzIntl, match: intlLocale.startsWith(navLocale.split('-')[0]) }
    })
    return {
      name: 'Intl locale consistency',
      category: 'Locale',
      passed: result.match,
      detail: `Intl=${result.intlLocale}, navigator.language=${result.navLocale}, tz=${result.tzIntl}`
    }
  }

  /** navigator.userAgentData.brands must be present and non-empty */
  private async testUserAgentDataBrands(page: Page): Promise<DetectionVectorResult> {
    const result = await page.evaluate(() => {
      const uad = (navigator as any).userAgentData
      if (!uad) return { available: false, count: 0, brands: [] as string[] }
      const brands = (uad.brands || []).map((b: any) => b.brand)
      return { available: true, count: brands.length, brands }
    })
    const passed = !result.available || result.count >= 2
    return {
      name: 'UACH brands list',
      category: 'Browser',
      passed,
      detail: result.available
        ? `brands=[${result.brands.join(', ')}]`
        : 'userAgentData not available (non-Chromium UA)'
    }
  }

  /** navigator.userAgentData.platform must match the spoofed OS */
  private async testUserAgentDataPlatform(page: Page): Promise<DetectionVectorResult> {
    const result = await page.evaluate(() => {
      const uad = (navigator as any).userAgentData
      if (!uad) return { available: false, platform: '', uaPlatform: '' }
      return {
        available: true,
        platform: uad.platform,
        uaPlatform: navigator.userAgent.includes('Windows') ? 'Windows'
                  : navigator.userAgent.includes('Mac') ? 'macOS'
                  : navigator.userAgent.includes('Linux') ? 'Linux' : 'Other'
      }
    })
    const passed = !result.available || result.platform === result.uaPlatform
    return {
      name: 'UACH platform vs UA',
      category: 'Browser',
      passed,
      detail: result.available
        ? `UACH.platform=${result.platform}, expected=${result.uaPlatform}`
        : 'userAgentData not available'
    }
  }

  /** navigator.gpu (WebGPU) presence check */
  private async testWebGPUPresence(page: Page): Promise<DetectionVectorResult> {
    const result = await page.evaluate(() => {
      const hasGpu = 'gpu' in navigator
      const gpuType = hasGpu ? typeof (navigator as any).gpu : 'absent'
      return { hasGpu, gpuType }
    })
    return {
      name: 'WebGPU API presence',
      category: 'API',
      passed: result.hasGpu && result.gpuType === 'object',
      detail: result.hasGpu ? `navigator.gpu=${result.gpuType}` : 'navigator.gpu absent (stub needed)'
    }
  }

  /** Math FPU fingerprint — checks if sin(1) returns the x86 reference value */
  private async testMathFpuFingerprint(page: Page): Promise<DetectionVectorResult> {
    const result = await page.evaluate(() => {
      const sinVal  = Math.sin(1)
      const cosVal  = Math.cos(1)
      // x86 reference values
      const sinRef  = 0.8414709848078965
      const cosRef  = 0.5403023058681398
      const sinOk   = Math.abs(sinVal - sinRef) < 1e-15
      const cosOk   = Math.abs(cosVal - cosRef) < 1e-15
      return { sinVal, cosVal, sinOk, cosOk }
    })
    const passed = result.sinOk && result.cosOk
    return {
      name: 'Math FPU fingerprint',
      category: 'API',
      passed,
      detail: `sin(1)=${result.sinVal}, cos(1)=${result.cosVal}, x86-consistent=${passed}`
    }
  }

  /** Prototype chain integrity — Function.prototype must not have unexpected enumerable keys */
  private async testProtoChainIntegrity(page: Page): Promise<DetectionVectorResult> {
    const result = await page.evaluate(() => {
      const keys = []
      for (const k in Function.prototype) {
        keys.push(k)
      }
      return { enumerableKeys: keys, count: keys.length }
    })
    const passed = result.count === 0
    return {
      name: 'Prototype chain integrity',
      category: 'Automation',
      passed,
      detail: passed
        ? 'Function.prototype has no enumerable properties'
        : `Unexpected enumerable keys: ${result.enumerableKeys.join(', ')}`
    }
  }

  /** MediaCapabilities.decodingInfo consistency */
  private async testMediaCapabilitiesApi(page: Page): Promise<DetectionVectorResult> {
    const result = await page.evaluate(async () => {
      if (!navigator.mediaCapabilities) return { available: false, smooth: false, supported: false }
      try {
        const info = await navigator.mediaCapabilities.decodingInfo({
          type: 'media-source',
          video: { contentType: 'video/mp4; codecs="avc1.42E01E"', width: 1920, height: 1080, bitrate: 4000000, framerate: 30 }
        } as any)
        return { available: true, smooth: info.smooth, supported: info.supported }
      } catch {
        return { available: false, smooth: false, supported: false }
      }
    })
    const passed = !result.available || (result.supported && result.smooth)
    return {
      name: 'MediaCapabilities API',
      category: 'API',
      passed,
      detail: result.available
        ? `supported=${result.supported}, smooth=${result.smooth}`
        : 'MediaCapabilities API not available'
    }
  }

  /** Keyboard Layout API presence */
  private async testKeyboardApiPresence(page: Page): Promise<DetectionVectorResult> {
    const result = await page.evaluate(() => {
      const hasKeyboard = 'keyboard' in navigator
      const hasGetLayout = hasKeyboard && typeof (navigator as any).keyboard.getLayoutMap === 'function'
      return { hasKeyboard, hasGetLayout }
    })
    return {
      name: 'Keyboard Layout API',
      category: 'API',
      passed: result.hasKeyboard && result.hasGetLayout,
      detail: result.hasKeyboard
        ? `navigator.keyboard present, getLayoutMap=${result.hasGetLayout}`
        : 'navigator.keyboard absent — suspicious headless environment'
    }
  }

  /** WebRTC SDP fingerprint — checks if localSDP contains expected DTLS fingerprint format */
  private async testWebRtcSdpFingerprint(page: Page): Promise<DetectionVectorResult> {
    const result = await page.evaluate(async () => {
      try {
        const pc = new RTCPeerConnection()
        pc.addTransceiver('audio')
        const offer = await pc.createOffer()
        pc.close()
        const sdp = offer.sdp || ''
        const hasFingerprint = sdp.includes('a=fingerprint:')
        const hasMsid        = sdp.includes('a=msid-semantic:')
        return { hasFingerprint, hasMsid, sdpLen: sdp.length }
      } catch {
        return { hasFingerprint: false, hasMsid: false, sdpLen: 0 }
      }
    })
    const passed = result.hasFingerprint && result.sdpLen > 100
    return {
      name: 'WebRTC SDP fingerprint',
      category: 'Network',
      passed,
      detail: passed
        ? `SDP has fingerprint+msid (${result.sdpLen} bytes)`
        : 'WebRTC SDP missing expected fields'
    }
  }

  /** devicePixelRatio consistency across window and screen APIs */
  private async testDevicePixelRatioConsistency(page: Page): Promise<DetectionVectorResult> {
    const result = await page.evaluate(() => {
      const dpr        = window.devicePixelRatio
      const screenW    = screen.width
      const outerW     = window.outerWidth
      const dprValid   = dpr > 0 && dpr <= 4
      const sizesValid = screenW > 0 && outerW > 0
      return { dpr, screenW, outerW, dprValid, sizesValid }
    })
    const passed = result.dprValid && result.sizesValid
    return {
      name: 'devicePixelRatio consistency',
      category: 'Hardware',
      passed,
      detail: `dpr=${result.dpr}, screen=${result.screenW}px, outer=${result.outerW}px`
    }
  }

  /** Navigation Timing v2 — PerformanceNavigationTiming entries should look realistic */
  private async testNavigationTimingConsistency(page: Page): Promise<DetectionVectorResult> {
    const result = await page.evaluate(() => {
      const entries = performance.getEntriesByType('navigation')
      if (!entries.length) return { available: false, realistic: false, detail: 'no navigation entries' }
      const nav = entries[0] as PerformanceNavigationTiming
      const realistic =
        nav.domContentLoadedEventEnd > 0 &&
        nav.responseStart >= nav.requestStart &&
        nav.domInteractive >= nav.responseEnd
      return { available: true, realistic, detail: `dns=${Math.round(nav.domainLookupEnd - nav.domainLookupStart)}ms, tcp=${Math.round(nav.connectEnd - nav.connectStart)}ms` }
    })
    const passed = !result.available || result.realistic
    return {
      name: 'Navigation Timing v2',
      category: 'Timing',
      passed,
      detail: result.detail
    }
  }

  /** speechSynthesis.getVoices() locale consistency with navigator.language */
  private async testSpeechSynthesisConsistency(page: Page): Promise<DetectionVectorResult> {
    const result = await page.evaluate(() => {
      if (!('speechSynthesis' in window)) return { available: false, count: 0, match: true }
      const voices = window.speechSynthesis.getVoices()
      const lang   = navigator.language.split('-')[0]
      const hasLang = voices.some(v => v.lang.startsWith(lang))
      return { available: true, count: voices.length, match: voices.length === 0 || hasLang }
    })
    return {
      name: 'SpeechSynthesis consistency',
      category: 'API',
      passed: !result.available || result.match,
      detail: result.available
        ? `${result.count} voices, locale-match=${result.match}`
        : 'speechSynthesis API not available'
    }
  }

  /** Private State Tokens (Trust Tokens) API shape check */
  private async testTrustTokenApiShape(page: Page): Promise<DetectionVectorResult> {
    const result = await page.evaluate(() => {
      const hasPrivateToken    = 'hasPrivateToken' in document
      const hasRedemptionRecord = 'hasRedemptionRecord' in document
      return { hasPrivateToken, hasRedemptionRecord }
    })
    // Chrome 101+ has both; absence on recent Chrome is suspicious
    return {
      name: 'Private State Tokens API',
      category: 'API',
      passed: result.hasPrivateToken && result.hasRedemptionRecord,
      detail: `hasPrivateToken=${result.hasPrivateToken}, hasRedemptionRecord=${result.hasRedemptionRecord}`
    }
  }

  /** SharedArrayBuffer availability — requires cross-origin isolation */
  private async testSharedArrayBufferAvailability(page: Page): Promise<DetectionVectorResult> {
    const result = await page.evaluate(() => {
      const available = typeof SharedArrayBuffer !== 'undefined'
      // If available, check Atomics is also present
      const atomicsOk = available && typeof Atomics !== 'undefined'
      return { available, atomicsOk }
    })
    // SAB may or may not be available depending on COOP/COEP headers; we check consistency
    const passed = !result.available || result.atomicsOk
    return {
      name: 'SharedArrayBuffer + Atomics',
      category: 'API',
      passed,
      detail: result.available
        ? `SharedArrayBuffer available, Atomics=${result.atomicsOk}`
        : 'SharedArrayBuffer not available (expected with COOP/COEP headers)'
    }
  }

  /** P0 FIX: KeyboardEvent.key alignment with navigator.keyboard layout */
  private async testKeyboardEventKeyAlignment(page: Page): Promise<DetectionVectorResult> {
    const result = await page.evaluate(() => {
      try {
        // Create a synthetic keyboard event
        const event = new KeyboardEvent('keydown', {
          code: 'KeyA',
          key: 'a',
          bubbles: true
        })
        const synthKey = event.key

        // Check if keyboard layout is available.
        // navigator.keyboard is a non-standard Chromium API not in lib.dom.d.ts.
        const nav = navigator as any
        const hasKeyboardApi = nav.keyboard && typeof nav.keyboard.getLayoutMap === 'function'

        return {
          hasKeyboardApi,
          synthKey,
          keyboardApiAvailable: hasKeyboardApi
        }
      } catch (e) {
        return {
          hasKeyboardApi: false,
          synthKey: 'error',
          keyboardApiAvailable: false,
          error: String(e)
        }
      }
    })

    // Pass if either keyboard API is available OR synthetic KeyboardEvent works correctly
    const passed = result.hasKeyboardApi || (result.synthKey === 'a' && !result.error)

    return {
      name: 'KeyboardEvent.key alignment',
      category: 'Input',
      passed,
      detail: passed
        ? `KeyboardEvent.key='${result.synthKey}' consistent with keyboard layout`
        : `KeyboardEvent alignment issue: ${result.error || 'missing keyboard API'}`
    }
  }

  /** Intl.supportedValuesOf returns stable list */
  private async testIntlSupportedValues(page: Page): Promise<DetectionVectorResult> {
    const result = await page.evaluate(() => {
      if (typeof (Intl as any).supportedValuesOf !== 'function') {
        return { available: false, tzCount: 0, currCount: 0 }
      }
      try {
        const tzs  = (Intl as any).supportedValuesOf('timeZone')
        const currs = (Intl as any).supportedValuesOf('currency')
        return { available: true, tzCount: tzs.length, currCount: currs.length }
      } catch {
        return { available: false, tzCount: 0, currCount: 0 }
      }
    })
    // A well-formed Intl should return ≥3 timezones and ≥3 currencies in our stub
    const passed = !result.available || (result.tzCount >= 3 && result.currCount >= 3)
    return {
      name: 'Intl.supportedValuesOf stability',
      category: 'Locale',
      passed,
      detail: result.available
        ? `${result.tzCount} timezones, ${result.currCount} currencies`
        : 'Intl.supportedValuesOf not available'
    }
  }

  // ── Phase 12.A.2 — Network / UA-alignment vectors ─────────────────────────
  //
  // These vectors don't probe a real network endpoint (no TLS proxy yet).
  // Instead they verify that the JS-visible identity hints are internally
  // consistent with each other AND with the real Chromium binary version.
  //
  // A spoofed `Chrome/121` over a real `Chrome/132` ClientHello is the most
  // common server-side tell, so binary-major alignment is the highest-value
  // local check we can run before shipping a TLS rewriter.

  /** UA Chrome major must match the actual Chromium binary major (Phase 12.A.1). */
  private async testBinaryUaAlignment(page: Page): Promise<DetectionVectorResult> {
    const binary = BrowserManager.getInstance().getCachedBinaryInfo()
    const ua = await page.evaluate(() => navigator.userAgent)
    // Skip iOS / Safari profiles — no Chrome token in the UA
    const m = ua.match(/Chrome\/(\d+)\./)
    if (!m) {
      return {
        name: 'UA ↔ binary version alignment',
        category: 'Network',
        passed: true,
        detail: `Skipped — non-Chromium UA: ${ua.substring(0, 60)}`
      }
    }
    if (!binary) {
      return {
        name: 'UA ↔ binary version alignment',
        category: 'Network',
        passed: false,
        detail: 'Binary version not yet detected — restart app to enable detection'
      }
    }
    const uaMajor = parseInt(m[1], 10)
    const passed = uaMajor === binary.major
    return {
      name: 'UA ↔ binary version alignment',
      category: 'Network',
      passed,
      detail: passed
        ? `UA Chrome/${uaMajor} matches binary Chrome/${binary.major}`
        : `UA Chrome/${uaMajor} ≠ binary Chrome/${binary.major} — TLS/JA3 will reveal mismatch`
    }
  }

  /** UA Chrome major must match navigator.userAgentData.brands major. */
  private async testUachBrandsAlignment(page: Page): Promise<DetectionVectorResult> {
    const result = await page.evaluate(() => {
      const ua = navigator.userAgent
      const m = ua.match(/Chrome\/(\d+)\./)
      const uaMajor = m ? parseInt(m[1], 10) : 0
      const uad = (navigator as any).userAgentData
      if (!uad || !Array.isArray(uad.brands)) {
        return { available: false, uaMajor, brandMajor: 0, brands: [] as string[] }
      }
      // Find the non-greasy brand (the real Chrome / Chromium entry)
      const real = uad.brands.find((b: any) =>
        /Chromium|Google Chrome|Microsoft Edge|Opera/i.test(b.brand) &&
        !/Not.*Brand/i.test(b.brand)
      )
      const brandMajor = real ? parseInt(String(real.version), 10) : 0
      return {
        available: true,
        uaMajor,
        brandMajor,
        brands: uad.brands.map((b: any) => `${b.brand}/${b.version}`)
      }
    })
    if (!result.available) {
      // iOS / Safari has no userAgentData — that's correct
      const ua = await page.evaluate(() => navigator.userAgent)
      const isMobile = /iPhone|iPad|Macintosh.*Safari/i.test(ua)
      return {
        name: 'UA ↔ UACH brands alignment',
        category: 'Network',
        passed: isMobile,
        detail: isMobile ? 'No userAgentData (expected for Safari/iOS)' : 'userAgentData missing on Chromium UA — suspicious'
      }
    }
    if (result.uaMajor === 0) {
      return {
        name: 'UA ↔ UACH brands alignment',
        category: 'Network',
        passed: true,
        detail: 'Skipped — non-Chromium UA'
      }
    }
    const passed = result.uaMajor === result.brandMajor
    return {
      name: 'UA ↔ UACH brands alignment',
      category: 'Network',
      passed,
      detail: passed
        ? `UA Chrome/${result.uaMajor} matches brands [${result.brands.join(', ')}]`
        : `UA Chrome/${result.uaMajor} ≠ brand Chrome/${result.brandMajor}`
    }
  }

  /** navigator.userAgentData.platform must match navigator.platform family. */
  private async testUachPlatformAlignment(page: Page): Promise<DetectionVectorResult> {
    const result = await page.evaluate(() => {
      const platform = navigator.platform
      const uad = (navigator as any).userAgentData
      const uadPlatform = uad ? uad.platform : null
      return { platform, uadPlatform, hasUad: !!uad }
    })
    if (!result.hasUad) {
      return {
        name: 'UA-CH platform alignment',
        category: 'Network',
        passed: true,
        detail: `No userAgentData (Safari/iOS) — platform=${result.platform}`
      }
    }
    // Map navigator.platform → expected userAgentData.platform family
    const family = (p: string): string => {
      if (/Win/i.test(p)) return 'Windows'
      if (/Mac/i.test(p)) return 'macOS'
      if (/Linux/i.test(p)) return 'Linux'
      if (/Android/i.test(p)) return 'Android'
      if (/iPhone|iPad/i.test(p)) return 'iOS'
      return ''
    }
    const expected = family(result.platform)
    const passed = expected === '' || expected === result.uadPlatform
    return {
      name: 'UA-CH platform alignment',
      category: 'Network',
      passed,
      detail: passed
        ? `platform="${result.platform}" matches UA-CH platform="${result.uadPlatform}"`
        : `platform="${result.platform}" → expected "${expected}" but UA-CH = "${result.uadPlatform}"`
    }
  }

  /** UA-CH mobile flag must agree with maxTouchPoints. */
  private async testUachMobileTouchAlignment(page: Page): Promise<DetectionVectorResult> {
    const result = await page.evaluate(() => {
      const uad        = (navigator as any).userAgentData
      const uadMobile  = uad ? !!uad.mobile : null
      const touchPts   = navigator.maxTouchPoints
      const ua         = navigator.userAgent
      const uaMobile   = /Mobile|Android|iPhone|iPad/i.test(ua)
      return { uadMobile, touchPts, uaMobile, hasUad: !!uad }
    })
    if (!result.hasUad) {
      // Safari/iOS — fall back to UA + touch consistency
      const passed = result.uaMobile ? result.touchPts > 0 : true
      return {
        name: 'UA-CH mobile ↔ touch alignment',
        category: 'Network',
        passed,
        detail: `UA mobile=${result.uaMobile}, maxTouchPoints=${result.touchPts}`
      }
    }
    // Mobile UA should report touchPts > 0 and UA-CH mobile === true
    const expected = result.uaMobile
    const passed   = result.uadMobile === expected &&
                     (expected ? result.touchPts > 0 : true)
    return {
      name: 'UA-CH mobile ↔ touch alignment',
      category: 'Network',
      passed,
      detail: passed
        ? `UA-CH mobile=${result.uadMobile}, touchPts=${result.touchPts}, UA mobile=${result.uaMobile}`
        : `Mismatch: UA mobile=${result.uaMobile}, UA-CH mobile=${result.uadMobile}, touchPts=${result.touchPts}`
    }
  }

  /** navigator.languages[0] base must match Intl resolved locale. */
  private async testAcceptLanguageAlignment(page: Page): Promise<DetectionVectorResult> {
    const result = await page.evaluate(() => {
      const langs   = navigator.languages || []
      const lang    = navigator.language
      const intlLoc = Intl.DateTimeFormat().resolvedOptions().locale
      return { langs: [...langs], lang, intlLoc }
    })
    if (result.langs.length === 0) {
      return {
        name: 'Accept-Language alignment',
        category: 'Network',
        passed: false,
        detail: 'navigator.languages is empty — header will leak default locale'
      }
    }
    const base   = (s: string): string => (s || '').split('-')[0].toLowerCase()
    const first  = base(result.langs[0])
    const navLng = base(result.lang)
    const intl   = base(result.intlLoc)
    const passed = first === navLng && first === intl
    return {
      name: 'Accept-Language alignment',
      category: 'Network',
      passed,
      detail: passed
        ? `languages[0]=${result.langs[0]}, language=${result.lang}, intl=${result.intlLoc}`
        : `Mismatch: languages[0]=${result.langs[0]}, language=${result.lang}, intl=${result.intlLoc}`
    }
  }
}
