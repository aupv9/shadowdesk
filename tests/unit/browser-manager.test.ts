/**
 * Phase 13 — Unit tests for BrowserManager.
 *
 * Tests:
 *  - Singleton pattern
 *  - Session management (launch / close / closeAll)
 *  - isRunning / getActiveSessions state reflection
 *  - syncFingerprintToBinary — UA rewriting for Chrome / non-Chrome, version matching
 *  - pickProxy — none / random / round-robin modes, healthy filter, empty pool
 *  - buildLaunchArgs — proxy args, language, screen size
 *  - launchProfile — brings existing session to front if already running
 *  - closeProfile — handles missing profile gracefully
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// ── Mock helpers ─────────────────────────────────────────────────────────────

const mockPage = {
  bringToFront: vi.fn().mockResolvedValue(undefined),
  setCookie: vi.fn().mockResolvedValue(undefined),
  goto: vi.fn().mockResolvedValue(undefined),
  isClosed: vi.fn().mockReturnValue(false)
}

const mockBrowser = {
  pages: vi.fn().mockResolvedValue([mockPage]),
  on: vi.fn(),
  close: vi.fn().mockResolvedValue(undefined),
  version: vi.fn().mockResolvedValue('HeadlessChrome/132.0.6834.83')
}

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn().mockReturnValue('/tmp/test-userdata')
  }
}))

vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  access: vi.fn().mockResolvedValue(undefined),
  readdir: vi.fn().mockResolvedValue([])
}))

vi.mock('puppeteer-core', () => ({
  default: {
    launch: vi.fn().mockResolvedValue({
      pages: vi.fn().mockResolvedValue([{
        bringToFront: vi.fn().mockResolvedValue(undefined),
        setCookie: vi.fn().mockResolvedValue(undefined),
        goto: vi.fn().mockResolvedValue(undefined),
        isClosed: vi.fn().mockReturnValue(false)
      }]),
      on: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
      version: vi.fn().mockResolvedValue('HeadlessChrome/132.0.6834.83')
    })
  }
}))

vi.mock('../../src/main/database', () => ({
  Database: {
    getInstance: () => ({
      getProfileExtensions: vi.fn().mockReturnValue([])
    })
  }
}))

vi.mock('../../src/main/settings', () => ({
  getSettings: () => ({ autoSyncBinaryUA: false })
}))

vi.mock('../../src/main/fingerprint/injector', () => ({
  FingerprintInjector: class {
    injectAll = vi.fn().mockResolvedValue(undefined)
  }
}))

// ── Test data ────────────────────────────────────────────────────────────────

const mockFingerprint = {
  browser: {
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    version: '120'
  },
  locale: { language: 'en-US', timezone: 'America/New_York' },
  screen: { width: 1920, height: 1080 }
} as any

const mockProxy = {
  id: 'proxy-1',
  name: 'US Proxy',
  type: 'http' as const,
  host: '1.2.3.4',
  port: 8080
}

const socks5Proxy = {
  id: 'proxy-2',
  name: 'SOCKS Proxy',
  type: 'socks5' as const,
  host: '5.6.7.8',
  port: 1080,
  username: 'user',
  password: 'pass'
}

// ── Import after mocks ──────────────────────────────────────────────────────

import { BrowserManager } from '../../src/main/browser-manager'

// ── Utility: get a clean BrowserManager instance ────────────────────────────

function freshManager(): BrowserManager {
  // Reset singleton so each test group gets a clean instance
  ;(BrowserManager as any).instance = undefined
  return BrowserManager.getInstance()
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('BrowserManager — singleton pattern', () => {
  beforeEach(() => {
    ;(BrowserManager as any).instance = undefined
  })

  it('getInstance returns a BrowserManager instance', () => {
    const bm = BrowserManager.getInstance()
    expect(bm).toBeInstanceOf(BrowserManager)
  })

  it('getInstance returns the same instance on repeated calls', () => {
    const a = BrowserManager.getInstance()
    const b = BrowserManager.getInstance()
    expect(a).toBe(b)
  })

  it('resetting static instance yields a new object', () => {
    const a = BrowserManager.getInstance()
    ;(BrowserManager as any).instance = undefined
    const b = BrowserManager.getInstance()
    expect(a).not.toBe(b)
  })
})

describe('BrowserManager — session management', () => {
  let bm: BrowserManager

  beforeEach(() => {
    bm = freshManager()
  })

  it('starts with no active sessions', () => {
    expect(bm.getActiveSessions()).toEqual([])
  })

  it('launchProfile adds profileId to active sessions', async () => {
    await bm.launchProfile('profile-1', mockFingerprint)
    expect(bm.getActiveSessions()).toContain('profile-1')
  })

  it('launchProfile with multiple profiles tracks all', async () => {
    await bm.launchProfile('p1', mockFingerprint)
    await bm.launchProfile('p2', mockFingerprint)
    const sessions = bm.getActiveSessions()
    expect(sessions).toContain('p1')
    expect(sessions).toContain('p2')
    expect(sessions).toHaveLength(2)
  })

  it('closeProfile removes session from active list', async () => {
    await bm.launchProfile('p1', mockFingerprint)
    await bm.closeProfile('p1')
    expect(bm.getActiveSessions()).not.toContain('p1')
  })

  it('closeAll clears all sessions', async () => {
    await bm.launchProfile('p1', mockFingerprint)
    await bm.launchProfile('p2', mockFingerprint)
    await bm.closeAll()
    expect(bm.getActiveSessions()).toEqual([])
  })

  it('closeAll calls browser.close() on every session', async () => {
    const puppeteer = (await import('puppeteer-core')).default
    const closeSpy = vi.fn().mockResolvedValue(undefined)
    ;(puppeteer.launch as any).mockResolvedValue({
      pages: vi.fn().mockResolvedValue([{
        bringToFront: vi.fn().mockResolvedValue(undefined),
        setCookie: vi.fn().mockResolvedValue(undefined),
        goto: vi.fn().mockResolvedValue(undefined),
        isClosed: vi.fn().mockReturnValue(false)
      }]),
      on: vi.fn(),
      close: closeSpy,
      version: vi.fn().mockResolvedValue('HeadlessChrome/132.0.6834.83')
    })
    await bm.launchProfile('close-all-1', mockFingerprint)
    await bm.closeAll()
    expect(closeSpy).toHaveBeenCalled()
  })
})

describe('BrowserManager — isRunning / getActiveSessions', () => {
  let bm: BrowserManager

  beforeEach(() => {
    bm = freshManager()
  })

  it('isRunning returns false for unknown profile', () => {
    expect(bm.isRunning('nonexistent')).toBe(false)
  })

  it('isRunning returns true after launch', async () => {
    await bm.launchProfile('running-1', mockFingerprint)
    expect(bm.isRunning('running-1')).toBe(true)
  })

  it('isRunning returns false after close', async () => {
    await bm.launchProfile('running-2', mockFingerprint)
    await bm.closeProfile('running-2')
    expect(bm.isRunning('running-2')).toBe(false)
  })

  it('getActiveSessions returns correct IDs', async () => {
    await bm.launchProfile('a', mockFingerprint)
    await bm.launchProfile('b', mockFingerprint)
    const ids = bm.getActiveSessions()
    expect(ids.sort()).toEqual(['a', 'b'])
  })
})

describe('BrowserManager — launchProfile brings existing to front', () => {
  let bm: BrowserManager

  beforeEach(async () => {
    bm = freshManager()
    const puppeteer = (await import('puppeteer-core')).default
    const bringToFrontSpy = vi.fn().mockResolvedValue(undefined)
    const mockBrowserInstance = {
      pages: vi.fn().mockResolvedValue([
        {
          bringToFront: bringToFrontSpy,
          setCookie: vi.fn().mockResolvedValue(undefined),
          goto: vi.fn().mockResolvedValue(undefined),
          isClosed: vi.fn().mockReturnValue(false)
        }
      ]),
      on: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
      version: vi.fn().mockResolvedValue('HeadlessChrome/132.0.6834.83')
    }
    ;(puppeteer.launch as any).mockResolvedValue(mockBrowserInstance)
  })

  it('does not launch a second browser if profile is already running', async () => {
    const puppeteer = (await import('puppeteer-core')).default
    await bm.launchProfile('dup-1', mockFingerprint)
    const launchCountBefore = (puppeteer.launch as any).mock.calls.length

    await bm.launchProfile('dup-1', mockFingerprint)
    const launchCountAfter = (puppeteer.launch as any).mock.calls.length

    // Should NOT have called puppeteer.launch again
    expect(launchCountAfter).toBe(launchCountBefore)
  })

  it('calls bringToFront on the existing page', async () => {
    const puppeteer = (await import('puppeteer-core')).default
    const bringToFrontSpy = vi.fn().mockResolvedValue(undefined)
    const mockBrowserInstance = {
      pages: vi.fn().mockResolvedValue([
        {
          bringToFront: bringToFrontSpy,
          setCookie: vi.fn().mockResolvedValue(undefined),
          goto: vi.fn().mockResolvedValue(undefined),
          isClosed: vi.fn().mockReturnValue(false)
        }
      ]),
      on: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
      version: vi.fn().mockResolvedValue('HeadlessChrome/132.0.6834.83')
    }
    ;(puppeteer.launch as any).mockResolvedValue(mockBrowserInstance)

    await bm.launchProfile('front-1', mockFingerprint)
    // Second launch should bring to front
    await bm.launchProfile('front-1', mockFingerprint)
    expect(bringToFrontSpy).toHaveBeenCalled()
  })
})

describe('BrowserManager — closeProfile edge cases', () => {
  let bm: BrowserManager

  beforeEach(() => {
    bm = freshManager()
  })

  it('closeProfile with non-existent profile does not throw', async () => {
    await expect(bm.closeProfile('ghost')).resolves.toBeUndefined()
  })

  it('closeProfile twice does not throw', async () => {
    await bm.launchProfile('double-close', mockFingerprint)
    await bm.closeProfile('double-close')
    await expect(bm.closeProfile('double-close')).resolves.toBeUndefined()
  })
})

describe('BrowserManager — getActivePage', () => {
  let bm: BrowserManager

  beforeEach(() => {
    bm = freshManager()
  })

  it('returns null for unknown profile', async () => {
    const page = await bm.getActivePage('nobody')
    expect(page).toBeNull()
  })

  it('returns a page for an active session', async () => {
    await bm.launchProfile('paged-1', mockFingerprint)
    const page = await bm.getActivePage('paged-1')
    expect(page).not.toBeNull()
  })
})

describe('BrowserManager — syncFingerprintToBinary', () => {
  let bm: BrowserManager

  beforeEach(() => {
    bm = freshManager()
  })

  it('returns fingerprint unchanged when binaryMajor is 0 (falsy)', () => {
    const result = bm.syncFingerprintToBinary(mockFingerprint, 0)
    expect(result).toBe(mockFingerprint) // same reference
  })

  it('returns fingerprint unchanged for non-Chrome UA (Safari)', () => {
    const safariFingerprint = {
      ...mockFingerprint,
      browser: {
        ...mockFingerprint.browser,
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
        version: '17'
      }
    }
    const result = bm.syncFingerprintToBinary(safariFingerprint, 132)
    expect(result).toBe(safariFingerprint) // same reference, untouched
  })

  it('returns fingerprint unchanged when spoofed major matches binary major', () => {
    const fp = {
      ...mockFingerprint,
      browser: { ...mockFingerprint.browser, version: '132', userAgent: mockFingerprint.browser.userAgent.replace('Chrome/120.', 'Chrome/132.') }
    }
    const result = bm.syncFingerprintToBinary(fp, 132)
    expect(result).toBe(fp)
  })

  it('rewrites UA Chrome version to match binary major', () => {
    const result = bm.syncFingerprintToBinary(mockFingerprint, 132)
    expect(result.browser.userAgent).toContain('Chrome/132.')
    expect(result.browser.userAgent).not.toContain('Chrome/120.')
  })

  it('updates browser.version to string of binary major', () => {
    const result = bm.syncFingerprintToBinary(mockFingerprint, 132)
    expect(result.browser.version).toBe('132')
  })

  it('does not mutate the original fingerprint object', () => {
    const originalUA = mockFingerprint.browser.userAgent
    bm.syncFingerprintToBinary(mockFingerprint, 132)
    expect(mockFingerprint.browser.userAgent).toBe(originalUA)
  })

  it('preserves all other fingerprint fields', () => {
    const result = bm.syncFingerprintToBinary(mockFingerprint, 132)
    expect(result.locale).toBe(mockFingerprint.locale)
    expect(result.screen).toBe(mockFingerprint.screen)
  })

  it('handles version downgrade (132 -> 118)', () => {
    const fp132 = {
      ...mockFingerprint,
      browser: {
        ...mockFingerprint.browser,
        version: '132',
        userAgent: mockFingerprint.browser.userAgent.replace('Chrome/120.', 'Chrome/132.')
      }
    }
    const result = bm.syncFingerprintToBinary(fp132, 118)
    expect(result.browser.version).toBe('118')
    expect(result.browser.userAgent).toContain('Chrome/118.')
  })
})

describe('BrowserManager — pickProxy', () => {
  const proxies = [
    { id: 'p1', name: 'Proxy 1', is_healthy: 1 },
    { id: 'p2', name: 'Proxy 2', is_healthy: 1 },
    { id: 'p3', name: 'Proxy 3', is_healthy: 0 },
    { id: 'p4', name: 'Proxy 4', is_healthy: 1 }
  ]

  let bm: BrowserManager

  beforeEach(() => {
    bm = freshManager()
  })

  // — mode: none —

  it('none mode with proxy_id returns matching proxy', () => {
    const result = bm.pickProxy({ proxy_id: 'p2', rotation_mode: 'none' }, proxies)
    expect(result.proxy).toEqual(proxies[1])
  })

  it('none mode without proxy_id returns null proxy', () => {
    const result = bm.pickProxy({ rotation_mode: 'none' }, proxies)
    expect(result.proxy).toBeNull()
  })

  it('none mode is the default when rotation_mode is undefined', () => {
    const result = bm.pickProxy({ proxy_id: 'p1' }, proxies)
    expect(result.proxy).toEqual(proxies[0])
  })

  it('none mode with non-existent proxy_id returns null proxy', () => {
    const result = bm.pickProxy({ proxy_id: 'does-not-exist', rotation_mode: 'none' }, proxies)
    expect(result.proxy).toBeNull()
  })

  // — mode: random —

  it('random mode returns a proxy from the pool', () => {
    const result = bm.pickProxy({ rotation_mode: 'random' }, proxies)
    expect(result.proxy).not.toBeNull()
    expect(proxies).toContainEqual(result.proxy)
  })

  it('random mode prefers healthy proxies', () => {
    // Run many times — should only return healthy proxies
    const results = new Set<string>()
    for (let i = 0; i < 100; i++) {
      const r = bm.pickProxy({ rotation_mode: 'random' }, proxies)
      results.add(r.proxy.id)
    }
    // p3 is unhealthy — should never appear when healthy proxies exist
    expect(results.has('p3')).toBe(false)
  })

  it('random mode falls back to all proxies when none are healthy', () => {
    const unhealthyOnly = [
      { id: 'u1', name: 'U1', is_healthy: 0 },
      { id: 'u2', name: 'U2', is_healthy: 0 }
    ]
    const result = bm.pickProxy({ rotation_mode: 'random' }, unhealthyOnly)
    expect(result.proxy).not.toBeNull()
    expect(unhealthyOnly).toContainEqual(result.proxy)
  })

  it('random mode returns null when pool is empty', () => {
    const result = bm.pickProxy({ rotation_mode: 'random' }, [])
    expect(result.proxy).toBeNull()
  })

  // — mode: round-robin —

  it('round-robin returns first healthy proxy at index 0', () => {
    const result = bm.pickProxy({ rotation_mode: 'round-robin', rotation_index: 0 }, proxies)
    const healthy = proxies.filter((p) => p.is_healthy === 1)
    expect(result.proxy).toEqual(healthy[0])
  })

  it('round-robin returns nextIndex for DB update', () => {
    const result = bm.pickProxy({ rotation_mode: 'round-robin', rotation_index: 0 }, proxies)
    expect(result.nextIndex).toBe(1)
  })

  it('round-robin wraps around when index exceeds pool size', () => {
    const healthy = proxies.filter((p) => p.is_healthy === 1)
    const result = bm.pickProxy(
      { rotation_mode: 'round-robin', rotation_index: healthy.length },
      proxies
    )
    expect(result.proxy).toEqual(healthy[0])
  })

  it('round-robin skips unhealthy proxies', () => {
    // Healthy pool is p1, p2, p4 (indices 0, 1, 2)
    // Index 1 should give p2, not p3
    const result = bm.pickProxy({ rotation_mode: 'round-robin', rotation_index: 1 }, proxies)
    expect(result.proxy.id).toBe('p2')
  })

  it('round-robin returns null when no healthy proxies exist', () => {
    const allUnhealthy = [
      { id: 'u1', name: 'U1', is_healthy: 0 },
      { id: 'u2', name: 'U2', is_healthy: 0 }
    ]
    const result = bm.pickProxy({ rotation_mode: 'round-robin' }, allUnhealthy)
    expect(result.proxy).toBeNull()
  })

  it('round-robin defaults rotation_index to 0 when undefined', () => {
    const result = bm.pickProxy({ rotation_mode: 'round-robin' }, proxies)
    const healthy = proxies.filter((p) => p.is_healthy === 1)
    expect(result.proxy).toEqual(healthy[0])
    expect(result.nextIndex).toBe(1)
  })
})

describe('BrowserManager — buildLaunchArgs (via private method)', () => {
  let bm: BrowserManager

  beforeEach(() => {
    bm = freshManager()
  })

  // Access private method for testing pure logic
  function callBuildLaunchArgs(fp: any, proxy?: any): string[] {
    return (bm as any).buildLaunchArgs(fp, proxy)
  }

  it('includes --lang with fingerprint language', () => {
    const args = callBuildLaunchArgs(mockFingerprint)
    expect(args).toContain('--lang=en-US')
  })

  it('includes --window-size with fingerprint screen dimensions', () => {
    const args = callBuildLaunchArgs(mockFingerprint)
    expect(args).toContain('--window-size=1920,1080')
  })

  it('includes standard evasion flags', () => {
    const args = callBuildLaunchArgs(mockFingerprint)
    expect(args).toContain('--no-first-run')
    expect(args).toContain('--no-default-browser-check')
    expect(args).toContain('--disable-infobars')
  })

  it('does not include proxy arg when no proxy provided', () => {
    const args = callBuildLaunchArgs(mockFingerprint)
    const proxyArg = args.find((a) => a.startsWith('--proxy-server='))
    expect(proxyArg).toBeUndefined()
  })

  it('includes --proxy-server for http proxy', () => {
    const args = callBuildLaunchArgs(mockFingerprint, mockProxy)
    expect(args).toContain('--proxy-server=http://1.2.3.4:8080')
  })

  it('includes --proxy-server for socks5 proxy', () => {
    const args = callBuildLaunchArgs(mockFingerprint, socks5Proxy)
    expect(args).toContain('--proxy-server=socks5://5.6.7.8:1080')
  })

  it('includes --proxy-dns for socks5 proxy to prevent DNS leaks', () => {
    const args = callBuildLaunchArgs(mockFingerprint, socks5Proxy)
    expect(args).toContain('--proxy-dns')
  })

  it('does not include --proxy-dns for http proxy', () => {
    const args = callBuildLaunchArgs(mockFingerprint, mockProxy)
    expect(args).not.toContain('--proxy-dns')
  })

  it('adapts to different screen sizes', () => {
    const mobileFP = {
      ...mockFingerprint,
      screen: { width: 390, height: 844 }
    }
    const args = callBuildLaunchArgs(mobileFP)
    expect(args).toContain('--window-size=390,844')
  })

  it('adapts to different locale', () => {
    const jaFP = {
      ...mockFingerprint,
      locale: { language: 'ja-JP', timezone: 'Asia/Tokyo' }
    }
    const args = callBuildLaunchArgs(jaFP)
    expect(args).toContain('--lang=ja-JP')
  })
})
