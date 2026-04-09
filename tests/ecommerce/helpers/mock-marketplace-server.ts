/**
 * Mock Marketplace Server — a lightweight Node HTTP server that serves the
 * fixture HTML files AND simulates the bits of marketplace behaviour we want
 * to exercise in tests that a static fixture can't cover:
 *
 *   - Login endpoint with rate-limiting (HTTP 429 after N attempts / window)
 *   - Session cookies (to validate profile rotation actually isolates state)
 *   - Concurrency counter so bulk-account tests can assert max-parallel caps
 *   - Artificial latency for price-pulse timing tests
 *
 * Implementation notes:
 *   - Uses Node's built-in http module (no Express) — zero new dependencies.
 *   - Listens on 127.0.0.1 + ephemeral port — safe to run in CI.
 *   - Keeps state in-memory per server instance; beforeEach() should create a
 *     fresh instance for isolation.
 */

import http from 'http'
import { readFile } from 'fs/promises'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const FIXTURE_DIR = resolve(__dirname, '../fixtures')

export interface MockServerOptions {
  /** Max login attempts per IP+username before 429s kick in. Default 3. */
  rateLimitMax?: number
  /** Rolling window (ms) for rate-limit counter. Default 10000. */
  rateLimitWindowMs?: number
  /** Artificial per-request latency in ms (e.g. to test timeouts). Default 0. */
  latencyMs?: number
  /** Max concurrent active requests allowed. Excess returns 503. Default unlimited. */
  maxConcurrent?: number
}

export interface LoginAttempt {
  username: string
  ip: string
  at: number
  success: boolean
}

export interface MockServerStats {
  totalRequests: number
  successfulLogins: number
  failedLogins: number
  rateLimited: number
  overCapacity: number
  /** Peak concurrent in-flight requests observed. */
  peakConcurrency: number
  /** Requests per path, useful for asserting which endpoints were hit. */
  pathCounts: Record<string, number>
  /** Session cookies issued (for isolation assertions). */
  sessionsByUser: Record<string, Set<string>>
}

const FIXTURE_MAP: Record<string, string> = {
  '/shopee/search':             'shopee-search.html',
  '/shopee/product':            'shopee-product.html',
  '/shopee/product/oos':        'shopee-product-oos.html',
  '/shopee/product/low-stock':  'shopee-product-low-stock.html',
  '/lazada/search':             'lazada-search.html',
  '/lazada/product':            'lazada-product.html',
  '/lazada/flash-sale':         'lazada-flash-sale.html',
  '/tiktok-shop/feed':          'tiktok-shop-feed.html',
  '/tiktok-shop/search':        'tiktok-shop-feed.html',
  '/tiki/search':               'tiki-search.html',
  '/tiki/flash-deal':           'tiki-flash-deal.html',
  '/vnpay/checkout':            'vnpay-checkout.html',
  '/grab/food/browse':          'grabfood-restaurants.html'
}

// Pre-cache fixture contents on first server start so we don't hit disk per req.
let fixtureCache: Record<string, string> | null = null
async function loadFixtures(): Promise<Record<string, string>> {
  if (fixtureCache) return fixtureCache
  const out: Record<string, string> = {}
  for (const [path, file] of Object.entries(FIXTURE_MAP)) {
    out[path] = await readFile(resolve(FIXTURE_DIR, file), 'utf8')
  }
  fixtureCache = out
  return out
}

export class MockMarketplaceServer {
  private server: http.Server | null = null
  private attempts: LoginAttempt[] = []
  private inFlight = 0
  readonly stats: MockServerStats = {
    totalRequests: 0,
    successfulLogins: 0,
    failedLogins: 0,
    rateLimited: 0,
    overCapacity: 0,
    peakConcurrency: 0,
    pathCounts: {},
    sessionsByUser: {}
  }

  constructor(private readonly opts: MockServerOptions = {}) {}

  async start(): Promise<{ port: number; baseUrl: string }> {
    const fixtures = await loadFixtures()
    this.server = http.createServer((req, res) => this.handle(req, res, fixtures))
    return new Promise((resolveListen, rejectListen) => {
      this.server!.once('error', rejectListen)
      this.server!.listen(0, '127.0.0.1', () => {
        const addr = this.server!.address()
        if (addr && typeof addr === 'object') {
          resolveListen({ port: addr.port, baseUrl: `http://127.0.0.1:${addr.port}` })
        } else {
          rejectListen(new Error('Mock server failed to bind'))
        }
      })
    })
  }

  async stop(): Promise<void> {
    if (!this.server) return
    await new Promise<void>((resolveClose) => this.server!.close(() => resolveClose()))
    this.server = null
  }

  private track(path: string): void {
    this.stats.totalRequests++
    this.stats.pathCounts[path] = (this.stats.pathCounts[path] ?? 0) + 1
  }

  private async handle(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    fixtures: Record<string, string>
  ): Promise<void> {
    this.inFlight++
    if (this.inFlight > this.stats.peakConcurrency) {
      this.stats.peakConcurrency = this.inFlight
    }

    try {
      // Concurrency cap
      if (this.opts.maxConcurrent && this.inFlight > this.opts.maxConcurrent) {
        this.stats.overCapacity++
        res.writeHead(503, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ error: 'server_over_capacity', retryAfter: 2 }))
        return
      }

      if (this.opts.latencyMs) {
        await new Promise((r) => setTimeout(r, this.opts.latencyMs))
      }

      const url = new URL(req.url ?? '/', 'http://localhost')
      const pathname = url.pathname

      this.track(pathname)

      // Health check
      if (pathname === '/health') {
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ ok: true, stats: this.stats }))
        return
      }

      // Login endpoint — used by bulk-account tests
      if (req.method === 'POST' && pathname.endsWith('/login')) {
        await this.handleLogin(req, res, pathname)
        return
      }

      // Fixture serve
      if (fixtures[pathname]) {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
        res.end(fixtures[pathname])
        return
      }

      // Generic JSON product endpoint: /:platform/api/product/:id
      const productMatch = pathname.match(/^\/([\w-]+)\/api\/product\/(\w+)$/)
      if (productMatch) {
        const [, platform, id] = productMatch
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(
          JSON.stringify({
            platform,
            id,
            title: `${platform} test product ${id}`,
            priceVnd: 100_000 + parseInt(id, 36) % 9_000_000,
            stock: (parseInt(id, 36) % 100) + 1,
            updatedAt: new Date().toISOString()
          })
        )
        return
      }

      res.writeHead(404, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'not_found', path: pathname }))
    } finally {
      this.inFlight--
    }
  }

  private async handleLogin(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    pathname: string
  ): Promise<void> {
    const body = await readBody(req)
    let payload: { username?: string; password?: string } = {}
    try {
      payload = JSON.parse(body)
    } catch { /* ignore */ }

    const ip = req.socket.remoteAddress ?? 'unknown'
    const username = payload.username ?? ''
    const password = payload.password ?? ''
    const now = Date.now()
    const windowMs = this.opts.rateLimitWindowMs ?? 10_000
    const maxAttempts = this.opts.rateLimitMax ?? 3

    // Prune old attempts
    this.attempts = this.attempts.filter((a) => now - a.at < windowMs)

    // Count recent attempts for this IP+username combo
    const recent = this.attempts.filter(
      (a) => a.ip === ip && a.username === username
    )
    if (recent.length >= maxAttempts) {
      this.stats.rateLimited++
      res.writeHead(429, {
        'content-type': 'application/json',
        'retry-after': String(Math.ceil(windowMs / 1000))
      })
      res.end(
        JSON.stringify({
          error: 'rate_limited',
          retryAfter: Math.ceil(windowMs / 1000),
          attemptsInWindow: recent.length
        })
      )
      return
    }

    // Accept anything with a non-empty password — this is a mock for bulk
    // account rotation, not an auth system.
    const success = username.length > 0 && password.length >= 6
    this.attempts.push({ username, ip, at: now, success })

    if (success) {
      const sessionId = `${pathname}-${username}-${Math.random().toString(36).slice(2)}`
      if (!this.stats.sessionsByUser[username]) {
        this.stats.sessionsByUser[username] = new Set()
      }
      this.stats.sessionsByUser[username].add(sessionId)
      this.stats.successfulLogins++
      res.writeHead(200, {
        'content-type': 'application/json',
        'set-cookie': `session=${sessionId}; HttpOnly; Path=/`
      })
      res.end(JSON.stringify({ ok: true, sessionId, username }))
    } else {
      this.stats.failedLogins++
      res.writeHead(401, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'invalid_credentials' }))
    }
  }
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolveBody) => {
    let buf = ''
    req.on('data', (chunk) => { buf += chunk })
    req.on('end', () => resolveBody(buf))
    req.on('error', () => resolveBody(buf))
  })
}

// ─── Convenience HTTP client for tests ───────────────────────────────────────

export interface LoginResult {
  status: number
  body: unknown
  sessionCookie: string | null
  retryAfter: number | null
}

export async function postLogin(
  baseUrl: string,
  platform: string,
  username: string,
  password: string
): Promise<LoginResult> {
  const res = await fetch(`${baseUrl}/${platform}/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password })
  })
  let body: unknown = null
  try { body = await res.json() } catch { /* empty */ }
  const setCookie = res.headers.get('set-cookie')
  const sessionCookie = setCookie && setCookie.includes('session=')
    ? setCookie.split(';')[0].split('=').slice(1).join('=')
    : null
  const retryAfterHeader = res.headers.get('retry-after')
  return {
    status: res.status,
    body,
    sessionCookie,
    retryAfter: retryAfterHeader ? parseInt(retryAfterHeader, 10) : null
  }
}

export async function getFixture(
  baseUrl: string,
  path: string
): Promise<{ status: number; body: string }> {
  const res = await fetch(`${baseUrl}${path}`)
  const body = await res.text()
  return { status: res.status, body }
}
