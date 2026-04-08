/**
 * Phase 17 — Behavioral Config UI presets
 *
 * A small set of one-click behavior + timing bundles shown in the
 * Behavioral Config UI. Each preset bundles both BehaviorConfig and
 * TimingConfig — the renderer applies them by merging the bundle into
 * the active profile's fingerprint and calling profiles:update.
 *
 * These are intentionally distinct from the "user archetype" presets in
 * behavior-templates.ts — those shape the whole profile (including webrtc).
 * The Behavioral Config UI presets only touch the two behavioral knobs.
 */

import type { BehaviorPreset } from '../../shared/types'

export const BEHAVIOR_PRESETS: Readonly<BehaviorPreset[]> = Object.freeze([
  {
    id: 'off',
    name: 'Off',
    description: 'Disable all behavior/timing simulation. Highest fidelity, most detectable.',
    behavior: {
      mouseJitter: false,
      typingNoise: false,
      scrollInertia: false,
      mouseJitterIntensity: 'off',
      mouseJitterSigma: 0,
      typingWpm: 75,
      typingVariancePct: 20,
      typingHoldSigmaMs: 5,
      scrollDecay: 0.88,
      scrollNoisePx: 2,
    },
    timing: {
      dateNoisePrecision: 50,
      rafJitter: false,
      performanceClamp: false,
      rafJitterSigmaMs: 0,
      atomicsWaitNoise: false,
    },
  },
  {
    id: 'subtle',
    name: 'Subtle',
    description: 'Light noise — best for speed-sensitive sites like SERPs.',
    behavior: {
      mouseJitter: true,
      typingNoise: true,
      scrollInertia: true,
      mouseJitterIntensity: 'subtle',
      mouseJitterSigma: 0.25,
      typingWpm: 90,
      typingVariancePct: 12,
      typingHoldSigmaMs: 3,
      scrollDecay: 0.92,
      scrollNoisePx: 1,
    },
    timing: {
      dateNoisePrecision: 50,
      rafJitter: true,
      performanceClamp: true,
      rafJitterSigmaMs: 0.5,
      atomicsWaitNoise: true,
    },
  },
  {
    id: 'balanced',
    name: 'Balanced',
    description: 'Default. Good mix of noise and usability for most workflows.',
    behavior: {
      mouseJitter: true,
      typingNoise: true,
      scrollInertia: true,
      mouseJitterIntensity: 'moderate',
      mouseJitterSigma: 0.4,
      typingWpm: 75,
      typingVariancePct: 20,
      typingHoldSigmaMs: 5,
      scrollDecay: 0.88,
      scrollNoisePx: 2,
    },
    timing: {
      dateNoisePrecision: 100,
      rafJitter: true,
      performanceClamp: true,
      rafJitterSigmaMs: 1.2,
      atomicsWaitNoise: true,
    },
  },
  {
    id: 'heavy',
    name: 'Heavy',
    description: 'High noise — best against strict bot-detection scripts.',
    behavior: {
      mouseJitter: true,
      typingNoise: true,
      scrollInertia: true,
      mouseJitterIntensity: 'heavy',
      mouseJitterSigma: 0.9,
      typingWpm: 65,
      typingVariancePct: 35,
      typingHoldSigmaMs: 9,
      scrollDecay: 0.82,
      scrollNoisePx: 3.5,
    },
    timing: {
      dateNoisePrecision: 100,
      rafJitter: true,
      performanceClamp: true,
      rafJitterSigmaMs: 2.5,
      atomicsWaitNoise: true,
    },
  },
  {
    id: 'stealth',
    name: 'Stealth',
    description: 'Maximum noise and timing defenses. May break timing-sensitive sites.',
    behavior: {
      mouseJitter: true,
      typingNoise: true,
      scrollInertia: true,
      mouseJitterIntensity: 'heavy',
      mouseJitterSigma: 1.2,
      typingWpm: 55,
      typingVariancePct: 45,
      typingHoldSigmaMs: 12,
      scrollDecay: 0.78,
      scrollNoisePx: 5,
    },
    timing: {
      dateNoisePrecision: 250,
      rafJitter: true,
      performanceClamp: true,
      rafJitterSigmaMs: 3.5,
      atomicsWaitNoise: true,
    },
  },
])

export function getBehaviorPresets(): BehaviorPreset[] {
  // Return a deep copy so renderer mutations never touch our frozen source.
  return JSON.parse(JSON.stringify(BEHAVIOR_PRESETS))
}
