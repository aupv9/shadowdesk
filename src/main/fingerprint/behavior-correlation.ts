/**
 * Phase 21 — Behavior Correlation Detector
 *
 * Multi-Account Behavior Correlation: detects when two or more profiles share
 * a behavioral fingerprint so similar that a sophisticated detector could
 * cluster them as the same operator.
 *
 * Pipeline:
 *   1. Pull every profile's fingerprint.behavior (+ optional archetype) from DB.
 *   2. Convert to a feature vector (typing / mouse / scroll).
 *   3. Compute pairwise cosine similarity on normalised features.
 *   4. Flag pairs above `threshold` (default 0.85) and rank by risk.
 *   5. Attach human-readable remediation recommendations per pair + globally.
 *
 * The detector is intentionally self-contained and does not require session
 * telemetry — it works on the static behaviour config that every profile has.
 * When session metrics become available (P3 behavior-session-tracker), they
 * can be merged into the sample via `buildSampleFromMetrics()`.
 */

import type {
  BehaviorConfig,
  BehaviorSample,
  ProfileBehaviorFingerprint,
  BehaviorCorrelationPair,
  BehaviorCorrelationReport,
  BehaviorCorrelationOptions,
  Profile,
} from '../../shared/types'
import { getBehaviorArchetype } from '../ai-assistant'

// ── Tunable constants ──────────────────────────────────────────────────────

const DEFAULT_THRESHOLD = 0.85
const HIGH_RISK_CUTOFF = 0.90
const MEDIUM_RISK_CUTOFF = 0.85

/**
 * Feature weights — these control how much each behavioural axis contributes
 * to the overall similarity score. Tuned so no single axis dominates.
 */
const FEATURE_WEIGHTS = {
  typing: 0.4,
  mouse: 0.35,
  scroll: 0.25,
} as const

/**
 * Normalisation ranges used to squash raw config values into 0..1 so cosine
 * similarity behaves correctly across dimensions with very different units.
 */
const NORMALISE_RANGES = {
  typingWpm: { min: 20, max: 180 },
  typingVariance: { min: 0, max: 50 },
  mouseJitterSigma: { min: 0, max: 2 },
  mouseVelocityAvg: { min: 50, max: 400 },
  mouseDirectionChanges: { min: 0, max: 100 },
  scrollSpeedAvg: { min: 50, max: 500 },
  scrollDecay: { min: 0.7, max: 0.98 },
  scrollPauseRate: { min: 0, max: 30 },
} as const

// ── Sample construction ────────────────────────────────────────────────────

/**
 * Build a BehaviorSample from a profile's static fingerprint.behavior config.
 * Missing advanced fields fall back to sensible defaults derived from the
 * legacy boolean toggles — mirrors how the fingerprint scripts behave at
 * injection time so the sample reflects what the browser actually emits.
 */
export function buildSampleFromProfile(profile: Profile): BehaviorSample {
  const behavior: BehaviorConfig | undefined = profile.fingerprint?.behavior

  const wpm = behavior?.typingWpm ?? (behavior?.typingNoise ? 75 : 120)
  const variance = behavior?.typingVariancePct ?? (behavior?.typingNoise ? 20 : 3)
  const jitterSigma = behavior?.mouseJitterSigma ?? (behavior?.mouseJitter ? 0.4 : 0)
  const scrollDecay = behavior?.scrollDecay ?? (behavior?.scrollInertia ? 0.88 : 0.95)
  const scrollNoise = behavior?.scrollNoisePx ?? (behavior?.scrollInertia ? 2 : 0)

  // Derive velocity/direction/pause rates heuristically from the knobs we
  // DO have. These are deterministic functions of the config — not noise —
  // so identical configs collapse to the same derived numbers, which is
  // exactly what we want the detector to catch.
  const mouseVelocityAvg = 150 + jitterSigma * 60
  const mouseDirectionChanges = behavior?.mouseJitter ? 55 + jitterSigma * 10 : 40
  const scrollSpeedAvg = 180 + scrollNoise * 30
  const scrollPauseRate = behavior?.scrollInertia ? 10 + (1 - scrollDecay) * 80 : 4

  return {
    typingWpm: wpm,
    typingVariance: variance,
    mouseJitterSigma: jitterSigma,
    mouseVelocityAvg,
    mouseDirectionChanges,
    scrollSpeedAvg,
    scrollDecay,
    scrollPauseRate,
    archetypeId: (profile as any).archetype_id ?? null,
  }
}

/**
 * Build a fingerprint centroid for a single profile. If `recentSamples` is
 * provided, they are averaged into the static config sample with a 70/30
 * weighting in favour of the observed data (more realistic over time).
 */
export function buildFingerprint(
  profile: Profile,
  recentSamples: BehaviorSample[] = []
): ProfileBehaviorFingerprint {
  const staticSample = buildSampleFromProfile(profile)

  let centroid: BehaviorSample
  let sampleCount = 1

  if (recentSamples.length > 0) {
    const observedMean = meanSamples(recentSamples)
    // 70% observed, 30% static config.
    centroid = blendSamples(observedMean, staticSample, 0.7)
    sampleCount = recentSamples.length + 1
  } else {
    centroid = staticSample
  }

  const archetypeId = staticSample.archetypeId ?? null
  const archetypeName = archetypeId
    ? getBehaviorArchetype(archetypeId)?.name ?? null
    : null

  return {
    profileId: profile.id,
    profileName: profile.name,
    archetypeId,
    archetypeName,
    computedAt: new Date().toISOString(),
    sample: centroid,
    sampleCount,
  }
}

// ── Pairwise similarity ────────────────────────────────────────────────────

/**
 * Normalise a raw value into the 0..1 range using the configured range.
 * Values outside the range are clamped.
 */
function normalise(value: number, range: { min: number; max: number }): number {
  if (range.max === range.min) return 0
  const n = (value - range.min) / (range.max - range.min)
  return Math.max(0, Math.min(1, n))
}

/**
 * Convert a sample into a normalised feature vector, grouped by axis so we
 * can report per-axis similarity to the UI ("typing 98%, mouse 62%, scroll 71%").
 */
function sampleToFeatures(s: BehaviorSample) {
  return {
    typing: [
      normalise(s.typingWpm, NORMALISE_RANGES.typingWpm),
      normalise(s.typingVariance, NORMALISE_RANGES.typingVariance),
    ],
    mouse: [
      normalise(s.mouseJitterSigma, NORMALISE_RANGES.mouseJitterSigma),
      normalise(s.mouseVelocityAvg, NORMALISE_RANGES.mouseVelocityAvg),
      normalise(s.mouseDirectionChanges, NORMALISE_RANGES.mouseDirectionChanges),
    ],
    scroll: [
      normalise(s.scrollSpeedAvg, NORMALISE_RANGES.scrollSpeedAvg),
      normalise(s.scrollDecay, NORMALISE_RANGES.scrollDecay),
      normalise(s.scrollPauseRate, NORMALISE_RANGES.scrollPauseRate),
    ],
  }
}

/**
 * Similarity between two numeric vectors of equal length, expressed as
 * 1 - normalised Euclidean distance. Returns a value in [0, 1] where 1.0
 * means identical. Cosine similarity alone is a poor fit here because many
 * features can legitimately be zero ("off"), which makes the angle undefined.
 */
function vectorSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0
  let sumSq = 0
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i]
    sumSq += diff * diff
  }
  // Max distance across a unit-normalised vector of length n is sqrt(n).
  const maxDist = Math.sqrt(a.length)
  const dist = Math.sqrt(sumSq)
  return Math.max(0, 1 - dist / maxDist)
}

/** Compute full pairwise similarity between two profile samples. */
export function computePairSimilarity(
  a: BehaviorSample,
  b: BehaviorSample
): {
  similarity: number
  featureContributions: { typing: number; mouse: number; scroll: number }
} {
  const fa = sampleToFeatures(a)
  const fb = sampleToFeatures(b)

  const typing = vectorSimilarity(fa.typing, fb.typing)
  const mouse = vectorSimilarity(fa.mouse, fb.mouse)
  const scroll = vectorSimilarity(fa.scroll, fb.scroll)

  const similarity =
    typing * FEATURE_WEIGHTS.typing +
    mouse * FEATURE_WEIGHTS.mouse +
    scroll * FEATURE_WEIGHTS.scroll

  return {
    similarity: Math.max(0, Math.min(1, similarity)),
    featureContributions: { typing, mouse, scroll },
  }
}

// ── Recommendations ────────────────────────────────────────────────────────

function buildPairRecommendations(
  a: ProfileBehaviorFingerprint,
  b: ProfileBehaviorFingerprint,
  similarity: number,
  contributions: { typing: number; mouse: number; scroll: number }
): string[] {
  const recs: string[] = []

  if (similarity >= HIGH_RISK_CUTOFF) {
    recs.push(
      `Profiles "${a.profileName}" and "${b.profileName}" are >${Math.round(HIGH_RISK_CUTOFF * 100)}% similar — stop running them in the same session window.`
    )
  }

  if (contributions.typing > 0.9) {
    recs.push(
      'Typing cadence is nearly identical — rotate one profile to a different archetype (e.g. "casual-browser" vs "speed-typer") or randomize typingWpm ±20%.'
    )
  }
  if (contributions.mouse > 0.9) {
    recs.push(
      'Mouse jitter/velocity match too closely — raise mouseJitterSigma on one profile and lower it on the other, or switch mouseJitterIntensity presets.'
    )
  }
  if (contributions.scroll > 0.9) {
    recs.push(
      'Scroll inertia fingerprints match — vary scrollDecay by at least 0.05 and adjust scrollNoisePx between the two profiles.'
    )
  }

  // Archetype overlap is a smoking gun for correlation — call it out.
  if (a.archetypeId && a.archetypeId === b.archetypeId) {
    recs.push(
      `Both profiles use the same archetype (${a.archetypeName ?? a.archetypeId}). Assign a different archetype to at least one.`
    )
  }

  if (recs.length === 0) {
    recs.push('Review the Behavioral Config for one of the profiles and apply a different preset.')
  }

  return recs
}

function buildGlobalRecommendations(
  pairs: BehaviorCorrelationPair[],
  fingerprints: ProfileBehaviorFingerprint[]
): string[] {
  const recs: string[] = []

  if (pairs.length === 0) {
    recs.push('No behavioral correlation detected above threshold — your profile pool looks healthy.')
    return recs
  }

  const highRisk = pairs.filter((p) => p.risk === 'high').length
  if (highRisk > 0) {
    recs.push(
      `${highRisk} high-risk pair${highRisk === 1 ? '' : 's'} detected — rotate profiles or randomize behavior before running them concurrently.`
    )
  }

  // Archetype diversification — if >50% of profiles share an archetype, flag it.
  const archetypeHistogram: Record<string, number> = {}
  for (const fp of fingerprints) {
    const key = fp.archetypeId ?? 'none'
    archetypeHistogram[key] = (archetypeHistogram[key] ?? 0) + 1
  }
  const dominant = Object.entries(archetypeHistogram).sort((a, b) => b[1] - a[1])[0]
  if (dominant && dominant[1] > fingerprints.length * 0.5 && dominant[0] !== 'none') {
    recs.push(
      `${dominant[1]} profiles share archetype "${dominant[0]}" — diversify by assigning other archetypes from the Behavior Pattern Library.`
    )
  } else if (dominant && dominant[0] === 'none' && dominant[1] > fingerprints.length * 0.6) {
    recs.push(
      'Most profiles have no archetype assigned — apply different behavior archetypes to reduce correlation risk.'
    )
  }

  // Cluster count — if many pairs are mutually correlated, hint at new profiles.
  const nodesInAlerts = new Set<string>()
  for (const p of pairs) {
    nodesInAlerts.add(p.profileAId)
    nodesInAlerts.add(p.profileBId)
  }
  if (nodesInAlerts.size > fingerprints.length * 0.4) {
    recs.push(
      'A large share of your profile pool participates in correlated clusters — consider creating fresh profiles with randomized archetypes.'
    )
  }

  return recs
}

// ── Sample aggregation helpers ─────────────────────────────────────────────

function meanSamples(samples: BehaviorSample[]): BehaviorSample {
  const n = samples.length
  const sum: BehaviorSample = {
    typingWpm: 0,
    typingVariance: 0,
    mouseJitterSigma: 0,
    mouseVelocityAvg: 0,
    mouseDirectionChanges: 0,
    scrollSpeedAvg: 0,
    scrollDecay: 0,
    scrollPauseRate: 0,
    archetypeId: samples[0]?.archetypeId ?? null,
  }
  for (const s of samples) {
    sum.typingWpm += s.typingWpm
    sum.typingVariance += s.typingVariance
    sum.mouseJitterSigma += s.mouseJitterSigma
    sum.mouseVelocityAvg += s.mouseVelocityAvg
    sum.mouseDirectionChanges += s.mouseDirectionChanges
    sum.scrollSpeedAvg += s.scrollSpeedAvg
    sum.scrollDecay += s.scrollDecay
    sum.scrollPauseRate += s.scrollPauseRate
  }
  return {
    typingWpm: sum.typingWpm / n,
    typingVariance: sum.typingVariance / n,
    mouseJitterSigma: sum.mouseJitterSigma / n,
    mouseVelocityAvg: sum.mouseVelocityAvg / n,
    mouseDirectionChanges: sum.mouseDirectionChanges / n,
    scrollSpeedAvg: sum.scrollSpeedAvg / n,
    scrollDecay: sum.scrollDecay / n,
    scrollPauseRate: sum.scrollPauseRate / n,
    archetypeId: sum.archetypeId,
  }
}

function blendSamples(a: BehaviorSample, b: BehaviorSample, weightA: number): BehaviorSample {
  const wB = 1 - weightA
  return {
    typingWpm: a.typingWpm * weightA + b.typingWpm * wB,
    typingVariance: a.typingVariance * weightA + b.typingVariance * wB,
    mouseJitterSigma: a.mouseJitterSigma * weightA + b.mouseJitterSigma * wB,
    mouseVelocityAvg: a.mouseVelocityAvg * weightA + b.mouseVelocityAvg * wB,
    mouseDirectionChanges:
      a.mouseDirectionChanges * weightA + b.mouseDirectionChanges * wB,
    scrollSpeedAvg: a.scrollSpeedAvg * weightA + b.scrollSpeedAvg * wB,
    scrollDecay: a.scrollDecay * weightA + b.scrollDecay * wB,
    scrollPauseRate: a.scrollPauseRate * weightA + b.scrollPauseRate * wB,
    archetypeId: a.archetypeId ?? b.archetypeId ?? null,
  }
}

// ── Top-level scan ─────────────────────────────────────────────────────────

/**
 * Run a correlation scan across a set of profile fingerprints. Pure
 * function — does not touch the database. Callers fetch profiles + optional
 * session history and hand them in.
 */
export function scanCorrelations(
  fingerprints: ProfileBehaviorFingerprint[],
  options: BehaviorCorrelationOptions = {}
): BehaviorCorrelationReport {
  const threshold = options.threshold ?? DEFAULT_THRESHOLD
  const scannedAt = new Date().toISOString()

  const alerts: BehaviorCorrelationPair[] = []
  let pairsEvaluated = 0

  for (let i = 0; i < fingerprints.length; i++) {
    for (let j = i + 1; j < fingerprints.length; j++) {
      pairsEvaluated++
      const a = fingerprints[i]
      const b = fingerprints[j]
      const { similarity, featureContributions } = computePairSimilarity(
        a.sample,
        b.sample
      )

      if (similarity < threshold) continue

      const risk: BehaviorCorrelationPair['risk'] =
        similarity >= HIGH_RISK_CUTOFF
          ? 'high'
          : similarity >= MEDIUM_RISK_CUTOFF
            ? 'medium'
            : 'low'

      alerts.push({
        id: `${a.profileId}:${b.profileId}`,
        profileAId: a.profileId,
        profileAName: a.profileName,
        profileBId: b.profileId,
        profileBName: b.profileName,
        similarity,
        similarityPercent: Math.round(similarity * 1000) / 10,
        risk,
        featureContributions,
        recommendations: buildPairRecommendations(a, b, similarity, featureContributions),
        computedAt: scannedAt,
      })
    }
  }

  alerts.sort((x, y) => y.similarity - x.similarity)

  const archetypeUsage: Record<string, number> = {}
  for (const fp of fingerprints) {
    const key = fp.archetypeId ?? 'none'
    archetypeUsage[key] = (archetypeUsage[key] ?? 0) + 1
  }

  const highRiskCount = alerts.filter((p) => p.risk === 'high').length
  const mediumRiskCount = alerts.filter((p) => p.risk === 'medium').length

  return {
    scannedAt,
    threshold,
    profileCount: fingerprints.length,
    pairsEvaluated,
    alerts,
    highRiskCount,
    mediumRiskCount,
    globalRecommendations: buildGlobalRecommendations(alerts, fingerprints),
    archetypeUsage,
    fingerprints,
  }
}

// ── Public constants (re-exported for tests + UI) ─────────────────────────

export const BEHAVIOR_CORRELATION_CONSTANTS = {
  DEFAULT_THRESHOLD,
  HIGH_RISK_CUTOFF,
  MEDIUM_RISK_CUTOFF,
  FEATURE_WEIGHTS,
} as const
