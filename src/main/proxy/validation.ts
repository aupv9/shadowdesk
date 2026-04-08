/**
 * Proxy validation + IP-leak detection helpers.
 *
 * - `validateProxyInput`: structural validation of host/port/type before
 *   any database write. Rejects path-traversal-style hostnames, junk
 *   characters, and out-of-range ports.
 * - `tcpHandshake`: lightweight reachability check (open TCP socket, no
 *   browser launch). Used by the create/import flow to fail fast on dead
 *   proxies instead of silently storing them.
 * - `getRealIp`: caches the user's *unproxied* public IP. The cache lives
 *   for `REAL_IP_TTL_MS` to detect VPN/IP changes.
 * - `detectIpLeak`: compares a proxied IP with the cached real IP. If they
 *   match, the proxy is leaking the user's real address (or is dead and
 *   the request fell through to the direct connection).
 */

import { createConnection } from 'net'
import { request as httpsRequest } from 'https'

// ── Input validation ──────────────────────────────────────────────────────

const VALID_PROXY_TYPES = new Set(['http', 'https', 'socks5'])

/**
 * Hostname / IPv4 / IPv6 character whitelist.
 * Allows: a-z A-Z 0-9 . - : _ (the underscore is technically illegal in
 * RFC 1035 but tolerated by many proxy providers).
 * Disallows: / \ space ; ' " $ < > | * ? & % @
 */
const HOST_PATTERN = /^[a-zA-Z0-9.\-:_]+$/

export interface ProxyInputError {
  field: 'type' | 'host' | 'port' | 'username' | 'password'
  message: string
}

export interface ProxyValidatable {
  type?: string
  host?: string
  port?: number
  username?: string
  password?: string
}

/**
 * Validate the structural shape of a proxy input. Returns the first error
 * found, or null if everything is OK.
 */
export function validateProxyInput(input: ProxyValidatable): ProxyInputError | null {
  if (!input.type || !VALID_PROXY_TYPES.has(input.type)) {
    return { field: 'type', message: `Invalid proxy type. Must be one of: ${[...VALID_PROXY_TYPES].join(', ')}` }
  }

  if (!input.host || typeof input.host !== 'string') {
    return { field: 'host', message: 'Host is required' }
  }
  if (input.host.length > 255) {
    return { field: 'host', message: 'Host exceeds 255 characters' }
  }
  if (!HOST_PATTERN.test(input.host)) {
    return { field: 'host', message: 'Host contains invalid characters (only alphanumerics, dot, dash, colon, underscore allowed)' }
  }
  // Defence-in-depth against path-traversal-style payloads
  if (input.host.includes('..') || input.host.startsWith('.') || input.host.startsWith('-')) {
    return { field: 'host', message: 'Host has malformed structure' }
  }

  if (typeof input.port !== 'number' || !Number.isInteger(input.port) || input.port < 1 || input.port > 65535) {
    return { field: 'port', message: 'Port must be an integer between 1 and 65535' }
  }

  if (input.username !== undefined && typeof input.username === 'string' && input.username.length > 255) {
    return { field: 'username', message: 'Username exceeds 255 characters' }
  }
  if (input.password !== undefined && typeof input.password === 'string' && input.password.length > 1024) {
    return { field: 'password', message: 'Password exceeds 1024 characters' }
  }

  return null
}

// ── TCP reachability ──────────────────────────────────────────────────────

/**
 * Open a TCP connection to host:port and resolve as soon as the handshake
 * completes (or rejects on timeout / connection refused).
 *
 * NOTE: This only proves the *port is open*. It does not prove the remote
 * speaks HTTP/SOCKS5 — that's what `testProxy` (the browser-based test) is
 * for. The point of this check is to fail fast on typos and dead proxies
 * during bulk import without spending 12s per entry on a full browser test.
 */
export function tcpHandshake(host: string, port: number, timeoutMs = 4000): Promise<{ ok: boolean; latency_ms: number; error?: string }> {
  return new Promise((resolve) => {
    const start = Date.now()
    let settled = false

    const finish = (ok: boolean, error?: string) => {
      if (settled) return
      settled = true
      const latency_ms = Date.now() - start
      try { socket.destroy() } catch { /* ignore */ }
      resolve({ ok, latency_ms, error })
    }

    const socket = createConnection({ host, port })
    socket.setTimeout(timeoutMs)
    socket.once('connect', () => finish(true))
    socket.once('timeout', () => finish(false, `TCP handshake timed out after ${timeoutMs}ms`))
    socket.once('error', (err) => finish(false, err.message))
  })
}

// ── Real IP cache + leak detection ────────────────────────────────────────

const REAL_IP_TTL_MS = 5 * 60 * 1000 // 5 minutes
let cachedRealIp: { ip: string; ts: number } | null = null

/**
 * Fetch the unproxied public IP. Cached for `REAL_IP_TTL_MS`. Returns null
 * on network failure (so callers can degrade to "leak detection unavailable"
 * rather than blocking the test entirely).
 */
export async function getRealIp(): Promise<string | null> {
  if (cachedRealIp && Date.now() - cachedRealIp.ts < REAL_IP_TTL_MS) {
    return cachedRealIp.ip
  }

  try {
    const ip = await fetchIp()
    cachedRealIp = { ip, ts: Date.now() }
    return ip
  } catch {
    return null
  }
}

function fetchIp(): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = httpsRequest(
      {
        hostname: 'api.ipify.org',
        path: '/?format=json',
        method: 'GET',
        timeout: 5000,
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data)
            if (parsed && typeof parsed.ip === 'string') resolve(parsed.ip)
            else reject(new Error('malformed response'))
          } catch (e) {
            reject(e instanceof Error ? e : new Error(String(e)))
          }
        })
      },
    )
    req.once('timeout', () => { req.destroy(new Error('timeout')) })
    req.once('error', reject)
    req.end()
  })
}

export type LeakStatus = 'leak' | 'safe' | 'unknown'

export interface LeakReport {
  status: LeakStatus
  proxiedIp: string | null
  realIp: string | null
  message: string
}

/**
 * Compare a proxied exit IP with the user's real IP.
 *
 * Result semantics:
 * - `leak`     – proxiedIp === realIp ⇒ traffic bypassed the proxy.
 * - `safe`     – proxiedIp ≠ realIp and both are known.
 * - `unknown`  – one of the IPs could not be determined (e.g. ipify down).
 */
export async function detectIpLeak(proxiedIp: string | null): Promise<LeakReport> {
  const realIp = await getRealIp()

  if (!proxiedIp) {
    return { status: 'unknown', proxiedIp, realIp, message: 'Proxy did not return an IP — cannot evaluate leak' }
  }
  if (!realIp) {
    return { status: 'unknown', proxiedIp, realIp, message: 'Could not determine real IP — leak check skipped' }
  }
  if (proxiedIp === realIp) {
    return {
      status: 'leak',
      proxiedIp,
      realIp,
      message: `IP LEAK: proxy returned your real IP (${realIp}) — proxy may be dead or transparent`,
    }
  }
  return { status: 'safe', proxiedIp, realIp, message: `OK — exit IP ${proxiedIp} differs from real IP` }
}

/** Test-only helper to clear the real-IP cache between runs. */
export function _resetRealIpCacheForTests(): void {
  cachedRealIp = null
}
