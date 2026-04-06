import { describe, it, expect } from 'vitest'
import { buildCanvasScript } from '../../src/main/fingerprint/scripts/canvas'
import { buildWebRtcScript } from '../../src/main/fingerprint/scripts/webrtc'

describe('buildCanvasScript', () => {
  it('returns empty string for mode=real', () => {
    const result = buildCanvasScript({ mode: 'real', noiseSeed: 0 })
    expect(result).toBe('')
  })

  it('returns non-empty script for mode=noise', () => {
    const result = buildCanvasScript({ mode: 'noise', noiseSeed: 12345 })
    expect(result.length).toBeGreaterThan(0)
  })

  it('returns non-empty script for mode=block', () => {
    const result = buildCanvasScript({ mode: 'block', noiseSeed: 0 })
    expect(result.length).toBeGreaterThan(0)
  })

  it('embeds the noiseSeed in the noise script', () => {
    const seed = 987654321
    const result = buildCanvasScript({ mode: 'noise', noiseSeed: seed })
    expect(result).toContain(String(seed))
  })

  it('noise script overrides getImageData', () => {
    const result = buildCanvasScript({ mode: 'noise', noiseSeed: 1 })
    expect(result).toContain('getImageData')
  })

  it('noise script overrides toDataURL', () => {
    const result = buildCanvasScript({ mode: 'noise', noiseSeed: 1 })
    expect(result).toContain('toDataURL')
  })

  it('noise script overrides toBlob', () => {
    const result = buildCanvasScript({ mode: 'noise', noiseSeed: 1 })
    expect(result).toContain('toBlob')
  })

  it('block script overrides toDataURL', () => {
    const result = buildCanvasScript({ mode: 'block', noiseSeed: 0 })
    expect(result).toContain('toDataURL')
  })

  it('produces an IIFE (immediately invoked)', () => {
    const noise = buildCanvasScript({ mode: 'noise', noiseSeed: 1 })
    expect(noise).toContain('(function()')
    const block = buildCanvasScript({ mode: 'block', noiseSeed: 0 })
    expect(block).toContain('(function()')
  })

  it('different seeds produce different scripts', () => {
    const a = buildCanvasScript({ mode: 'noise', noiseSeed: 111 })
    const b = buildCanvasScript({ mode: 'noise', noiseSeed: 222 })
    expect(a).not.toBe(b)
  })
})

describe('buildWebRtcScript', () => {
  it('returns empty string when mode is not disabled', () => {
    expect(buildWebRtcScript({ enabled: true, mode: 'real' })).toBe('')
    expect(buildWebRtcScript({ enabled: true, mode: 'spoof' as any })).toBe('')
  })

  it('returns non-empty script when mode=disabled', () => {
    const result = buildWebRtcScript({ enabled: false, mode: 'disabled' })
    expect(result.length).toBeGreaterThan(0)
  })

  it('overrides RTCPeerConnection in the script', () => {
    const result = buildWebRtcScript({ enabled: false, mode: 'disabled' })
    expect(result).toContain('RTCPeerConnection')
  })

  it('throws DOMException in the override', () => {
    const result = buildWebRtcScript({ enabled: false, mode: 'disabled' })
    expect(result).toContain('DOMException')
  })

  it('produces an IIFE', () => {
    const result = buildWebRtcScript({ enabled: false, mode: 'disabled' })
    expect(result).toContain('(function()')
  })
})
