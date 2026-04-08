import { describe, it, expect } from 'vitest'
import {
  buildSampleFromProfile,
  buildFingerprint,
  computePairSimilarity,
  scanCorrelations,
  BEHAVIOR_CORRELATION_CONSTANTS,
} from '../../src/main/fingerprint/behavior-correlation'
import type { Profile, BehaviorSample } from '../../src/shared/types'

// ── Test fixtures ──────────────────────────────────────────────────────────

function makeProfile(
  id: string,
  name: string,
  behaviorOverrides: Partial<Profile['fingerprint']['behavior']> = {}
): Profile {
  return {
    id,
    name,
    fingerprint: {
      preset: 'win10-chrome120',
      os: { platform: 'Win32', version: '10.0.0' },
      browser: { userAgent: 'x', platform: 'Win32', vendor: 'Google Inc.', version: '120', languages: ['en-US'] },
      screen: { width: 1920, height: 1080, availWidth: 1920, availHeight: 1040, colorDepth: 24, pixelRatio: 1 },
      hardware: { deviceMemory: 8, hardwareConcurrency: 8, maxTouchPoints: 0 },
      locale: { language: 'en-US', languages: ['en-US'], timezone: 'America/New_York' },
      webrtc: { enabled: true, mode: 'fake' },
      canvas: { mode: 'noise', noiseSeed: 0 },
      webgl: { vendor: 'Google Inc.', renderer: 'ANGLE', noiseSeed: 0 },
      audio: { mode: 'noise', noiseSeed: 0 },
      fonts: { mode: 'whitelist', whitelist: ['Arial'] },
      media: { audioInputs: 1, audioOutputs: 1, videoInputs: 1 },
      plugins: { mode: 'realistic' },
      speech: { mode: 'filter' },
      behavior: {
        mouseJitter: true,
        typingNoise: true,
        scrollInertia: true,
        typingWpm: 75,
        typingVariancePct: 20,
        mouseJitterSigma: 0.4,
        scrollDecay: 0.88,
        scrollNoisePx: 2,
        mouseJitterIntensity: 'moderate',
        ...behaviorOverrides,
      },
    },
    status: 'active',
    created_at: new Date().toISOString(),
  } as Profile
}

describe('behavior-correlation: buildSampleFromProfile', () => {
  it('extracts all 8 behavioral features from a profile with behavior config', () => {
    const profile = makeProfile('a', 'A')
    const sample = buildSampleFromProfile(profile)

    expect(sample.typingWpm).toBe(75)
    expect(sample.typingVariance).toBe(20)
    expect(sample.mouseJitterSigma).toBe(0.4)
    expect(sample.scrollDecay).toBe(0.88)
    // Derived fields should be deterministic
    expect(sample.mouseVelocityAvg).toBeGreaterThan(0)
    expect(sample.mouseDirectionChanges).toBeGreaterThan(0)
    expect(sample.scrollSpeedAvg).toBeGreaterThan(0)
    expect(sample.scrollPauseRate).toBeGreaterThan(0)
  })

  it('falls back to sensible defaults when behavior config is missing', () => {
    const profile = makeProfile('a', 'A')
    delete (profile.fingerprint as any).behavior
    const sample = buildSampleFromProfile(profile)
    expect(sample.typingWpm).toBe(120) // "off" default
    expect(sample.mouseJitterSigma).toBe(0)
  })
})

describe('behavior-correlation: computePairSimilarity', () => {
  it('returns 1.0 for two identical samples', () => {
    const profile = makeProfile('a', 'A')
    const sample = buildSampleFromProfile(profile)
    const { similarity, featureContributions } = computePairSimilarity(sample, sample)
    expect(similarity).toBeCloseTo(1.0, 5)
    expect(featureContributions.typing).toBeCloseTo(1.0, 5)
    expect(featureContributions.mouse).toBeCloseTo(1.0, 5)
    expect(featureContributions.scroll).toBeCloseTo(1.0, 5)
  })

  it('returns a high similarity for two very similar profiles (~90%+)', () => {
    const a = buildSampleFromProfile(makeProfile('a', 'A', { typingWpm: 75 }))
    const b = buildSampleFromProfile(makeProfile('b', 'B', { typingWpm: 77 }))
    const { similarity } = computePairSimilarity(a, b)
    expect(similarity).toBeGreaterThan(0.9)
  })

  it('returns a low similarity for wildly different profiles', () => {
    const a = buildSampleFromProfile(
      makeProfile('a', 'A', {
        typingWpm: 40,
        typingVariancePct: 5,
        mouseJitterSigma: 0.1,
        scrollDecay: 0.95,
        scrollNoisePx: 0.5,
      })
    )
    const b = buildSampleFromProfile(
      makeProfile('b', 'B', {
        typingWpm: 170,
        typingVariancePct: 45,
        mouseJitterSigma: 1.8,
        scrollDecay: 0.72,
        scrollNoisePx: 4.5,
      })
    )
    const { similarity } = computePairSimilarity(a, b)
    expect(similarity).toBeLessThan(0.7)
  })
})

describe('behavior-correlation: scanCorrelations', () => {
  it('flags 100% similarity when two profiles have identical behavior configs', () => {
    const p1 = makeProfile('p1', 'Profile 1')
    const p2 = makeProfile('p2', 'Profile 2')
    const fingerprints = [buildFingerprint(p1), buildFingerprint(p2)]

    const report = scanCorrelations(fingerprints, { threshold: 0.85 })
    expect(report.profileCount).toBe(2)
    expect(report.pairsEvaluated).toBe(1)
    expect(report.alerts).toHaveLength(1)
    expect(report.alerts[0].similarity).toBeCloseTo(1.0, 5)
    expect(report.alerts[0].risk).toBe('high')
    expect(report.highRiskCount).toBe(1)
  })

  it('does not flag profiles that differ significantly', () => {
    const p1 = makeProfile('p1', 'Speed Typer', {
      typingWpm: 130,
      typingVariancePct: 8,
      mouseJitterSigma: 0.15,
      scrollDecay: 0.95,
      scrollNoisePx: 0.5,
    })
    const p2 = makeProfile('p2', 'Stealth Mode', {
      typingWpm: 45,
      typingVariancePct: 45,
      mouseJitterSigma: 1.5,
      scrollDecay: 0.75,
      scrollNoisePx: 5,
    })
    const fingerprints = [buildFingerprint(p1), buildFingerprint(p2)]

    const report = scanCorrelations(fingerprints, { threshold: 0.85 })
    expect(report.alerts).toHaveLength(0)
    expect(report.highRiskCount).toBe(0)
    expect(report.mediumRiskCount).toBe(0)
  })

  it('generates global recommendations when no alerts are present', () => {
    const p1 = makeProfile('p1', 'A', { typingWpm: 40 })
    const p2 = makeProfile('p2', 'B', { typingWpm: 160, mouseJitterSigma: 1.8, scrollDecay: 0.75 })
    const fingerprints = [buildFingerprint(p1), buildFingerprint(p2)]

    const report = scanCorrelations(fingerprints, { threshold: 0.95 })
    expect(report.globalRecommendations.length).toBeGreaterThan(0)
    expect(report.globalRecommendations.join(' ').toLowerCase()).toContain('healthy')
  })

  it('evaluates n*(n-1)/2 pairs for n profiles', () => {
    const profiles = [
      makeProfile('a', 'A', { typingWpm: 60 }),
      makeProfile('b', 'B', { typingWpm: 80 }),
      makeProfile('c', 'C', { typingWpm: 100 }),
      makeProfile('d', 'D', { typingWpm: 120 }),
    ]
    const fingerprints = profiles.map((p) => buildFingerprint(p))

    const report = scanCorrelations(fingerprints, { threshold: 0.85 })
    expect(report.profileCount).toBe(4)
    expect(report.pairsEvaluated).toBe(6) // 4*3/2
  })

  it('sorts alerts by similarity descending', () => {
    const profiles = [
      makeProfile('a', 'A', { typingWpm: 75 }),
      makeProfile('b', 'B', { typingWpm: 75 }), // 100% match with a
      makeProfile('c', 'C', { typingWpm: 80 }), // ~95% match with a/b
      makeProfile('d', 'D', { typingWpm: 90 }), // ~85% match
    ]
    const fingerprints = profiles.map((p) => buildFingerprint(p))
    const report = scanCorrelations(fingerprints, { threshold: 0.85 })

    for (let i = 1; i < report.alerts.length; i++) {
      expect(report.alerts[i - 1].similarity).toBeGreaterThanOrEqual(
        report.alerts[i].similarity
      )
    }
  })

  it('respects the threshold parameter', () => {
    const p1 = makeProfile('p1', 'A', { typingWpm: 75 })
    const p2 = makeProfile('p2', 'B', { typingWpm: 90 }) // ~similar
    const fingerprints = [buildFingerprint(p1), buildFingerprint(p2)]

    const strict = scanCorrelations(fingerprints, { threshold: 0.99 })
    const lax = scanCorrelations(fingerprints, { threshold: 0.5 })
    expect(lax.alerts.length).toBeGreaterThanOrEqual(strict.alerts.length)
  })

  it('produces per-pair recommendations', () => {
    const p1 = makeProfile('p1', 'A')
    const p2 = makeProfile('p2', 'B')
    const fingerprints = [buildFingerprint(p1), buildFingerprint(p2)]
    const report = scanCorrelations(fingerprints, { threshold: 0.85 })

    expect(report.alerts[0].recommendations.length).toBeGreaterThan(0)
  })

  it('includes archetype usage histogram', () => {
    const fingerprints = [
      buildFingerprint(makeProfile('p1', 'A')),
      buildFingerprint(makeProfile('p2', 'B')),
    ]
    const report = scanCorrelations(fingerprints)
    expect(Object.keys(report.archetypeUsage)).toContain('none')
    expect(report.archetypeUsage.none).toBe(2)
  })
})

describe('behavior-correlation: buildFingerprint with session samples', () => {
  it('blends recent samples with the static config (70/30 weighting)', () => {
    const profile = makeProfile('p1', 'A', { typingWpm: 80 })
    // Simulate observed samples averaging a different WPM
    const observed: BehaviorSample[] = [
      {
        typingWpm: 120,
        typingVariance: 15,
        mouseJitterSigma: 0.3,
        mouseVelocityAvg: 180,
        mouseDirectionChanges: 50,
        scrollSpeedAvg: 200,
        scrollDecay: 0.9,
        scrollPauseRate: 8,
      },
    ]
    const fp = buildFingerprint(profile, observed)
    expect(fp.sampleCount).toBe(2)
    // Blended value should lie strictly between 80 and 120
    expect(fp.sample.typingWpm).toBeGreaterThan(80)
    expect(fp.sample.typingWpm).toBeLessThan(120)
  })

  it('falls back to static config when no samples provided', () => {
    const profile = makeProfile('p1', 'A', { typingWpm: 77 })
    const fp = buildFingerprint(profile, [])
    expect(fp.sampleCount).toBe(1)
    expect(fp.sample.typingWpm).toBe(77)
  })
})

describe('behavior-correlation: constants', () => {
  it('exposes reasonable tunables', () => {
    const c = BEHAVIOR_CORRELATION_CONSTANTS
    expect(c.DEFAULT_THRESHOLD).toBe(0.85)
    expect(c.HIGH_RISK_CUTOFF).toBeGreaterThan(c.MEDIUM_RISK_CUTOFF)
    const sum = c.FEATURE_WEIGHTS.typing + c.FEATURE_WEIGHTS.mouse + c.FEATURE_WEIGHTS.scroll
    expect(sum).toBeCloseTo(1.0, 5)
  })
})
