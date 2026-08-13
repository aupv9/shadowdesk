import { join } from 'path'
import { app } from 'electron'
import { mkdir } from 'fs/promises'
import puppeteer, { Browser, Page } from 'puppeteer-core'
import { FingerprintInjector } from './fingerprint/injector'
import { Database } from './database'
import { getSettings } from './settings'
import type { FingerprintConfig, ProxyConfig } from '../shared/types'

interface ActiveSession {
  browser: Browser
  profileId: string
  startedAt: Date
}

export interface ChromiumBinaryInfo {
  path: string
  fullVersion: string // e.g. "HeadlessChrome/132.0.6834.83"
  major: number       // e.g. 132
}

export class BrowserManager {
  private static instance: BrowserManager
  private sessions = new Map<string, ActiveSession>()
  private injector = new FingerprintInjector()
  // Phase 12.A.1 — cached Chromium binary version (detected once at startup)
  private binaryInfo: ChromiumBinaryInfo | null = null
  private binaryDetectPromise: Promise<ChromiumBinaryInfo> | null = null

  static getInstance(): BrowserManager {
    if (!BrowserManager.instance) {
      BrowserManager.instance = new BrowserManager()
    }
    return BrowserManager.instance
  }

  /**
   * Phase 12.A.1 — Detect the actual Chromium binary version.
   *
   * Launches puppeteer headless once, reads `browser.version()`, parses the
   * Chrome major, then closes. Result is cached for the rest of the app's
   * lifetime so subsequent calls are essentially free.
   *
   * Concurrent callers share the same in-flight detection promise.
   */
  async detectBinaryVersion(): Promise<ChromiumBinaryInfo> {
    if (this.binaryInfo) return this.binaryInfo
    if (this.binaryDetectPromise) return this.binaryDetectPromise

    this.binaryDetectPromise = (async () => {
      const path = await this.findChromium()
      let browser: Browser | null = null
      try {
        browser = await puppeteer.launch({
          executablePath: path,
          headless: true,
          args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-first-run', '--no-default-browser-check'],
          defaultViewport: { width: 800, height: 600 }
        })
        // browser.version() returns strings like "HeadlessChrome/132.0.6834.83"
        // or "Chrome/132.0.6834.83" depending on the binary
        const fullVersion = await browser.version()
        const match = fullVersion.match(/\/(\d+)\./)
        const major = match ? parseInt(match[1], 10) : 0
        const info: ChromiumBinaryInfo = { path, fullVersion, major }
        this.binaryInfo = info
        return info
      } finally {
        if (browser) {
          try { await browser.close() } catch { /* ignore */ }
        }
      }
    })()

    try {
      return await this.binaryDetectPromise
    } catch (err) {
      // Reset so a future call can retry
      this.binaryDetectPromise = null
      throw err
    }
  }

  /** Synchronous accessor for the cached binary info, or null if not detected yet. */
  getCachedBinaryInfo(): ChromiumBinaryInfo | null {
    return this.binaryInfo
  }

  /**
   * Phase 12.A.1 — Rewrite the spoofed UA to match the real Chromium binary major version.
   *
   * Returns a *new* fingerprint object with `browser.version` and `browser.userAgent`
   * updated. The UA-Client-Hints script (`useragentdata.ts`) reads `browser.version`
   * dynamically at injection time, so updating it here propagates to the brands array
   * automatically.
   *
   * The original profile in the DB is **not** mutated — this is a per-launch transformation.
   * If the spoofed major already matches the binary major, the input is returned unchanged.
   * iOS / Safari profiles (no `Chrome/` token in the UA) are left untouched.
   */
  syncFingerprintToBinary(fp: FingerprintConfig, binaryMajor: number): FingerprintConfig {
    if (!binaryMajor) return fp
    if (!/Chrome\/\d+\./.test(fp.browser.userAgent)) return fp // not a Chrome UA — skip

    const spoofedMajor = parseInt(fp.browser.version, 10)
    if (spoofedMajor === binaryMajor) return fp

    const newVersion = String(binaryMajor)
    const newUA = fp.browser.userAgent.replace(/Chrome\/\d+\./, `Chrome/${binaryMajor}.`)

    return {
      ...fp,
      browser: {
        ...fp.browser,
        version: newVersion,
        userAgent: newUA
      }
    }
  }

  async launchProfile(
    profileId: string,
    fingerprint: FingerprintConfig,
    proxy?: ProxyConfig,
    cookies?: any[]
  ): Promise<void> {
    if (this.sessions.has(profileId)) {
      // Bring existing session to front
      const session = this.sessions.get(profileId)!
      const pages = await session.browser.pages()
      if (pages.length > 0) {
        await pages[pages.length - 1].bringToFront()
      }
      return
    }

    // Phase 12.A.1 — auto-sync the spoofed UA to the real Chromium binary major
    // so the JS-injected userAgent matches the TLS/JA3 fingerprint of the binary.
    // Setting is ON by default; users can disable it to pin a specific UA per profile.
    let effectiveFingerprint = fingerprint
    try {
      if (getSettings().autoSyncBinaryUA !== false) {
        const info = await this.detectBinaryVersion()
        effectiveFingerprint = this.syncFingerprintToBinary(fingerprint, info.major)
      }
    } catch (err) {
      console.warn('[browser-manager] binary version sync skipped:', (err as Error).message)
    }

    const userDataDir = await this.ensureProfileDir(profileId)
    const launchArgs = this.buildLaunchArgs(effectiveFingerprint, proxy)

    // Phase 10.3 — load any per-profile Chrome extensions (unpacked)
    try {
      const exts = Database.getInstance().getProfileExtensions(profileId) as any[]
      const enabled = exts.filter((e) => !!e.enabled).map((e) => e.path)
      if (enabled.length > 0) {
        launchArgs.push(`--load-extension=${enabled.join(',')}`)
        launchArgs.push(`--disable-extensions-except=${enabled.join(',')}`)
        // Extensions cannot be loaded in headless mode and need DOM Storage on
        launchArgs.push('--enable-extensions')
      }
    } catch (err) {
      console.warn('[browser-manager] failed to load extensions:', (err as Error).message)
    }

    const chromiumPath = await this.findChromium()

    const browser = await puppeteer.launch({
      executablePath: chromiumPath,
      headless: false,
      userDataDir,
      args: launchArgs,
      defaultViewport: null,
      ignoreDefaultArgs: ['--enable-automation', '--enable-blink-features=IdleDetection']
    })

    // Inject fingerprint on all new pages
    browser.on('targetcreated', async (target) => {
      if (target.type() === 'page') {
        const page = await target.page()
        if (page) {
          await this.injector.injectAll(page, effectiveFingerprint)
        }
      }
    })

    // Inject fingerprint + cookies into the initial page
    const pages = await browser.pages()
    for (const page of pages) {
      await this.injector.injectAll(page, effectiveFingerprint)
      if (cookies && cookies.length > 0) {
        await page.setCookie(...cookies).catch(() => {})
      }
      await page.goto('about:blank')
    }

    this.sessions.set(profileId, {
      browser,
      profileId,
      startedAt: new Date()
    })

    browser.on('disconnected', () => {
      this.sessions.delete(profileId)
    })
  }

  async closeProfile(profileId: string): Promise<void> {
    const session = this.sessions.get(profileId)
    if (session) {
      await session.browser.close()
      this.sessions.delete(profileId)
    }
  }

  async closeAll(): Promise<void> {
    const closers = Array.from(this.sessions.values()).map((s) =>
      s.browser.close().catch(() => {})
    )
    await Promise.all(closers)
    this.sessions.clear()
  }

  getActiveSessions(): string[] {
    return Array.from(this.sessions.keys())
  }

  isRunning(profileId: string): boolean {
    return this.sessions.has(profileId)
  }

  async getActivePage(profileId: string): Promise<import('puppeteer-core').Page | null> {
    const session = this.sessions.get(profileId)
    if (!session) return null
    const pages = await session.browser.pages()
    return pages.find((p) => !p.isClosed()) ?? null
  }

  private async ensureProfileDir(profileId: string): Promise<string> {
    const profilesDir = join(app.getPath('userData'), 'profiles', profileId)
    await mkdir(profilesDir, { recursive: true })
    return profilesDir
  }

  private buildLaunchArgs(fp: FingerprintConfig, proxy?: ProxyConfig): string[] {
    const args = [
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-infobars',
      '--disable-blink-features=AutomationControlled',
      `--lang=${fp.locale.language}`,
      `--window-size=${fp.screen.width},${fp.screen.height}`,
      // Phase 5: Enhanced CDP evasion flags
      '--disable-features=AutomationControlled,IsolateOrigins',
      '--disable-blink-features=AutomationControlled,IdleDetection',
      '--disable-component-extensions-with-background-pages',
      '--disable-default-apps',
      '--disable-hang-monitor',
      '--disable-popup-blocking',
      '--disable-prompt-on-repost',
      '--disable-background-networking',
      '--disable-sync',
      '--metrics-recording-only',
      '--no-pings'
    ]

    // Proxy
    if (proxy) {
      args.push(`--proxy-server=${proxy.type}://${proxy.host}:${proxy.port}`)
      if (proxy.type === 'socks5') {
        args.push('--proxy-dns') // Prevent DNS leaks with SOCKS5
      }
    }

    return args
  }

  private chromiumPathCache: string | null = null

  private async findChromium(): Promise<string> {
    if (this.chromiumPathCache) return this.chromiumPathCache
    const { access, readdir } = await import('fs/promises')

    // Resolve Playwright's bundled Chromium dynamically (version dir changes on update)
    const playwrightChromium = await this.findPlaywrightChromium(readdir)

    const candidates: string[] =
      process.platform === 'win32'
        ? [
            ...(playwrightChromium ? [playwrightChromium] : []),
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
            // Edge is Chromium-based and ships with Windows — good fallback
            'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
            'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
          ]
        : process.platform === 'darwin'
          ? [
              '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
              '/Applications/Chromium.app/Contents/MacOS/Chromium',
              '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
            ]
          : [
              '/usr/bin/google-chrome',
              '/usr/bin/chromium-browser',
              '/usr/bin/chromium',
              '/usr/bin/microsoft-edge'
            ]

    for (const p of candidates) {
      try {
        await access(p)
        this.chromiumPathCache = p
        return p
      } catch {
        // not found, try next
      }
    }

    const err = new Error(
      'Chrome/Chromium not found. Please install Google Chrome (or Microsoft Edge) to use ShadowDesk.'
    ) as any
    err.code = 'CHROMIUM_NOT_FOUND'
    throw err
  }

  pickProxy(
    profile: { proxy_id?: string; rotation_mode?: string; rotation_index?: number },
    allProxies: any[]
  ): { proxy: any | null; nextIndex?: number } {
    const mode = profile.rotation_mode ?? 'none'

    if (mode === 'random') {
      const healthy = allProxies.filter((p) => p.is_healthy === 1)
      const pool = healthy.length > 0 ? healthy : allProxies
      if (pool.length === 0) return { proxy: null }
      return { proxy: pool[Math.floor(Math.random() * pool.length)] }
    }

    if (mode === 'round-robin') {
      const pool = allProxies.filter((p) => p.is_healthy === 1)
      if (pool.length === 0) return { proxy: null }
      const idx = (profile.rotation_index ?? 0) % pool.length
      return { proxy: pool[idx], nextIndex: idx + 1 }
    }

    // mode === 'none' — use fixed proxy_id
    if (profile.proxy_id) {
      return { proxy: allProxies.find((p) => p.id === profile.proxy_id) ?? null }
    }
    return { proxy: null }
  }

  async testProxy(proxy: ProxyConfig): Promise<{ latency_ms: number; ip: string }> {
    const chromiumPath = await this.findChromium()
    const creds = proxy.username
      ? `${encodeURIComponent(proxy.username)}:${encodeURIComponent(proxy.password ?? '')}@`
      : ''
    const proxyUrl = `${proxy.type}://${creds}${proxy.host}:${proxy.port}`

    const start = Date.now()
    const browser = await puppeteer.launch({
      executablePath: chromiumPath,
      headless: true,
      args: [`--proxy-server=${proxyUrl}`, '--no-sandbox', '--disable-dev-shm-usage'],
      defaultViewport: { width: 800, height: 600 }
    })

    try {
      const page = await browser.newPage()
      if (proxy.username) {
        await page.authenticate({ username: proxy.username, password: proxy.password ?? '' })
      }
      const response = await page.goto('http://ip-api.com/json', {
        timeout: 12000,
        waitUntil: 'networkidle2'
      })
      const latency_ms = Date.now() - start
      const data = (await response!.json()) as any
      return { latency_ms, ip: data.query ?? proxy.host }
    } finally {
      await browser.close()
    }
  }

  private async findPlaywrightChromium(
    readdir: (path: string) => Promise<string[]>
  ): Promise<string | null> {
    const playwrightDir = join(process.env.LOCALAPPDATA || '', 'ms-playwright')
    try {
      const entries = await readdir(playwrightDir)
      const chromiumDir = entries.find((e) => e.startsWith('chromium-'))
      if (!chromiumDir) return null

      return process.platform === 'win32'
        ? join(playwrightDir, chromiumDir, 'chrome-win', 'chrome.exe')
        : process.platform === 'darwin'
          ? join(playwrightDir, chromiumDir, 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium')
          : join(playwrightDir, chromiumDir, 'chrome-linux', 'chrome')
    } catch {
      return null
    }
  }
}
