/**
 * Phase 13.A — Unit tests for fingerprint injection scripts:
 *   buildAudioScript, buildWebGlScript, buildTimingScript
 *
 * Verifies:
 *  - Correct output for each mode/config combination
 *  - Deterministic seed embedding
 *  - IIFE wrapping (script runs in own scope)
 *  - Key API override presence
 */

import { describe, it, expect } from 'vitest'
import { buildAudioScript } from '../../src/main/fingerprint/scripts/audio'
import { buildWebGlScript } from '../../src/main/fingerprint/scripts/webgl'
import { buildTimingScript } from '../../src/main/fingerprint/scripts/timing'

// ── buildAudioScript ─────────────────────────────────────────────────────────

describe('buildAudioScript', () => {
  it('returns empty string for mode=real', () => {
    expect(buildAudioScript({ mode: 'real', noiseSeed: 0 })).toBe('')
  })

  it('returns non-empty script for mode=block', () => {
    const s = buildAudioScript({ mode: 'block', noiseSeed: 0 })
    expect(s.length).toBeGreaterThan(0)
  })

  it('returns non-empty script for mode=noise', () => {
    const s = buildAudioScript({ mode: 'noise', noiseSeed: 42 })
    expect(s.length).toBeGreaterThan(0)
  })

  it('block mode removes AudioContext', () => {
    const s = buildAudioScript({ mode: 'block', noiseSeed: 0 })
    expect(s).toContain('AudioContext')
    expect(s).toContain('undefined')
  })

  it('noise mode patches AudioContext', () => {
    const s = buildAudioScript({ mode: 'noise', noiseSeed: 1 })
    expect(s).toContain('AudioContext')
    expect(s).toContain('PatchedAudioContext')
  })

  it('noise mode patches createAnalyser', () => {
    const s = buildAudioScript({ mode: 'noise', noiseSeed: 1 })
    expect(s).toContain('createAnalyser')
  })

  it('noise mode patches createOscillator', () => {
    const s = buildAudioScript({ mode: 'noise', noiseSeed: 1 })
    expect(s).toContain('createOscillator')
  })

  it('embeds noiseSeed in noise script', () => {
    const seed = 7654321
    const s = buildAudioScript({ mode: 'noise', noiseSeed: seed })
    expect(s).toContain(String(seed))
  })

  it('different seeds produce different noise scripts', () => {
    const a = buildAudioScript({ mode: 'noise', noiseSeed: 100 })
    const b = buildAudioScript({ mode: 'noise', noiseSeed: 200 })
    expect(a).not.toBe(b)
  })

  it('noise script is an IIFE', () => {
    const s = buildAudioScript({ mode: 'noise', noiseSeed: 1 })
    expect(s).toContain('(function()')
  })

  it('block script is an IIFE', () => {
    const s = buildAudioScript({ mode: 'block', noiseSeed: 0 })
    expect(s).toContain('(function()')
  })
})

// ── buildWebGlScript ─────────────────────────────────────────────────────────

describe('buildWebGlScript', () => {
  const baseConfig = {
    vendor: 'Google Inc. (NVIDIA)',
    renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 Direct3D11 vs_5_0 ps_5_0, D3D11)',
    noiseSeed: 12345
  }

  it('always returns a non-empty script (no real mode for WebGL)', () => {
    expect(buildWebGlScript(baseConfig).length).toBeGreaterThan(0)
  })

  it('embeds vendor string', () => {
    const s = buildWebGlScript(baseConfig)
    expect(s).toContain('Google Inc. (NVIDIA)')
  })

  it('embeds renderer string', () => {
    const s = buildWebGlScript(baseConfig)
    expect(s).toContain('ANGLE (NVIDIA')
  })

  it('embeds noiseSeed', () => {
    const s = buildWebGlScript({ ...baseConfig, noiseSeed: 99999 })
    expect(s).toContain('99999')
  })

  it('overrides getParameter for UNMASKED_VENDOR', () => {
    const s = buildWebGlScript(baseConfig)
    expect(s).toContain('getParameter')
    expect(s).toContain('37445') // UNMASKED_VENDOR_WEBGL
  })

  it('overrides getParameter for UNMASKED_RENDERER', () => {
    const s = buildWebGlScript(baseConfig)
    expect(s).toContain('37446') // UNMASKED_RENDERER_WEBGL
  })

  it('overrides getExtension for WEBGL_debug_renderer_info', () => {
    const s = buildWebGlScript(baseConfig)
    expect(s).toContain('WEBGL_debug_renderer_info')
    expect(s).toContain('getExtension')
  })

  it('overrides readPixels for pixel noise', () => {
    const s = buildWebGlScript(baseConfig)
    expect(s).toContain('readPixels')
  })

  it('intercepts getContext to patch webgl contexts', () => {
    const s = buildWebGlScript(baseConfig)
    expect(s).toContain('getContext')
    expect(s).toContain('webgl')
  })

  it('uses __ghostPatched guard to avoid double-patching', () => {
    const s = buildWebGlScript(baseConfig)
    expect(s).toContain('__ghostPatched')
  })

  it('is wrapped in an IIFE', () => {
    const s = buildWebGlScript(baseConfig)
    expect(s).toContain('(function()')
  })

  it('different vendors produce different scripts', () => {
    const a = buildWebGlScript({ ...baseConfig, vendor: 'Vendor A' })
    const b = buildWebGlScript({ ...baseConfig, vendor: 'Vendor B' })
    expect(a).not.toBe(b)
  })

  it('different renderers produce different scripts', () => {
    const a = buildWebGlScript({ ...baseConfig, renderer: 'Renderer A' })
    const b = buildWebGlScript({ ...baseConfig, renderer: 'Renderer B' })
    expect(a).not.toBe(b)
  })
})

// ── buildTimingScript ─────────────────────────────────────────────────────────

describe('buildTimingScript', () => {
  const baseConfig = {
    dateNoisePrecision: 100,
    performanceClamp: true,
    rafJitter: true
  }

  it('returns a non-empty script', () => {
    expect(buildTimingScript(baseConfig, 42).length).toBeGreaterThan(0)
  })

  it('embeds the seed in the script', () => {
    const seed = 123456789
    const s = buildTimingScript(baseConfig, seed)
    expect(s).toContain(String(seed >>> 0))
  })

  it('embeds dateNoisePrecision', () => {
    const s = buildTimingScript({ ...baseConfig, dateNoisePrecision: 250 }, 1)
    expect(s).toContain('250')
  })

  it('patches Date.now', () => {
    const s = buildTimingScript(baseConfig, 1)
    expect(s).toContain('Date.now')
  })

  it('patches Date constructor', () => {
    const s = buildTimingScript(baseConfig, 1)
    expect(s).toContain('window.Date')
  })

  it('includes performance.now patch when performanceClamp=true', () => {
    const s = buildTimingScript({ ...baseConfig, performanceClamp: true }, 1)
    expect(s).toContain('performance.now')
  })

  it('omits performance.now patch when performanceClamp=false', () => {
    const s = buildTimingScript({ ...baseConfig, performanceClamp: false }, 1)
    // Still contains the string but in a comment or not as a function patch
    // The conditional block is omitted — verify no performance.now override
    const lines = s.split('\n').filter(l => l.includes('performance.now ='))
    expect(lines).toHaveLength(0)
  })

  it('includes requestAnimationFrame patch when rafJitter=true', () => {
    const s = buildTimingScript({ ...baseConfig, rafJitter: true }, 1)
    expect(s).toContain('requestAnimationFrame')
  })

  it('omits requestAnimationFrame patch when rafJitter=false', () => {
    const s = buildTimingScript({ ...baseConfig, rafJitter: false }, 1)
    const lines = s.split('\n').filter(l => l.includes('requestAnimationFrame ='))
    expect(lines).toHaveLength(0)
  })

  it('patches Atomics.wait if available', () => {
    const s = buildTimingScript(baseConfig, 1)
    expect(s).toContain('Atomics.wait')
  })

  it('is wrapped in an IIFE', () => {
    const s = buildTimingScript(baseConfig, 1)
    expect(s).toContain('(function()')
  })

  it('different seeds produce different scripts', () => {
    const a = buildTimingScript(baseConfig, 111)
    const b = buildTimingScript(baseConfig, 222)
    expect(a).not.toBe(b)
  })

  it('same seed always produces same script (deterministic)', () => {
    const a = buildTimingScript(baseConfig, 42)
    const b = buildTimingScript(baseConfig, 42)
    expect(a).toBe(b)
  })
})
