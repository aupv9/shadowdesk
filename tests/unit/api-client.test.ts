/**
 * Unit tests for src/main/api-client.ts
 *
 * Tests:
 *  - decodeJwtExpiry: valid JWT, invalid JWT, malformed tokens
 *  - setApiKey / getApiKey: round-trip, clearing
 *  - loadTokens: returns null when no file exists
 *  - apiRequest: success, 429 retry, 401 refresh, rate limit exhaustion
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp'),
    getVersion: vi.fn(() => '1.0.0')
  }
}))

vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn(() => false)
}))

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeJwt(payload: object): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${header}.${body}.fake-sig`
}

function makeResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  const headersObj = new Headers(headers)
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : status === 429 ? 'Too Many Requests' : 'Error',
    headers: headersObj,
    json: vi.fn(async () => body),
    text: vi.fn(async () => JSON.stringify(body))
  } as unknown as Response
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('api-client — decodeJwtExpiry', () => {
  let decodeJwtExpiry: typeof import('../../src/main/api-client').decodeJwtExpiry

  beforeEach(async () => {
    vi.resetModules()
    const mod = await import('../../src/main/api-client')
    decodeJwtExpiry = mod.decodeJwtExpiry
  })

  it('returns exp from a valid JWT', () => {
    const token = makeJwt({ sub: 'user-1', exp: 1700000000 })
    expect(decodeJwtExpiry(token)).toBe(1700000000)
  })

  it('returns 0 for a JWT without exp claim', () => {
    const token = makeJwt({ sub: 'user-1' })
    expect(decodeJwtExpiry(token)).toBe(0)
  })

  it('returns 0 for a JWT with non-numeric exp', () => {
    const token = makeJwt({ exp: 'not-a-number' })
    expect(decodeJwtExpiry(token)).toBe(0)
  })

  it('returns 0 for a token with fewer than 3 parts', () => {
    expect(decodeJwtExpiry('only-one-part')).toBe(0)
    expect(decodeJwtExpiry('two.parts')).toBe(0)
  })

  it('returns 0 for an empty string', () => {
    expect(decodeJwtExpiry('')).toBe(0)
  })

  it('returns 0 for a token with invalid base64 payload', () => {
    expect(decodeJwtExpiry('header.!!!invalid-base64!!!.sig')).toBe(0)
  })

  it('handles exp value of 0 correctly', () => {
    const token = makeJwt({ exp: 0 })
    expect(decodeJwtExpiry(token)).toBe(0)
  })

  it('handles large exp values (far future)', () => {
    const farFuture = 9999999999
    const token = makeJwt({ exp: farFuture })
    expect(decodeJwtExpiry(token)).toBe(farFuture)
  })
})

describe('api-client — setApiKey / getApiKey', () => {
  let setApiKey: typeof import('../../src/main/api-client').setApiKey
  let getApiKey: typeof import('../../src/main/api-client').getApiKey

  beforeEach(async () => {
    vi.resetModules()
    const mod = await import('../../src/main/api-client')
    setApiKey = mod.setApiKey
    getApiKey = mod.getApiKey
  })

  it('round-trip: set then get returns the key', () => {
    setApiKey('my-secret-api-key')
    expect(getApiKey()).toBe('my-secret-api-key')
  })

  it('set to null clears the key', () => {
    setApiKey('some-key')
    expect(getApiKey()).toBe('some-key')
    setApiKey(null)
    expect(getApiKey()).toBeNull()
  })

  it('getApiKey returns null by default', () => {
    expect(getApiKey()).toBeNull()
  })
})

describe('api-client — loadTokens', () => {
  it('returns null when no token file exists', async () => {
    vi.resetModules()
    const mod = await import('../../src/main/api-client')
    const result = mod.loadTokens()
    expect(result).toBeNull()
  })
})

describe('api-client — apiRequest', () => {
  let apiRequest: typeof import('../../src/main/api-client').apiRequest
  let setApiKey: typeof import('../../src/main/api-client').setApiKey
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    vi.resetModules()
    fetchMock = vi.fn()
    global.fetch = fetchMock

    const mod = await import('../../src/main/api-client')
    apiRequest = mod.apiRequest
    setApiKey = mod.setApiKey

    // Use API key auth to avoid token expiry checks
    setApiKey('test-api-key')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('successful 200 response returns parsed JSON', async () => {
    const responseData = { id: 'profile-1', name: 'Test Profile' }
    fetchMock.mockResolvedValueOnce(makeResponse(200, responseData))

    const result = await apiRequest<{ id: string; name: string }>('/profiles/1')

    expect(result).toEqual(responseData)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toContain('/profiles/1')
    expect(opts.method).toBe('GET')
    expect(opts.headers['X-API-Key']).toBe('test-api-key')
  })

  it('sends POST body as JSON', async () => {
    const body = { name: 'New Profile' }
    fetchMock.mockResolvedValueOnce(makeResponse(200, { id: 'p1' }))

    await apiRequest('/profiles', { method: 'POST', body })

    const [, opts] = fetchMock.mock.calls[0]
    expect(opts.method).toBe('POST')
    expect(opts.body).toBe(JSON.stringify(body))
    expect(opts.headers['Content-Type']).toBe('application/json')
  })

  it('429 status triggers retry with Retry-After header', async () => {
    // First call: 429 with Retry-After: 0 (to avoid test delay)
    fetchMock
      .mockResolvedValueOnce(makeResponse(429, {}, { 'Retry-After': '0' }))
      .mockResolvedValueOnce(makeResponse(200, { success: true }))

    const result = await apiRequest<{ success: boolean }>('/test')

    expect(result).toEqual({ success: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('rate limit exhaustion after MAX_RATE_LIMIT_RETRIES throws RATE_LIMIT error', async () => {
    // Return 429 for every attempt (initial + 3 retries = 4 calls)
    const retryResponse = makeResponse(429, {}, { 'Retry-After': '0' })
    fetchMock
      .mockResolvedValueOnce(retryResponse)
      .mockResolvedValueOnce(makeResponse(429, {}, { 'Retry-After': '0' }))
      .mockResolvedValueOnce(makeResponse(429, {}, { 'Retry-After': '0' }))
      .mockResolvedValueOnce(makeResponse(429, {}, { 'Retry-After': '0' }))

    await expect(apiRequest('/test')).rejects.toThrow(/RATE_LIMIT/)
  })

  it('401 with API key throws AUTH_EXPIRED (no refresh attempt)', async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(401, { error: 'unauthorized' }))

    await expect(apiRequest('/test')).rejects.toThrow('AUTH_EXPIRED')
  })

  it('non-ok response throws with server error message', async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse(400, { error: 'INVALID_INPUT', message: 'Name is required', code: 400 })
    )

    await expect(apiRequest('/profiles')).rejects.toThrow('Name is required')
  })

  it('204 No Content returns undefined', async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(204, null))

    const result = await apiRequest<void>('/profiles/1', { method: 'DELETE' })
    expect(result).toBeUndefined()
  })

  it('includes X-App-Version header', async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(200, {}))

    await apiRequest('/test')

    const [, opts] = fetchMock.mock.calls[0]
    expect(opts.headers['X-App-Version']).toBe('1.0.0')
  })

  it('unauthenticated request omits auth headers', async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(200, { public: true }))

    await apiRequest('/public', { authenticated: false })

    const [, opts] = fetchMock.mock.calls[0]
    expect(opts.headers['Authorization']).toBeUndefined()
    expect(opts.headers['X-API-Key']).toBeUndefined()
  })
})
