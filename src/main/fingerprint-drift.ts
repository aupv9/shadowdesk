import type { FingerprintConfig } from '../shared/types'

/**
 * Phase 11.3 — Fingerprint drift over time.
 *
 * Real browsers update on a regular cadence — Chrome ships a new major
 * version every 4 weeks. A profile that has been "frozen" on the same UA
 * for months becomes statistically anomalous. To mimic natural drift we
 * apply small, deterministic-feeling mutations to the fingerprint:
 *
 *   • Bump the Chrome major version by 1 (capped at a reasonable ceiling).
 *   • Update the UA string + UACH brand version to match.
 *   • Occasionally rotate one of the noise seeds (canvas/webgl/audio) so
 *     the cross-site fingerprint subtly shifts the way real GPU/driver
 *     updates would.
 *
 * The drift is intentionally conservative: it does not change OS,
 * timezone, language, hardware concurrency, screen resolution or any
 * stable identity property — only volatile values that real browsers
 * change on update.
 */
export function driftFingerprint(fp: FingerprintConfig): FingerprintConfig {
  const next = JSON.parse(JSON.stringify(fp)) as FingerprintConfig

  // Bump the Chrome major version by 1 (cap at 140 to keep within
  // realistic published range as of 2026 Q2).
  const currentMajor = parseInt(next.browser.version, 10)
  if (Number.isFinite(currentMajor) && currentMajor < 140) {
    const newMajor = currentMajor + 1
    next.browser.version = String(newMajor)
    next.browser.userAgent = next.browser.userAgent.replace(
      /Chrome\/\d+\.\d+\.\d+\.\d+/,
      `Chrome/${newMajor}.0.0.0`
    )
  }

  // Rotate one noise seed to mimic GPU/driver updates.
  const seedDelta = Math.floor(Math.random() * 0xffff) + 1
  next.canvas.noiseSeed = (next.canvas.noiseSeed ^ seedDelta) >>> 0
  next.webgl.noiseSeed  = (next.webgl.noiseSeed  ^ (seedDelta + 1)) >>> 0
  next.audio.noiseSeed  = (next.audio.noiseSeed  ^ (seedDelta + 2)) >>> 0

  return next
}
