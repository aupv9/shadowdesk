/**
 * Coherence rules R1–R14.
 *
 * The existing detection suite can only assert that agreement is detected —
 * it has no way to produce a contradiction. These tests do the inverse: build
 * a deliberately incoherent profile and assert the rule fires. A rule that
 * cannot fail is not a check.
 */
import { describe, it, expect } from 'vitest'
import {
  COHERENCE_RULES,
  runCoherenceRules,
  osFromUserAgent,
  osFromPlatform,
  osFromRenderer,
  chromeMajorFromUa,
  type CoherenceContext,
  type MainSnapshot,
  type RealmSnapshot
} from '../../src/main/fingerprint/coherence'
import type { FingerprintConfig } from '../../src/shared/types'

const WIN_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const MAC_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 13; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'

const realm = (over: Partial<RealmSnapshot> = {}): RealmSnapshot => ({
  userAgent: WIN_UA,
  platform: 'Win32',
  languages: ['en-US', 'en'],
  hardwareConcurrency: 8,
  deviceMemory: 8,
  ...over
})

const main = (over: Partial<MainSnapshot> = {}): MainSnapshot => ({
  ...realm(),
  language: 'en-US',
  timeZone: 'America/New_York',
  uachPlatform: 'Windows',
  uaBrands: [{ brand: 'Google Chrome', version: '120' }],
  webglVendor: 'Google Inc. (NVIDIA)',
  webglRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0, D3D11)',
  maxTouchPoints: 0,
  hasTouchStart: false,
  pointerCoarse: false,
  screen: { width: 1920, height: 1080, availWidth: 1920, availHeight: 1040, pixelRatio: 1 },
  ...over
})

const declared = (over: Partial<FingerprintConfig> = {}): FingerprintConfig =>
  ({
    preset: 'win10-chrome120',
    locale: { language: 'en-US', languages: ['en-US', 'en'], timezone: 'America/New_York' },
    screen: { width: 1920, height: 1080, availWidth: 1920, availHeight: 1040, colorDepth: 24, pixelRatio: 1 },
    fonts: { mode: 'whitelist', whitelist: ['Segoe UI', 'Calibri', 'Cambria', 'Arial'] },
    ...over
  }) as FingerprintConfig

/** A fully self-consistent Windows/Chrome 120 desktop profile. */
function coherentContext(over: Partial<CoherenceContext> = {}): CoherenceContext {
  return {
    declared: declared(),
    main: main(),
    worker: realm(),
    iframe: realm(),
    proxy: { ip: '203.0.113.10', countryCode: 'US', timezone: 'America/New_York' },
    render: { canvas: 'aaa', webgl: 'bbb', audio: 'ccc' },
    baseline: { canvas: 'aaa', webgl: 'bbb', audio: 'ccc' },
    otherProfiles: [{ profileId: 'other-1', hashes: { canvas: 'xxx', webgl: 'yyy', audio: 'zzz' } }],
    webrtcPublicIps: ['203.0.113.10'],
    binaryMajor: 120,
    ...over
  }
}

function outcome(ctx: CoherenceContext, ruleId: string) {
  const rule = COHERENCE_RULES.find((r) => r.id === ruleId)
  if (!rule) throw new Error(`No rule ${ruleId}`)
  return rule.evaluate(ctx)
}

// ── Helpers ──────────────────────────────────────────────────────────────────

describe('OS inference helpers', () => {
  it('reads Android before Linux — every Android UA also says Linux', () => {
    expect(osFromUserAgent(ANDROID_UA)).toBe('Android')
    expect(osFromUserAgent('Mozilla/5.0 (X11; Linux x86_64)')).toBe('Linux')
  })

  it('maps navigator.platform to a family', () => {
    expect(osFromPlatform('Win32')).toBe('Windows')
    expect(osFromPlatform('MacIntel')).toBe('macOS')
    expect(osFromPlatform('Linux armv8l')).toBe('Android')
  })

  it('infers OS from GPU strings, and stays silent on unknown ones', () => {
    expect(osFromRenderer('ANGLE (Apple, Apple M2, OpenGL 4.1)')).toContain('macOS')
    expect(osFromRenderer('ANGLE (NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0)')).toEqual(['Windows'])
    expect(osFromRenderer('Mali-G78')).toEqual(['Android'])
    expect(osFromRenderer('Some Unlabelled GPU')).toEqual([])
    expect(osFromRenderer(undefined)).toEqual([])
  })

  it('extracts the Chrome major', () => {
    expect(chromeMajorFromUa(WIN_UA)).toBe(120)
    expect(chromeMajorFromUa('Mozilla/5.0 Firefox/121.0')).toBeNull()
  })
})

// ── The coherent baseline must be silent ─────────────────────────────────────

describe('a coherent profile', () => {
  it('trips no rule', () => {
    const vectors = runCoherenceRules(coherentContext())
    const failures = vectors.filter((v) => v.status === 'fail')
    expect(failures.map((f) => f.name)).toEqual([])
  })

  it('marks every rule as coherence-sourced so it scores as risk, not injection', () => {
    for (const v of runCoherenceRules(coherentContext())) {
      expect(v.source).toBe('coherence')
    }
  })
})

// ── Individual rules ─────────────────────────────────────────────────────────

describe('R1 — OS agreement across UA, platform and UA-CH', () => {
  it('catches a Windows UA on a macOS platform string', () => {
    const r = outcome(coherentContext({ main: main({ platform: 'MacIntel' }) }), 'R1')
    expect(r.status).toBe('fail')
    expect(r.detail).toContain('macOS')
  })

  it('catches a UA-CH platform that disagrees with the UA', () => {
    expect(outcome(coherentContext({ main: main({ uachPlatform: 'Android' }) }), 'R1').status).toBe('fail')
  })

  it('is unavailable rather than failing when only one source knows the OS', () => {
    const ctx = coherentContext({
      main: main({ userAgent: 'Opaque/1.0', platform: 'Unknown', uachPlatform: undefined })
    })
    expect(outcome(ctx, 'R1').status).toBe('unavailable')
  })
})

describe('R2 — WebGL renderer vs claimed OS', () => {
  it('catches a Windows UA rendering on an Apple GPU', () => {
    const ctx = coherentContext({
      main: main({ webglRenderer: 'ANGLE (Apple, Apple M2, OpenGL 4.1 Metal - 83.1)' })
    })
    const r = outcome(ctx, 'R2')
    expect(r.status).toBe('fail')
    expect(r.detail).toContain('Apple')
  })

  it('accepts an Apple GPU under a macOS UA', () => {
    const ctx = coherentContext({
      main: main({ userAgent: MAC_UA, platform: 'MacIntel', uachPlatform: 'macOS', webglRenderer: 'Apple M2' })
    })
    expect(outcome(ctx, 'R2').status).toBe('pass')
  })

  it('does not fail on a GPU string with no OS signal', () => {
    const ctx = coherentContext({ main: main({ webglRenderer: 'Generic Renderer' }) })
    expect(outcome(ctx, 'R2').status).toBe('unavailable')
  })
})

describe('R3/R4 — realm parity', () => {
  it('catches a worker whose UA was not overridden', () => {
    const ctx = coherentContext({ worker: realm({ userAgent: 'HeadlessChrome/120.0.0.0' }) })
    const r = outcome(ctx, 'R3')
    expect(r.status).toBe('fail')
    expect(r.detail).toContain('userAgent')
  })

  it('catches a worker leaking the real core count', () => {
    const ctx = coherentContext({ worker: realm({ hardwareConcurrency: 32 }) })
    expect(outcome(ctx, 'R3').detail).toContain('hardwareConcurrency')
  })

  it('catches an iframe that escaped the override', () => {
    const ctx = coherentContext({ iframe: realm({ platform: 'Linux x86_64' }) })
    expect(outcome(ctx, 'R4').status).toBe('fail')
  })

  it('reports unavailable — not fail — when the realm could not be created', () => {
    expect(outcome(coherentContext({ worker: null }), 'R3').status).toBe('unavailable')
    expect(outcome(coherentContext({ iframe: null }), 'R4').status).toBe('unavailable')
  })
})

describe('R5 — WebRTC leak', () => {
  it('catches a public IP that is not the proxy', () => {
    const ctx = coherentContext({ webrtcPublicIps: ['203.0.113.10', '198.51.100.7'] })
    const r = outcome(ctx, 'R5')
    expect(r.status).toBe('fail')
    expect(r.detail).toContain('198.51.100.7')
  })

  it('has nothing to check when the profile runs direct', () => {
    expect(outcome(coherentContext({ proxy: null }), 'R5').status).toBe('unavailable')
  })
})

describe('R6 — timezone vs Intl vs proxy geo', () => {
  it('catches a browser clock that disagrees with the proxy location', () => {
    const ctx = coherentContext({
      main: main({ timeZone: 'Asia/Bangkok' }),
      declared: declared({
        locale: { language: 'en-US', languages: ['en-US'], timezone: 'Asia/Bangkok' }
      } as Partial<FingerprintConfig>)
    })
    const r = outcome(ctx, 'R6')
    expect(r.status).toBe('fail')
    expect(r.detail).toContain('America/New_York')
  })

  it('catches an override that never took effect', () => {
    const ctx = coherentContext({ main: main({ timeZone: 'UTC' }), proxy: null })
    expect(outcome(ctx, 'R6').status).toBe('fail')
  })

  it('tolerates a coarse regional zone from the geo lookup', () => {
    const ctx = coherentContext({
      main: main({ timeZone: 'America/Detroit' }),
      declared: declared({
        locale: { language: 'en-US', languages: ['en-US'], timezone: 'America/Detroit' }
      } as Partial<FingerprintConfig>)
    })
    expect(outcome(ctx, 'R6').status).toBe('pass')
  })
})

describe('R7 — language chain', () => {
  it('catches navigator.language disagreeing with languages[0]', () => {
    const ctx = coherentContext({ main: main({ language: 'vi-VN' }) })
    expect(outcome(ctx, 'R7').status).toBe('fail')
  })

  it('catches an empty languages array', () => {
    const ctx = coherentContext({ main: main({ languages: [] }) })
    expect(outcome(ctx, 'R7').detail).toContain('empty')
  })
})

describe('R8 — screen geometry', () => {
  it('catches availWidth exceeding width', () => {
    const ctx = coherentContext({
      main: main({ screen: { width: 1920, height: 1080, availWidth: 2560, availHeight: 1040, pixelRatio: 1 } })
    })
    expect(outcome(ctx, 'R8').status).toBe('fail')
  })

  it('catches a declared resolution the browser never reported', () => {
    const ctx = coherentContext({
      main: main({ screen: { width: 1366, height: 768, availWidth: 1366, availHeight: 728, pixelRatio: 1 } })
    })
    expect(outcome(ctx, 'R8').detail).toContain('1366x768')
  })
})

describe('R9 — touch vs device class', () => {
  it('catches maxTouchPoints disagreeing with ontouchstart', () => {
    const ctx = coherentContext({ main: main({ maxTouchPoints: 5, hasTouchStart: false }) })
    expect(outcome(ctx, 'R9').status).toBe('fail')
  })

  it('catches an Android UA reporting no touch', () => {
    const ctx = coherentContext({
      main: main({ userAgent: ANDROID_UA, platform: 'Linux armv8l', maxTouchPoints: 0, hasTouchStart: false })
    })
    expect(outcome(ctx, 'R9').detail).toContain('maxTouchPoints=0')
  })

  it('catches a desktop UA that matches pointer:coarse', () => {
    const ctx = coherentContext({ main: main({ pointerCoarse: true }) })
    expect(outcome(ctx, 'R9').detail).toContain('pointer:coarse')
  })

  it('accepts a coherent Android profile', () => {
    const ctx = coherentContext({
      main: main({
        userAgent: ANDROID_UA,
        platform: 'Linux armv8l',
        uachPlatform: 'Android',
        webglRenderer: 'Mali-G78',
        maxTouchPoints: 5,
        hasTouchStart: true,
        pointerCoarse: true
      })
    })
    expect(outcome(ctx, 'R9').status).toBe('pass')
  })
})

describe('R10 — Chrome version coherence', () => {
  it('catches a UA-CH brand version that contradicts the UA', () => {
    const ctx = coherentContext({ main: main({ uaBrands: [{ brand: 'Google Chrome', version: '114' }] }) })
    expect(outcome(ctx, 'R10').status).toBe('fail')
  })

  it('catches a UA claiming a version far from the real binary', () => {
    const ctx = coherentContext({ binaryMajor: 109 })
    expect(outcome(ctx, 'R10').detail).toContain('109')
  })

  it('tolerates a one-version drift', () => {
    expect(outcome(coherentContext({ binaryMajor: 121 }), 'R10').status).toBe('pass')
  })

  it('does not apply to a non-Chromium UA', () => {
    const ctx = coherentContext({ main: main({ userAgent: 'Mozilla/5.0 Firefox/121.0', uaBrands: undefined }) })
    expect(outcome(ctx, 'R10').status).toBe('unavailable')
  })
})

describe('R11 — rendered output stable across sessions', () => {
  it('catches a canvas that changed since the last run', () => {
    const ctx = coherentContext({ baseline: { canvas: 'DIFFERENT', webgl: 'bbb', audio: 'ccc' } })
    const r = outcome(ctx, 'R11')
    expect(r.status).toBe('fail')
    expect(r.detail).toContain('canvas')
  })

  it('has no verdict on the first run of a profile', () => {
    expect(outcome(coherentContext({ baseline: null }), 'R11').status).toBe('unavailable')
  })
})

describe('R12 — rendered output unique across profiles', () => {
  it('catches two profiles painting the same canvas', () => {
    const ctx = coherentContext({
      otherProfiles: [{ profileId: 'twin', hashes: { canvas: 'aaa', webgl: 'other', audio: 'other' } }]
    })
    const r = outcome(ctx, 'R12')
    expect(r.status).toBe('fail')
    expect(r.detail).toContain('twin')
  })

  it('ignores empty hashes from profiles that never recorded one', () => {
    const ctx = coherentContext({
      render: { canvas: '', webgl: '', audio: '' },
      otherProfiles: [{ profileId: 'blank', hashes: { canvas: '', webgl: '', audio: '' } }]
    })
    expect(outcome(ctx, 'R12').status).toBe('pass')
  })
})

describe('R13 — hardware plausibility', () => {
  it('catches a phone claiming a workstation core count', () => {
    const ctx = coherentContext({
      main: main({ userAgent: ANDROID_UA, platform: 'Linux armv8l', hardwareConcurrency: 24 })
    })
    expect(outcome(ctx, 'R13').status).toBe('fail')
  })

  it('catches iOS exposing deviceMemory, which real Safari never does', () => {
    const ctx = coherentContext({
      main: main({
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) Version/17.0 Safari/605.1.15',
        platform: 'iPhone',
        deviceMemory: 8,
        hardwareConcurrency: 6
      })
    })
    expect(outcome(ctx, 'R13').detail).toContain('deviceMemory')
  })

  it('catches a deviceMemory value Chrome would never report', () => {
    const ctx = coherentContext({ main: main({ deviceMemory: 12 }) })
    expect(outcome(ctx, 'R13').status).toBe('fail')
  })
})

describe('R14 — font list vs claimed OS', () => {
  it('catches a Windows profile exposing macOS-exclusive fonts', () => {
    const ctx = coherentContext({
      declared: declared({
        fonts: { mode: 'whitelist', whitelist: ['Segoe UI', 'Calibri', 'Cambria', 'Menlo'] }
      })
    })
    const r = outcome(ctx, 'R14')
    expect(r.status).toBe('fail')
    expect(r.detail).toContain('Menlo')
  })

  it('catches a Windows profile with none of the Windows signature fonts', () => {
    const ctx = coherentContext({
      declared: declared({ fonts: { mode: 'whitelist', whitelist: ['Arial', 'Verdana'] } })
    })
    expect(outcome(ctx, 'R14').detail).toContain('signature fonts')
  })

  it('does not treat shared macOS/iOS families as foreign', () => {
    const ctx = coherentContext({
      main: main({ userAgent: MAC_UA, platform: 'MacIntel', uachPlatform: 'macOS', webglRenderer: 'Apple M2' }),
      declared: declared({
        fonts: { mode: 'whitelist', whitelist: ['Helvetica Neue', 'Menlo', 'Geneva'] }
      })
    })
    expect(outcome(ctx, 'R14').status).toBe('pass')
  })

  it('is unavailable when the profile exposes real fonts', () => {
    const ctx = coherentContext({ declared: declared({ fonts: { mode: 'real', whitelist: [] } }) })
    expect(outcome(ctx, 'R14').status).toBe('unavailable')
  })
})

// ── Fault tolerance ──────────────────────────────────────────────────────────

describe('runCoherenceRules', () => {
  it('turns a throwing rule into unavailable instead of losing the sweep', () => {
    const ctx = coherentContext()
    // A context whose getters explode mimics a malformed stored fingerprint.
    Object.defineProperty(ctx, 'declared', {
      get() {
        throw new Error('corrupt fingerprint JSON')
      }
    })
    const vectors = runCoherenceRules(ctx)
    expect(vectors).toHaveLength(COHERENCE_RULES.length)
    expect(vectors.some((v) => v.status === 'unavailable')).toBe(true)
  })

  it('emits one vector per rule', () => {
    expect(runCoherenceRules(coherentContext())).toHaveLength(14)
  })
})
