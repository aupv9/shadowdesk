/**
 * Phase 17.H — Platform-Specific Detection Hardening
 *
 * Unit tests for the pure helpers in `src/main/platform-hardener.ts`.
 * We avoid importing the DB-backed validator variant so the suite stays
 * free of mocks.
 */

import { describe, it, expect, vi } from 'vitest'

// Database is imported transitively by platform-hardener (validatePreFlightById)
// so we stub it to keep the module load side-effect-free.
vi.mock('../../src/main/database', () => ({
  Database: {
    getInstance: () => ({
      getWorkflow: vi.fn(),
      getProfile: vi.fn()
    })
  }
}))

import {
  detectPlatformFromUrl,
  extractTargetUrl,
  buildTuningHint,
  getAllTuningHints,
  validatePreFlight,
  applyFix,
  analyzeRuntimeSignal
} from '../../src/main/platform-hardener'
import type { AutomationWorkflow, FingerprintConfig } from '../../src/shared/types'

const STUB_FP: FingerprintConfig = {
  preset: 'win10-chrome120',
  os: { platform: 'Win32', version: '10.0.0' },
  browser: { userAgent: 'ua', platform: 'Win32', vendor: 'Google Inc.', version: '120', languages: ['en'] },
  screen: { width: 1920, height: 1080, availWidth: 1920, availHeight: 1040, colorDepth: 24, pixelRatio: 1 },
  hardware: { deviceMemory: 8, hardwareConcurrency: 8, maxTouchPoints: 0 },
  locale: { language: 'en-US', languages: ['en-US', 'en'], timezone: 'UTC' },
  webrtc: { enabled: true, mode: 'fake' },
  canvas: { mode: 'noise', noiseSeed: 1 },
  webgl: { vendor: 'Google Inc.', renderer: 'ANGLE', noiseSeed: 1 },
  audio: { mode: 'noise', noiseSeed: 1 },
  fonts: { mode: 'whitelist', whitelist: [] },
  media: { audioInputs: 1, audioOutputs: 1, videoInputs: 1 },
  plugins: { mode: 'realistic' },
  speech: { mode: 'filter' },
  behavior: {
    mouseJitter: false,
    typingNoise: false,
    scrollInertia: false
  },
  timing: {
    dateNoisePrecision: 50,
    rafJitter: false,
    performanceClamp: false
  }
}

function stubWorkflow(url: string): AutomationWorkflow {
  return {
    id: 'wf-test',
    name: 'test',
    description: '',
    steps: [
      { id: 's1', action: 'navigate', label: 'open', params: { url } }
    ]
  } as AutomationWorkflow
}

describe('platform-hardener — URL detection', () => {
  it('detects Shopee VN from base URL', () => {
    const res = detectPlatformFromUrl('https://shopee.vn/shop/123')
    expect(res.platformId).toBe('shopee')
    expect(res.platformName).toBe('Shopee')
  })

  it('detects Lazada TH from region URL', () => {
    const res = detectPlatformFromUrl('https://www.lazada.co.th/catalog')
    expect(res.platformId).toBe('lazada')
  })

  it('detects TikTok Shop from shop subdomain', () => {
    const res = detectPlatformFromUrl('https://shop.tiktok.com/@vn')
    expect(res.platformId).toBe('tiktok-shop')
  })

  it('falls back to keyword scan for subdomains', () => {
    const res = detectPlatformFromUrl('https://seller.shopee.vn/login')
    expect(res.platformId).toBe('shopee')
  })

  it('returns null for unknown domains', () => {
    const res = detectPlatformFromUrl('https://example.com/foo')
    expect(res.platformId).toBeNull()
  })

  it('handles bare hostnames without a scheme', () => {
    const res = detectPlatformFromUrl('tiki.vn/p/123')
    expect(res.platformId).toBe('tiki')
  })

  it('returns null for malformed input', () => {
    const res = detectPlatformFromUrl('not a url')
    expect(res.platformId).toBeNull()
  })
})

describe('platform-hardener — extractTargetUrl', () => {
  it('picks the first navigate step URL', () => {
    const steps: any = [
      { id: '1', action: 'wait', params: { ms: 100 } },
      { id: '2', action: 'navigate', params: { url: 'https://shopee.vn' } },
      { id: '3', action: 'navigate', params: { url: 'https://other.com' } }
    ]
    expect(extractTargetUrl(steps)).toBe('https://shopee.vn')
  })

  it('returns undefined when no navigate step exists', () => {
    const steps: any = [{ id: '1', action: 'wait', params: { ms: 100 } }]
    expect(extractTargetUrl(steps)).toBeUndefined()
  })
})

describe('platform-hardener — tuning hints', () => {
  it('builds a full tuning hint for Shopee', () => {
    const hint = buildTuningHint('shopee')
    expect(hint).not.toBeNull()
    expect(hint!.platformId).toBe('shopee')
    expect(hint!.recommendedBehaviorPreset).toBe('heavy')
    expect(hint!.recommendedBehavior.scrollInertia).toBe(true)
    expect(hint!.recommendedFingerprintPresets.length).toBeGreaterThan(0)
  })

  it('returns null for unknown platforms', () => {
    expect(buildTuningHint('unknown-xyz')).toBeNull()
  })

  it('exposes all built-in platform tuning hints', () => {
    const all = getAllTuningHints()
    const ids = all.map((h) => h.platformId)
    expect(ids).toContain('shopee')
    expect(ids).toContain('lazada')
    expect(ids).toContain('tiktok-shop')
  })
})

describe('platform-hardener — validatePreFlight', () => {
  it('flags behavior-disabled as critical when a platform matches', () => {
    const wf = stubWorkflow('https://shopee.vn')
    const fp = JSON.stringify(STUB_FP)
    const result = validatePreFlight(wf, { id: 'p1', name: 'P1', fingerprint: fp })
    const behaviorIssue = result.issues.find((i) => i.code === 'behavior-disabled')
    expect(behaviorIssue).toBeDefined()
    expect(behaviorIssue!.severity).toBe('critical')
    expect(result.verdict).toBe('block')
    expect(result.platform?.platformId).toBe('shopee')
  })

  it('downgrades behavior-disabled to warning on non-platform workflows', () => {
    const wf = stubWorkflow('https://example.com')
    const fp = JSON.stringify(STUB_FP)
    const result = validatePreFlight(wf, { id: 'p1', name: 'P1', fingerprint: fp })
    const behaviorIssue = result.issues.find((i) => i.code === 'behavior-disabled')
    expect(behaviorIssue?.severity).toBe('warning')
    expect(result.verdict).toBe('warn')
  })

  it('flags TikTok Shop + desktop preset as critical', () => {
    const wf = stubWorkflow('https://shop.tiktok.com/@vn')
    const fp: FingerprintConfig = {
      ...STUB_FP,
      preset: 'win10-chrome120',
      behavior: { mouseJitter: true, typingNoise: true, scrollInertia: true },
      timing: { dateNoisePrecision: 100, rafJitter: true, performanceClamp: true }
    }
    const result = validatePreFlight(wf, { id: 'p1', name: 'P1', fingerprint: JSON.stringify(fp) })
    const tiktok = result.issues.find((i) => i.code === 'tiktok-shop-desktop-preset')
    expect(tiktok).toBeDefined()
    expect(tiktok!.severity).toBe('critical')
    expect(result.verdict).toBe('block')
  })

  it('flags VNPay as blocked', () => {
    const wf = stubWorkflow('https://pay.vnpay.vn/checkout')
    const fp: FingerprintConfig = {
      ...STUB_FP,
      behavior: { mouseJitter: true, typingNoise: true, scrollInertia: true },
      timing: { dateNoisePrecision: 100, rafJitter: true, performanceClamp: true }
    }
    const result = validatePreFlight(wf, { id: 'p1', name: 'P1', fingerprint: JSON.stringify(fp) })
    expect(result.issues.some((i) => i.code === 'platform-blocked')).toBe(true)
    expect(result.verdict).toBe('block')
  })

  it('returns ready verdict when everything is tuned', () => {
    const wf = stubWorkflow('https://tiki.vn/search')
    const fp: FingerprintConfig = {
      ...STUB_FP,
      behavior: {
        mouseJitter: true,
        typingNoise: true,
        scrollInertia: true,
        typingWpm: 85,
        typingVariancePct: 18,
        scrollDecay: 0.9,
        mouseJitterSigma: 0.3
      },
      timing: {
        dateNoisePrecision: 50,
        rafJitter: true,
        performanceClamp: true,
        rafJitterSigmaMs: 1.0
      }
    }
    const result = validatePreFlight(wf, { id: 'p1', name: 'P1', fingerprint: JSON.stringify(fp) })
    // Tiki is a match, so we still get the info-level tuning hint, but no
    // warnings or critical issues — verdict should therefore be `ready`.
    expect(result.verdict).toBe('ready')
  })
})

describe('platform-hardener — applyFix', () => {
  it('merges behavior partials into a fingerprint', () => {
    const patched = applyFix(STUB_FP, {
      label: 'test',
      behavior: { mouseJitter: true, scrollDecay: 0.83 }
    })
    expect(patched.behavior?.mouseJitter).toBe(true)
    expect(patched.behavior?.scrollDecay).toBe(0.83)
  })

  it('applies a full preset bundle', () => {
    const patched = applyFix(STUB_FP, {
      label: 'test',
      applyPreset: 'heavy'
    })
    expect(patched.behavior?.mouseJitter).toBe(true)
    expect(patched.behavior?.scrollInertia).toBe(true)
    expect(patched.timing?.rafJitter).toBe(true)
  })

  it('switches fingerprint preset key', () => {
    const patched = applyFix(STUB_FP, {
      label: 'test',
      applyFingerprintPreset: 'android-pixel-chrome121'
    })
    expect(patched.preset).toBe('android-pixel-chrome121')
  })
})

describe('platform-hardener — analyzeRuntimeSignal', () => {
  it('matches CAPTCHA keyword in step-error', () => {
    const event = analyzeRuntimeSignal({
      workflowId: 'wf',
      profileId: 'p',
      currentUrl: 'https://shopee.vn/login',
      kind: 'step-error',
      detail: 'Element reCAPTCHA was not found'
    })
    expect(event).not.toBeNull()
    expect(event!.challengeKind).toBe('captcha')
    expect(event!.suggestedFix).toBeDefined()
  })

  it('matches slider challenge on Lazada', () => {
    const event = analyzeRuntimeSignal({
      workflowId: 'wf',
      profileId: 'p',
      currentUrl: 'https://www.lazada.vn/catalog',
      kind: 'page-text',
      detail: 'Please drag the slider to verify'
    })
    expect(event).not.toBeNull()
    expect(event!.challengeKind).toBe('slider')
  })

  it('returns null on non-challenge signals', () => {
    const event = analyzeRuntimeSignal({
      workflowId: 'wf',
      profileId: 'p',
      kind: 'step-error',
      detail: 'Timeout waiting for navigation'
    })
    expect(event).toBeNull()
  })
})
