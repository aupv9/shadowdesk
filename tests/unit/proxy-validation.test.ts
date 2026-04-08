/**
 * Unit tests for proxy input validation + TCP handshake reachability check.
 *
 * The IP-leak detection helper is exercised by an integration test rather
 * than mocked here — it depends on a remote IP echo service.
 */

import { describe, it, expect } from 'vitest'
import { createServer } from 'net'
import {
  validateProxyInput,
  tcpHandshake,
} from '../../src/main/proxy/validation'

describe('validateProxyInput', () => {
  it('accepts a well-formed HTTP proxy', () => {
    expect(validateProxyInput({ type: 'http', host: 'proxy.example.com', port: 8080 })).toBeNull()
  })

  it('accepts an IPv4 SOCKS5 proxy', () => {
    expect(validateProxyInput({ type: 'socks5', host: '192.168.1.1', port: 1080 })).toBeNull()
  })

  it('rejects an unknown proxy type', () => {
    const err = validateProxyInput({ type: 'ftp', host: 'a.b', port: 21 } as any)
    expect(err).not.toBeNull()
    expect(err!.field).toBe('type')
  })

  it('rejects a missing host', () => {
    const err = validateProxyInput({ type: 'http', host: '', port: 80 })
    expect(err).not.toBeNull()
    expect(err!.field).toBe('host')
  })

  it('rejects a host with path-traversal characters', () => {
    const err = validateProxyInput({ type: 'http', host: '../../etc/passwd', port: 80 })
    expect(err).not.toBeNull()
    expect(err!.field).toBe('host')
  })

  it('rejects a host with a slash', () => {
    const err = validateProxyInput({ type: 'http', host: 'example.com/admin', port: 80 })
    expect(err).not.toBeNull()
    expect(err!.field).toBe('host')
  })

  it('rejects a host with shell metacharacters', () => {
    const err = validateProxyInput({ type: 'http', host: 'a.com;rm -rf /', port: 80 })
    expect(err).not.toBeNull()
    expect(err!.field).toBe('host')
  })

  it('rejects a host that is too long', () => {
    const err = validateProxyInput({ type: 'http', host: 'a'.repeat(300), port: 80 })
    expect(err).not.toBeNull()
    expect(err!.field).toBe('host')
  })

  it('rejects port 0', () => {
    const err = validateProxyInput({ type: 'http', host: 'a.com', port: 0 })
    expect(err).not.toBeNull()
    expect(err!.field).toBe('port')
  })

  it('rejects port > 65535', () => {
    const err = validateProxyInput({ type: 'http', host: 'a.com', port: 70000 })
    expect(err).not.toBeNull()
    expect(err!.field).toBe('port')
  })

  it('rejects non-integer ports', () => {
    const err = validateProxyInput({ type: 'http', host: 'a.com', port: 80.5 })
    expect(err).not.toBeNull()
    expect(err!.field).toBe('port')
  })
})

describe('tcpHandshake', () => {
  it('succeeds against a real listening TCP socket', async () => {
    // Spin up an ephemeral TCP server on localhost
    const server = createServer()
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
    const port = (server.address() as any).port

    try {
      const result = await tcpHandshake('127.0.0.1', port, 2000)
      expect(result.ok).toBe(true)
      expect(result.latency_ms).toBeGreaterThanOrEqual(0)
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })

  it('fails on a closed port', async () => {
    // Pick a port that's almost certainly closed (high random port)
    const result = await tcpHandshake('127.0.0.1', 1, 1000)
    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('times out on an unroutable address', async () => {
    // 192.0.2.0/24 is RFC 5737 reserved (TEST-NET-1) — guaranteed unroutable
    const result = await tcpHandshake('192.0.2.1', 80, 500)
    expect(result.ok).toBe(false)
  }, 2000)
})
