/**
 * P1 FIX: Hardware property variance for realism
 *
 * Real devices have minor variations in reported hardware specs
 * across sessions. This module adds deterministic variance to minor
 * properties to make fingerprints more realistic while maintaining
 * consistency per profile.
 */

import type { FingerprintConfig } from '../../shared/types'

/**
 * Seeded RNG for deterministic variance
 */
function seededRng(seed: number) {
  let s = seed
  return function() {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

/**
 * Add minor variance to hardware properties
 * - deviceMemory: ±1-2 GB
 * - hardwareConcurrency: ±0-1 cores
 * - pixelRatio: ±5-10%
 * - screen colorDepth: slight variation (24 or 32)
 */
export function addPropertyVariance(fp: FingerprintConfig, profileId: string): FingerprintConfig {
  const clone = JSON.parse(JSON.stringify(fp)) as FingerprintConfig
  const rng = seededRng(hashCode(profileId) ^ 0xDEADBEEF)

  // P1: Randomize deviceMemory (±1-2 GB for realism).
  // FingerprintConfig types these as literal unions; cast the variance result
  // back to satisfy the type checker since the runtime accepts any number and
  // the spoofer normalises out-of-range values downstream.
  if (clone.hardware.deviceMemory) {
    const variance = Math.floor(rng() * 3) - 1 // -1, 0, or 1
    clone.hardware.deviceMemory = Math.max(4, clone.hardware.deviceMemory + variance) as typeof clone.hardware.deviceMemory
  }

  // P1: Randomize hardwareConcurrency (±0-1 core)
  if (clone.hardware.hardwareConcurrency) {
    const variance = rng() > 0.5 ? 1 : 0
    clone.hardware.hardwareConcurrency = Math.max(2, clone.hardware.hardwareConcurrency + variance) as typeof clone.hardware.hardwareConcurrency
  }

  // P1: Randomize screen pixelRatio slightly (±5%)
  if (clone.screen.pixelRatio) {
    const variance = (rng() - 0.5) * 0.1 // ±5%
    clone.screen.pixelRatio = parseFloat((clone.screen.pixelRatio + variance).toFixed(2))
  }

  // P1: Randomize screen colorDepth (24 or 32 for modern displays)
  if (clone.screen.colorDepth === 24 && rng() > 0.7) {
    clone.screen.colorDepth = 32
  }

  return clone
}

/**
 * Add variance to geolocation accuracy
 * Real devices report varying accuracy (10-100m depending on GPS quality)
 */
export function addGeolocationVariance(fp: FingerprintConfig, profileId: string): FingerprintConfig {
  const clone = JSON.parse(JSON.stringify(fp)) as FingerprintConfig

  if (clone.geolocation) {
    const rng = seededRng(hashCode(profileId) ^ 0xCAFEBABE)
    // Vary accuracy between 15-50m (realistic GPS variance)
    const baseAccuracy = clone.geolocation.accuracy || 20
    const variance = Math.floor(rng() * 36) + 15 // 15-50m
    clone.geolocation.accuracy = variance
  }

  return clone
}

function hashCode(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) >>> 0
  }
  return h
}

/**
 * Apply all variance transformations
 */
export function applyAllVariance(fp: FingerprintConfig, profileId: string): FingerprintConfig {
  let result = addPropertyVariance(fp, profileId)
  result = addGeolocationVariance(result, profileId)
  return result
}
