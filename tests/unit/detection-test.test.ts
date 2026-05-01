/**
 * Unit tests for DetectionTestRunner — the singleton that launches a profile's
 * browser, evaluates 50+ detection vectors, scores 0-100, and persists results.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock heavy dependencies before importing the module under test ──────────

vi.mock('electron', () => ({ app: { getPath: vi.fn(() => '/tmp') } }))
vi.mock('uuid', () => ({ v4: () => 'test-uuid-detection' }))

const mockProfile = {
  id: 'profile-1',
  name: 'Test Profile',
  fingerprint: JSON.stringify({ preset: 'win10-chrome120', userAgent: 'Mozilla/5.0 Chrome/120' }),
  user_data_path: '/tmp/profile-1'
}

const mockDb = {
  getProfile: vi.fn((id: string) => {
    if (id === 'profile-1') return { ...mockProfile }
    if (id === 'profile-missing') return null
    return { ...mockProfile, id }
  }),
  getDetectionTestResults: vi.fn((profileId?: string) => {
    const all = [
      { id: 'r1', profileId: 'profile-1', profileName: 'Test Profile', testedAt: '2026-01-01', overallScore: 95, vectors: [], status: 'passed' },
      { id: 'r2', profileId: 'profile-2', profileName: 'Other Profile', testedAt: '2026-01-02', overallScore: 60, vectors: [], status: 'failed' }
    ]
    if (profileId) return all.filter(r => r.profileId === profileId)
    return all
  }),
  saveDetectionTestResult: vi.fn()
}

vi.mock('../../src/main/database', () => ({
  Database: { getInstance: () => mockDb }
}))

// ── Mock page.evaluate — returns "passing" values by call index ─────────────
//
// The evaluateVectors method calls page.evaluate once per vector test in a
// known order (see detection-test.ts lines 104-158).  Using call-index-based
// dispatching avoids ambiguity from shared substrings across test functions.
//
// Order (0-indexed):
//  0  testWebdriver           → false
//  1  testChromeRuntime       → true
//  2  testChromeApp           → true
//  3  testPlugins             → 3
//  4  testPermissions         → 'prompt'
//  5  testNavigatorProps      → { platform, vendor, ua }
//  6  testCanvasFingerprint   → true
//  7  testWebglVendor         → { vendor, renderer }
//  8  testAudioContext        → true
//  9  testScreenConsistency   → { width, height, outerW, outerH, innerW, innerH }
// 10  testTimezone            → 'America/New_York'
// 11  testLanguageConsistency → { lang, langs, match }
// 12  testConnectionApi       → { downlink, effectiveType, rtt }
// 13  testStorageQuota        → { quota, usage }
// 14  testErrorStack          → clean stack string
// 15  testFunctionToString    → native code string
// 16  testHeadlessSignals     → { outerWidth, outerHeight, notifPerm }
// 17  testCdcVariables        → []
// 18  testPerformanceEntries  → 0
// 19  testNotificationPermission → 'default'
// 20  testDateNowPrecision    → { unique, samples }
// 21  testWebAssemblySupport  → true
// 22  testObjDefPropConsistency → { status, configurable }
// 23  testWorkerWebdriver     → 'undefined:undefined'
// 24  testCssMediaConsistency → { colorScheme, pointer, hover }
// 25  testBatteryApiShape     → { available: false, reason }
// 26  testViewportConsistency → { innerW, innerH, outerW, outerH, screenW, screenH, devicePixelRatio }
// 27  testSeleniumArtifacts   → []
// 28  testServiceWorkerSupport → true
// 29  testDocumentFocus       → { hasFocus, visibilityState, hidden }
// 30  testIntlLocaleConsistency → { intlLocale, navLocale, tzIntl, match }
// 31  testUserAgentDataBrands → { available, count, brands }
// 32  testUserAgentDataPlatform → { available, platform, uaPlatform }
// 33  testWebGPUPresence      → { hasGpu, gpuType }
// 34  testMathFpuFingerprint  → { sinVal, cosVal, sinOk, cosOk }
// 35  testProtoChainIntegrity → { enumerableKeys, count }
// 36  testMediaCapabilitiesApi → { available, smooth, supported }
// 37  testKeyboardApiPresence → { hasKeyboard, hasGetLayout }
// 38  testWebRtcSdpFingerprint → { hasFingerprint, hasMsid, sdpLen }
// 39  testDevicePixelRatioConsistency → { dpr, screenW, outerW, dprValid, sizesValid }
// 40  testNavigationTimingConsistency → { available, realistic, detail }
// 41  testSpeechSynthesisConsistency → { available, count, match }
// 42  testTrustTokenApiShape → { hasPrivateToken, hasRedemptionRecord }
// 43  testSharedArrayBufferAvailability → { available, atomicsOk }
// 44  testKeyboardEventKeyAlignment → { hasKeyboardApi, synthKey, keyboardApiAvailable }
// 45  testIntlSupportedValues → { available, tzCount, currCount }
// 46  testBinaryUaAlignment (page.evaluate for UA string)
// 47  testUachBrandsAlignment (page.evaluate for brands+ua) — may have extra calls
// 48  testUachPlatformAlignment
// 49  testUachMobileTouchAlignment
// 50  testAcceptLanguageAlignment

/** Failing return values that won't crash but cause vectors to fail. */
const FAILING_RETURNS: any[] = [
  /* 0  testWebdriver           */ true,
  /* 1  testChromeRuntime       */ false,
  /* 2  testChromeApp           */ false,
  /* 3  testPlugins             */ 0,
  /* 4  testPermissions         */ 'error',
  /* 5  testNavigatorProps      */ { platform: '', vendor: '', ua: '' },
  /* 6  testCanvasFingerprint   */ false,
  /* 7  testWebglVendor         */ { vendor: '', renderer: 'SwiftShader' },
  /* 8  testAudioContext        */ false,
  /* 9  testScreenConsistency   */ { width: 0, height: 0, outerW: 0, outerH: 0, innerW: 0, innerH: 0 },
  /* 10 testTimezone            */ '',
  /* 11 testLanguageConsistency */ { lang: 'en-US', langs: [], match: false },
  /* 12 testConnectionApi       */ null,
  /* 13 testStorageQuota        */ null,
  /* 14 testErrorStack          */ 'Error\n    at __puppeteer_evaluation_script__',
  /* 15 testFunctionToString    */ 'function query() { /* not native */ }',
  /* 16 testHeadlessSignals     */ { outerWidth: 0, outerHeight: 0, notifPerm: 'denied' },
  /* 17 testCdcVariables        */ ['cdc_adoQpoasnfa76pfcZLmcfl'],
  /* 18 testPerformanceEntries  */ 5,
  /* 19 testNotificationPerm    */ 'denied',
  /* 20 testDateNowPrecision    */ { unique: 20, samples: [] },
  /* 21 testWebAssemblySupport  */ false,
  /* 22 testObjDefPropConsist.  */ { status: 'present', configurable: false },
  /* 23 testWorkerWebdriver     */ 'boolean:true',
  /* 24 testCssMediaConsistency */ { colorScheme: 'none', pointer: 'none', hover: false },
  /* 25 testBatteryApiShape     */ { available: true, charging: false, level: false, validLevel: false },
  /* 26 testViewportConsistency */ { innerW: 0, innerH: 0, outerW: 0, outerH: 0, screenW: 0, screenH: 0, devicePixelRatio: 0 },
  /* 27 testSeleniumArtifacts   */ ['__selenium_evaluate'],
  /* 28 testServiceWorkerSupport*/ false,
  /* 29 testDocumentFocus       */ { hasFocus: false, visibilityState: 'hidden', hidden: true },
  /* 30 testIntlLocaleConsist.  */ { intlLocale: 'ja-JP', navLocale: 'en-US', tzIntl: 'Asia/Tokyo', match: false },
  /* 31 testUserAgentDataBrands */ { available: true, count: 0, brands: [] },
  /* 32 testUserAgentDataPlatform*/ { available: true, platform: 'Linux', uaPlatform: 'Windows' },
  /* 33 testWebGPUPresence      */ { hasGpu: false, gpuType: 'absent' },
  /* 34 testMathFpuFingerprint  */ { sinVal: 0, cosVal: 0, sinOk: false, cosOk: false },
  /* 35 testProtoChainIntegrity */ { enumerableKeys: ['bad'], count: 1 },
  /* 36 testMediaCapabilitiesApi*/ { available: true, smooth: false, supported: false },
  /* 37 testKeyboardApiPresence */ { hasKeyboard: false, hasGetLayout: false },
  /* 38 testWebRtcSdpFingerprint*/ { hasFingerprint: false, hasMsid: false, sdpLen: 0 },
  /* 39 testDevicePixelRatio    */ { dpr: 0, screenW: 0, outerW: 0, dprValid: false, sizesValid: false },
  /* 40 testNavigationTiming    */ { available: true, realistic: false, detail: 'bad timing' },
  /* 41 testSpeechSynthesis     */ { available: true, count: 5, match: false },
  /* 42 testTrustTokenApiShape  */ { hasPrivateToken: false, hasRedemptionRecord: false },
  /* 43 testSharedArrayBuffer   */ { available: true, atomicsOk: false },
  /* 44 testKeyboardEventKey    */ { hasKeyboardApi: false, synthKey: 'error', keyboardApiAvailable: false, error: 'fail' },
  /* 45 testIntlSupportedValues */ { available: true, tzCount: 0, currCount: 0 },
  /* 46 testBinaryUaAlignment   */ 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/999.0.0.0',
  /* 47 testUachBrandsAlignment */ { available: true, uaMajor: 120, brandMajor: 999, brands: ['Google Chrome/999'] },
  /* 48 testUachPlatformAlign.  */ { platform: 'Win32', uadPlatform: 'Linux', hasUad: true },
  /* 49 testUachMobileTouchAlign*/ { uadMobile: true, touchPts: 0, uaMobile: false, hasUad: true },
  /* 50 testAcceptLanguageAlign.*/ { langs: ['fr-FR'], lang: 'en-US', intlLoc: 'ja-JP' },
]

/** Canonical passing return values keyed by call index. */
const PASSING_RETURNS: any[] = [
  /* 0  testWebdriver           */ false,
  /* 1  testChromeRuntime       */ true,
  /* 2  testChromeApp           */ true,
  /* 3  testPlugins             */ 3,
  /* 4  testPermissions         */ 'prompt',
  /* 5  testNavigatorProps      */ { platform: 'Win32', vendor: 'Google Inc.', ua: 'Mozilla/5.0 Chrome/120' },
  /* 6  testCanvasFingerprint   */ true,
  /* 7  testWebglVendor         */ { vendor: 'Google Inc.', renderer: 'ANGLE (NVIDIA GeForce)' },
  /* 8  testAudioContext        */ true,
  /* 9  testScreenConsistency   */ { width: 1920, height: 1080, outerW: 1920, outerH: 1040, innerW: 1920, innerH: 1000 },
  /* 10 testTimezone            */ 'America/New_York',
  /* 11 testLanguageConsistency */ { lang: 'en-US', langs: ['en-US', 'en'], match: true },
  /* 12 testConnectionApi       */ { downlink: 10, effectiveType: '4g', rtt: 50 },
  /* 13 testStorageQuota        */ { quota: 100 * 1024 * 1024 * 1024, usage: 0 },
  /* 14 testErrorStack          */ 'Error: test\n    at Object.<anonymous>',
  /* 15 testFunctionToString    */ 'function query() { [native code] }',
  /* 16 testHeadlessSignals     */ { outerWidth: 1920, outerHeight: 1040, notifPerm: 'default' },
  /* 17 testCdcVariables        */ [],
  /* 18 testPerformanceEntries  */ 0,
  /* 19 testNotificationPerm    */ 'default',
  /* 20 testDateNowPrecision    */ { unique: 5, samples: [100, 200, 300, 400, 500] },
  /* 21 testWebAssemblySupport  */ true,
  /* 22 testObjDefPropConsist.  */ { status: 'absent', configurable: false },
  /* 23 testWorkerWebdriver     */ 'undefined:undefined',
  /* 24 testCssMediaConsistency */ { colorScheme: 'light', pointer: 'fine', hover: true },
  /* 25 testBatteryApiShape     */ { available: false, reason: 'no getBattery' },
  /* 26 testViewportConsistency */ { innerW: 1920, innerH: 1000, outerW: 1920, outerH: 1040, screenW: 1920, screenH: 1080, devicePixelRatio: 1 },
  /* 27 testSeleniumArtifacts   */ [],
  /* 28 testServiceWorkerSupport*/ true,
  /* 29 testDocumentFocus       */ { hasFocus: true, visibilityState: 'visible', hidden: false },
  /* 30 testIntlLocaleConsist.  */ { intlLocale: 'en-US', navLocale: 'en-US', tzIntl: 'America/New_York', match: true },
  /* 31 testUserAgentDataBrands */ { available: true, count: 3, brands: ['Google Chrome', 'Chromium', 'Not_A Brand'] },
  /* 32 testUserAgentDataPlatform*/ { available: true, platform: 'Windows', uaPlatform: 'Windows' },
  /* 33 testWebGPUPresence      */ { hasGpu: true, gpuType: 'object' },
  /* 34 testMathFpuFingerprint  */ { sinVal: 0.8414709848078965, cosVal: 0.5403023058681398, sinOk: true, cosOk: true },
  /* 35 testProtoChainIntegrity */ { enumerableKeys: [], count: 0 },
  /* 36 testMediaCapabilitiesApi*/ { available: true, smooth: true, supported: true },
  /* 37 testKeyboardApiPresence */ { hasKeyboard: true, hasGetLayout: true },
  /* 38 testWebRtcSdpFingerprint*/ { hasFingerprint: true, hasMsid: true, sdpLen: 500 },
  /* 39 testDevicePixelRatio    */ { dpr: 1, screenW: 1920, outerW: 1920, dprValid: true, sizesValid: true },
  /* 40 testNavigationTiming    */ { available: true, realistic: true, detail: 'dns=0ms, tcp=0ms' },
  /* 41 testSpeechSynthesis     */ { available: true, count: 5, match: true },
  /* 42 testTrustTokenApiShape  */ { hasPrivateToken: true, hasRedemptionRecord: true },
  /* 43 testSharedArrayBuffer   */ { available: true, atomicsOk: true },
  /* 44 testKeyboardEventKey    */ { hasKeyboardApi: true, synthKey: 'a', keyboardApiAvailable: true },
  /* 45 testIntlSupportedValues */ { available: true, tzCount: 100, currCount: 50 },
  /* 46 testBinaryUaAlignment   */ 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
  /* 47 testUachBrandsAlignment */ { available: true, uaMajor: 120, brandMajor: 120, brands: ['Google Chrome/120', 'Chromium/120'] },
  /* 48 testUachPlatformAlign.  */ { platform: 'Win32', uadPlatform: 'Windows', hasUad: true },
  /* 49 testUachMobileTouchAlign*/ { uadMobile: false, touchPts: 0, uaMobile: false, hasUad: true },
  /* 50 testAcceptLanguageAlign.*/ { langs: ['en-US', 'en'], lang: 'en-US', intlLoc: 'en-US' },
]

function createMockPage() {
  let callIndex = 0
  const evaluateFn = vi.fn(async (_fn: Function) => {
    const idx = callIndex++
    if (idx < PASSING_RETURNS.length) return PASSING_RETURNS[idx]
    // Fallback for any extra evaluate calls (e.g. second evaluate in testUachBrandsAlignment)
    return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0'
  })
  return {
    evaluate: evaluateFn,
    goto: vi.fn(async () => {}),
    _resetCallIndex() { callIndex = 0 }
  }
}

// ── Mock BrowserManager ─────────────────────────────────────────────────────

let mockPage = createMockPage()
let profileRunning = false

const mockBm = {
  isRunning: vi.fn((_id: string) => profileRunning),
  launchProfile: vi.fn(async () => {}),
  closeProfile: vi.fn(async () => {}),
  getCachedBinaryInfo: vi.fn(() => ({ major: 120, full: '120.0.6099.71' })),
  sessions: new Map<string, any>()
}

function setSession(page: any, id = 'profile-1') {
  mockBm.sessions.set(id, {
    browser: {
      pages: vi.fn(async () => [page]),
      newPage: vi.fn(async () => page)
    }
  })
}

setSession(mockPage)

vi.mock('../../src/main/browser-manager', () => ({
  BrowserManager: { getInstance: () => mockBm }
}))

vi.mock('../../src/main/fingerprint/presets', () => ({
  resolveFingerprint: vi.fn((fp: any) => fp)
}))

vi.mock('../../src/main/fingerprint/behavior-drift', () => ({
  analyzeBehaiorDrift: vi.fn(() => ({ drifts: [], overallDrift: 0 })),
  createBehaviorConsistencyVector: vi.fn(() => ({
    name: 'behavior-consistency',
    category: 'Behavior',
    passed: true,
    detail: 'OK'
  }))
}))

vi.mock('../../src/main/fingerprint/browser-vectors', () => ({
  testFirefoxSpecificVectors: vi.fn(async () => []),
  testSafariSpecificVectors: vi.fn(async () => []),
  testEdgeSpecificVectors: vi.fn(async () => []),
  testBrowserConsistency: vi.fn(async () => ({
    name: 'browser-consistency',
    category: 'Browser',
    passed: true,
    detail: 'OK'
  }))
}))

// ── Import the module under test ────────────────────────────────────────────

import { DetectionTestRunner } from '../../src/main/detection-test'

// ── Helpers ─────────────────────────────────────────────────────────────────

function getRunner(): DetectionTestRunner {
  return DetectionTestRunner.getInstance()
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('DetectionTestRunner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    profileRunning = false
    mockPage = createMockPage()
    mockBm.sessions.clear()
    setSession(mockPage)
    mockDb.getProfile.mockImplementation((id: string) => {
      if (id === 'profile-1') return { ...mockProfile }
      if (id === 'profile-missing') return null
      return { ...mockProfile, id }
    })
  })

  // ── 1. Singleton ────────────────────────────────────────────────────────

  describe('singleton', () => {
    it('returns the same instance on repeated calls', () => {
      const a = DetectionTestRunner.getInstance()
      const b = DetectionTestRunner.getInstance()
      expect(a).toBe(b)
    })
  })

  // ── 2. Scoring logic ──────────────────────────────────────────────────

  describe('scoring — all vectors pass', () => {
    it('returns score 100 when every vector passes', async () => {
      const result = await getRunner().runTest('profile-1')
      expect(result.overallScore).toBe(100)
      expect(result.vectors.every(v => v.passed)).toBe(true)
    })
  })

  describe('scoring — half vectors pass', () => {
    it('returns approximately score 50 when half the vectors fail', async () => {
      // Alternate between passing and failing return values per index
      let callIndex = 0
      const halfFailPage = {
        evaluate: vi.fn(async (_fn: Function) => {
          const idx = callIndex++
          // Even-indexed calls: pass, odd-indexed: fail
          if (idx % 2 === 0) {
            return idx < PASSING_RETURNS.length ? PASSING_RETURNS[idx] : true
          }
          return idx < FAILING_RETURNS.length ? FAILING_RETURNS[idx] : false
        }),
        goto: vi.fn(async () => {})
      }

      // Also make behavior-consistency fail for one half
      const { createBehaviorConsistencyVector } = await import('../../src/main/fingerprint/behavior-drift')
      vi.mocked(createBehaviorConsistencyVector).mockReturnValue({
        name: 'behavior-consistency', category: 'Behavior', passed: false, detail: 'FAIL'
      })

      setSession(halfFailPage)
      const result = await getRunner().runTest('profile-1')

      const totalVectors = result.vectors.length
      const passedCount = result.vectors.filter(v => v.passed).length
      const expectedScore = Math.round((passedCount / totalVectors) * 100)
      expect(result.overallScore).toBe(expectedScore)
      expect(result.overallScore).toBeGreaterThanOrEqual(30)
      expect(result.overallScore).toBeLessThanOrEqual(70)

      // Restore
      vi.mocked(createBehaviorConsistencyVector).mockReturnValue({
        name: 'behavior-consistency', category: 'Behavior', passed: true, detail: 'OK'
      })
    })
  })

  describe('scoring — no vectors pass', () => {
    it('returns score 0 when all vectors fail', async () => {
      let callIndex = 0
      const allFailPage = {
        evaluate: vi.fn(async () => {
          const idx = callIndex++
          return idx < FAILING_RETURNS.length ? FAILING_RETURNS[idx] : false
        }),
        goto: vi.fn(async () => {})
      }

      const { createBehaviorConsistencyVector } = await import('../../src/main/fingerprint/behavior-drift')
      const { testBrowserConsistency } = await import('../../src/main/fingerprint/browser-vectors')
      vi.mocked(createBehaviorConsistencyVector).mockReturnValue({
        name: 'behavior-consistency', category: 'Behavior', passed: false, detail: 'FAIL'
      })
      vi.mocked(testBrowserConsistency).mockResolvedValue({
        name: 'browser-consistency', category: 'Browser', passed: false, detail: 'FAIL'
      })

      setSession(allFailPage)
      const result = await getRunner().runTest('profile-1')
      expect(result.overallScore).toBe(0)
      expect(result.vectors.every(v => !v.passed)).toBe(true)

      // Restore mocks for other tests
      vi.mocked(createBehaviorConsistencyVector).mockReturnValue({
        name: 'behavior-consistency', category: 'Behavior', passed: true, detail: 'OK'
      })
      vi.mocked(testBrowserConsistency).mockResolvedValue({
        name: 'browser-consistency', category: 'Browser', passed: true, detail: 'OK'
      })
    })
  })

  // ── 3. Status thresholds ──────────────────────────────────────────────

  describe('status thresholds', () => {
    it('status is "passed" when score >= 90', async () => {
      const result = await getRunner().runTest('profile-1')
      expect(result.overallScore).toBeGreaterThanOrEqual(90)
      expect(result.status).toBe('passed')
    })

    it('status is "warning" when score is 70-89', async () => {
      // Run once to find total vector count
      const probe = await getRunner().runTest('profile-1')
      const totalVectors = probe.vectors.length

      // To get ~80%: fail the first ~20% of page.evaluate calls
      const failTarget = Math.floor(totalVectors * 0.2)
      let callIndex = 0

      const warningPage = {
        evaluate: vi.fn(async (_fn: Function) => {
          const idx = callIndex++
          // Fail the first N calls (using type-safe failing values), pass the rest
          if (idx < failTarget) {
            return idx < FAILING_RETURNS.length ? FAILING_RETURNS[idx] : false
          }
          if (idx < PASSING_RETURNS.length) return PASSING_RETURNS[idx]
          return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0'
        }),
        goto: vi.fn(async () => {})
      }

      vi.clearAllMocks()
      callIndex = 0
      mockDb.getProfile.mockImplementation((id: string) => {
        if (id === 'profile-missing') return null
        return { ...mockProfile, id: id || 'profile-1' }
      })
      setSession(warningPage)

      const result = await getRunner().runTest('profile-1')
      expect(result.overallScore).toBeGreaterThanOrEqual(70)
      expect(result.overallScore).toBeLessThan(90)
      expect(result.status).toBe('warning')
    })

    it('status is "failed" when score < 70', async () => {
      // Run once to find total vector count
      const probe = await getRunner().runTest('profile-1')
      const totalVectors = probe.vectors.length

      // Fail the first ~50% of evaluate calls
      const failTarget = Math.floor(totalVectors * 0.5)
      let callIndex = 0

      const failPage = {
        evaluate: vi.fn(async (_fn: Function) => {
          const idx = callIndex++
          if (idx < failTarget) {
            return idx < FAILING_RETURNS.length ? FAILING_RETURNS[idx] : false
          }
          if (idx < PASSING_RETURNS.length) return PASSING_RETURNS[idx]
          return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0'
        }),
        goto: vi.fn(async () => {})
      }

      vi.clearAllMocks()
      callIndex = 0
      mockDb.getProfile.mockImplementation((id: string) => {
        if (id === 'profile-missing') return null
        return { ...mockProfile, id: id || 'profile-1' }
      })
      setSession(failPage)

      const result = await getRunner().runTest('profile-1')
      expect(result.overallScore).toBeLessThan(70)
      expect(result.status).toBe('failed')
    })
  })

  // ── 4. Result structure and persistence ───────────────────────────────

  describe('result persistence', () => {
    it('calls saveDetectionTestResult with correct structure', async () => {
      const result = await getRunner().runTest('profile-1')

      expect(mockDb.saveDetectionTestResult).toHaveBeenCalledTimes(1)
      const saved = mockDb.saveDetectionTestResult.mock.calls[0][0]

      expect(saved.id).toBe('test-uuid-detection')
      expect(saved.profileId).toBe('profile-1')
      expect(saved.profileName).toBe('Test Profile')
      expect(saved.testedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
      expect(saved.overallScore).toBeGreaterThanOrEqual(0)
      expect(saved.overallScore).toBeLessThanOrEqual(100)
      expect(Array.isArray(saved.vectors)).toBe(true)
      expect(['passed', 'warning', 'failed']).toContain(saved.status)
    })

    it('each vector has name, category, passed, and detail', async () => {
      const result = await getRunner().runTest('profile-1')

      for (const v of result.vectors) {
        expect(v).toHaveProperty('name')
        expect(v).toHaveProperty('category')
        expect(v).toHaveProperty('passed')
        expect(typeof v.name).toBe('string')
        expect(typeof v.category).toBe('string')
        expect(typeof v.passed).toBe('boolean')
      }
    })

    it('result returned from runTest matches what was persisted', async () => {
      const result = await getRunner().runTest('profile-1')
      const saved = mockDb.saveDetectionTestResult.mock.calls[0][0]
      expect(result).toEqual(saved)
    })
  })

  // ── 5. Profile not found ──────────────────────────────────────────────

  describe('profile not found', () => {
    it('throws when profile does not exist', async () => {
      await expect(getRunner().runTest('profile-missing'))
        .rejects.toThrow('Profile profile-missing not found')
    })

    it('does not call saveDetectionTestResult on profile not found', async () => {
      try { await getRunner().runTest('profile-missing') } catch {}
      expect(mockDb.saveDetectionTestResult).not.toHaveBeenCalled()
    })
  })

  // ── 6. getResults ─────────────────────────────────────────────────────

  describe('getResults', () => {
    it('returns all results when no profileId specified', () => {
      const results = getRunner().getResults()
      expect(results).toHaveLength(2)
      expect(mockDb.getDetectionTestResults).toHaveBeenCalledWith(undefined)
    })

    it('returns filtered results when profileId is provided', () => {
      const results = getRunner().getResults('profile-1')
      expect(results).toHaveLength(1)
      expect(results[0].profileId).toBe('profile-1')
      expect(mockDb.getDetectionTestResults).toHaveBeenCalledWith('profile-1')
    })

    it('returns empty array for unknown profileId', () => {
      const results = getRunner().getResults('nonexistent')
      expect(results).toHaveLength(0)
    })
  })

  // ── 7. Profile lifecycle — launches if not running ────────────────────

  describe('profile lifecycle — not running', () => {
    it('launches the profile when it is not already running', async () => {
      profileRunning = false
      await getRunner().runTest('profile-1')

      expect(mockBm.launchProfile).toHaveBeenCalledTimes(1)
      expect(mockBm.launchProfile).toHaveBeenCalledWith(
        'profile-1',
        expect.objectContaining({ preset: 'win10-chrome120' })
      )
    })

    it('closes the profile after test when it was not running before', async () => {
      profileRunning = false
      await getRunner().runTest('profile-1')

      expect(mockBm.closeProfile).toHaveBeenCalledTimes(1)
      expect(mockBm.closeProfile).toHaveBeenCalledWith('profile-1')
    })

    it('still closes the profile even if closeProfile rejects', async () => {
      profileRunning = false
      mockBm.closeProfile.mockRejectedValueOnce(new Error('close failed'))

      // Should not throw — the finally block catches close errors
      const result = await getRunner().runTest('profile-1')
      expect(result).toBeDefined()
      expect(mockBm.closeProfile).toHaveBeenCalledWith('profile-1')
    })
  })

  // ── 8. Profile lifecycle — already running ────────────────────────────

  describe('profile lifecycle — already running', () => {
    it('does not launch the profile when it is already running', async () => {
      profileRunning = true
      await getRunner().runTest('profile-1')

      expect(mockBm.launchProfile).not.toHaveBeenCalled()
    })

    it('does not close the profile after test when it was already running', async () => {
      profileRunning = true
      await getRunner().runTest('profile-1')

      expect(mockBm.closeProfile).not.toHaveBeenCalled()
    })
  })

  // ── 9. Session not found ──────────────────────────────────────────────

  describe('session not found', () => {
    it('throws when browser session is missing from sessions map', async () => {
      mockBm.sessions.clear()
      await expect(getRunner().runTest('profile-1'))
        .rejects.toThrow('Profile browser session not found')
    })
  })

  // ── 10. Fingerprint parsing ───────────────────────────────────────────

  describe('fingerprint parsing', () => {
    it('handles fingerprint stored as JSON string', async () => {
      mockDb.getProfile.mockReturnValue({
        ...mockProfile,
        fingerprint: JSON.stringify({ preset: 'mac-ventura-chrome120' })
      })

      const result = await getRunner().runTest('profile-1')
      expect(result).toBeDefined()
      expect(mockBm.launchProfile).toHaveBeenCalledWith(
        'profile-1',
        expect.objectContaining({ preset: 'mac-ventura-chrome120' })
      )
    })

    it('handles fingerprint stored as object (already parsed)', async () => {
      mockDb.getProfile.mockReturnValue({
        ...mockProfile,
        fingerprint: { preset: 'linux-ubuntu-chrome120' }
      })

      const result = await getRunner().runTest('profile-1')
      expect(result).toBeDefined()
      expect(mockBm.launchProfile).toHaveBeenCalledWith(
        'profile-1',
        expect.objectContaining({ preset: 'linux-ubuntu-chrome120' })
      )
    })
  })

  // ── 11. Vector count ──────────────────────────────────────────────────

  describe('vector count', () => {
    it('evaluates at least 40 vectors', async () => {
      const result = await getRunner().runTest('profile-1')
      // Source has ~47 page.evaluate calls + behavior-consistency + browser-consistency = ~49+
      expect(result.vectors.length).toBeGreaterThanOrEqual(40)
    })
  })

  // ── 12. Scoring formula correctness ───────────────────────────────────

  describe('scoring formula', () => {
    it('overallScore equals Math.round((passed / total) * 100)', async () => {
      const result = await getRunner().runTest('profile-1')
      const passed = result.vectors.filter(v => v.passed).length
      const total = result.vectors.length
      expect(result.overallScore).toBe(Math.round((passed / total) * 100))
    })
  })
})
