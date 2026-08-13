/**
 * v1.0 desktop-only build gate.
 *
 * These guard two things that are easy to break by accident: shipping a
 * navigation entry whose backend does not exist, and reintroducing the
 * 5-profile cap on a build that has no licensing server to lift it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  DESKTOP_ONLY,
  CLOUD_SECTIONS,
  HARDWARE_SECTIONS,
  COMMUNITY_PRESETS_ENABLED,
  isSectionEnabled
} from '../../src/shared/features'

/** Loads license.ts with electron + the DB stubbed out. */
async function loadLicense(profileCount: number) {
  vi.resetModules()
  vi.doMock('electron', () => ({
    app: { getPath: vi.fn(() => '/tmp/shadowdesk-test') }
  }))
  vi.doMock('../../src/main/database', () => ({
    Database: {
      getInstance: () => ({
        getAllProfiles: () => Array.from({ length: profileCount }, (_, i) => ({ id: `p${i}` }))
      })
    }
  }))
  return import('../../src/main/license')
}

describe('feature gate', () => {
  it('hides every section that needs a backend', () => {
    for (const section of CLOUD_SECTIONS) {
      expect(isSectionEnabled(section)).toBe(false)
    }
  })

  it('hides real-device management', () => {
    for (const section of HARDWARE_SECTIONS) {
      expect(isSectionEnabled(section)).toBe(false)
    }
  })

  it('keeps mobile workflows — they run on Chromium emulation, not hardware', () => {
    expect(isSectionEnabled('mobile-workflows')).toBe(true)
  })

  it('keeps the locally-backed sections reachable', () => {
    const local = [
      'profiles',
      'import-history',
      'proxies',
      'fingerprint',
      'behavior',
      'patches',
      'detection',
      'correlation',
      'automation',
      'runs',
      'ai',
      'smart-warmup',
      'sea-platforms',
      'marketplace',
      'settings'
    ]
    for (const section of local) {
      expect(isSectionEnabled(section)).toBe(true)
    }
  })

  it('keeps the unimplemented community-presets panel switched off', () => {
    expect(COMMUNITY_PRESETS_ENABLED).toBe(false)
  })
})

describe('profile limit without a licensing server', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('reports the local license as unlimited', async () => {
    const { getFreePlanLicense } = await loadLicense(0)
    expect(DESKTOP_ONLY).toBe(true)
    expect(getFreePlanLicense().max_profiles).toBe(-1)
  })

  it('allows creating past the old 5-profile free cap', async () => {
    const { checkProfileLimit } = await loadLicense(42)
    const limit = checkProfileLimit()

    expect(limit.allowed).toBe(true)
    expect(limit.current).toBe(42)
    // -1, not Infinity: callers test for -1 and Infinity does not survive a
    // JSON round-trip across the IPC boundary.
    expect(limit.max).toBe(-1)
    expect(JSON.parse(JSON.stringify(limit)).max).toBe(-1)
  })
})
