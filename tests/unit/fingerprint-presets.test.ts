import { describe, it, expect } from 'vitest'
import { FINGERPRINT_PRESETS, resolveFingerprint } from '../../src/main/fingerprint/presets'

const PRESET_KEYS = ['win10-chrome120', 'win11-chrome121', 'mac-ventura-chrome120', 'mac-sonoma-chrome121', 'linux-ubuntu-chrome120']

describe('FINGERPRINT_PRESETS', () => {
  it('contains at least the 5 baseline desktop presets', () => {
    // Mobile presets (Android, iOS) and newer Chrome majors are added on top
    // of the original 5 baseline desktop presets — so this assertion only
    // pins the floor. Use the PRESET_KEYS array below to test the baseline
    // contract directly.
    expect(Object.keys(FINGERPRINT_PRESETS).length).toBeGreaterThanOrEqual(5)
  })

  it('contains all expected preset keys', () => {
    for (const key of PRESET_KEYS) {
      expect(FINGERPRINT_PRESETS).toHaveProperty(key)
    }
  })

  it.each(PRESET_KEYS)('%s has required fields', (key) => {
    const fp = FINGERPRINT_PRESETS[key]
    expect(fp.preset).toBe(key)
    expect(fp.browser.userAgent).toBeTruthy()
    expect(fp.browser.platform).toBeTruthy()
    expect(fp.screen.width).toBeGreaterThan(0)
    expect(fp.screen.height).toBeGreaterThan(0)
    expect(fp.hardware.deviceMemory).toBeGreaterThan(0)
    expect(fp.hardware.hardwareConcurrency).toBeGreaterThan(0)
    expect(fp.locale.timezone).toBeTruthy()
    expect(fp.locale.language).toBeTruthy()
    expect(Array.isArray(fp.fonts.whitelist)).toBe(true)
    expect(fp.fonts.whitelist!.length).toBeGreaterThan(0)
  })

  it('presets have noiseSeed = 0 (template default)', () => {
    for (const key of PRESET_KEYS) {
      const fp = FINGERPRINT_PRESETS[key]
      expect(fp.canvas.noiseSeed).toBe(0)
      expect(fp.webgl.noiseSeed).toBe(0)
      expect(fp.audio.noiseSeed).toBe(0)
    }
  })
})

describe('resolveFingerprint', () => {
  it('returns a fingerprint with the given preset key', () => {
    const fp = resolveFingerprint('win10-chrome120', 'test-id-1')
    expect(fp.preset).toBe('win10-chrome120')
  })

  it('assigns a non-zero seed from profileId', () => {
    const fp = resolveFingerprint('win10-chrome120', 'test-id-1')
    expect(fp.canvas.noiseSeed).not.toBe(0)
    expect(fp.webgl.noiseSeed).not.toBe(0)
    expect(fp.audio.noiseSeed).not.toBe(0)
  })

  it('assigns the same seed to canvas, webgl, and audio', () => {
    const fp = resolveFingerprint('win10-chrome120', 'some-profile-id')
    expect(fp.canvas.noiseSeed).toBe(fp.webgl.noiseSeed)
    expect(fp.canvas.noiseSeed).toBe(fp.audio.noiseSeed)
  })

  it('produces deterministic seeds — same profileId = same seed', () => {
    const id = 'deterministic-test-id'
    const fp1 = resolveFingerprint('win10-chrome120', id)
    const fp2 = resolveFingerprint('win10-chrome120', id)
    expect(fp1.canvas.noiseSeed).toBe(fp2.canvas.noiseSeed)
  })

  it('produces different seeds for different profileIds', () => {
    const fp1 = resolveFingerprint('win10-chrome120', 'profile-aaa')
    const fp2 = resolveFingerprint('win10-chrome120', 'profile-bbb')
    expect(fp1.canvas.noiseSeed).not.toBe(fp2.canvas.noiseSeed)
  })

  it('does not mutate the original preset', () => {
    const original = FINGERPRINT_PRESETS['win10-chrome120'].canvas.noiseSeed
    resolveFingerprint('win10-chrome120', 'mutate-test')
    expect(FINGERPRINT_PRESETS['win10-chrome120'].canvas.noiseSeed).toBe(original)
  })

  it('falls back to win10-chrome120 for unknown preset key', () => {
    const fp = resolveFingerprint('nonexistent-preset', 'test-id')
    expect(fp.browser.platform).toBe('Win32')
  })

  it('works for all 5 preset keys', () => {
    for (const key of PRESET_KEYS) {
      const fp = resolveFingerprint(key, 'test-id')
      expect(fp.preset).toBe(key)
    }
  })
})
