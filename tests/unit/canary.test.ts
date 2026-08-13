/**
 * WAF canary — response classification and fingerprint-vs-IP attribution.
 *
 * The whole decision table runs against synthetic responses rather than by
 * provoking a real WAF, so the awkward cases (a challenge served with HTTP
 * 200, a dead proxy) are covered without depending on anyone's infrastructure.
 */
import { describe, it, expect } from 'vitest'
import {
  classifyCanaryResponse,
  canaryVector,
  type CanaryResponse,
  type CanaryVerdict
} from '../../src/main/detection/canary'
import { attributeVerdict, type CanaryRecord } from '../../src/main/detection/attribution'

const SENTINEL = 'shadowdesk-canary-ok'

const res = (over: Partial<CanaryResponse> = {}): CanaryResponse => ({
  status: 200,
  headers: {},
  finalUrl: 'https://canary.example.com/',
  body: `<html><body>${SENTINEL}</body></html>`,
  ...over
})

describe('canary classification', () => {
  it('passes a clean response carrying the sentinel', () => {
    const c = classifyCanaryResponse(res(), SENTINEL)
    expect(c.verdict).toBe('passed')
  })

  it('trusts the Cloudflare header over the status code', () => {
    // Cloudflare serves challenges with HTTP 200 and a plausible-looking body.
    const c = classifyCanaryResponse(
      res({ status: 200, headers: { 'cf-mitigated': 'challenge' } }),
      SENTINEL
    )
    expect(c.verdict).toBe('js-challenge')
    expect(c.detail).toContain('cf-mitigated')
  })

  it('ignores cf-mitigated: none', () => {
    expect(classifyCanaryResponse(res({ headers: { 'cf-mitigated': 'none' } }), SENTINEL).verdict)
      .toBe('passed')
  })

  it('recognises the Cloudflare challenge platform in the body', () => {
    const c = classifyCanaryResponse(
      res({ body: '<script src="/cdn-cgi/challenge-platform/h/b/orchestrate"></script>' }),
      SENTINEL
    )
    expect(c.verdict).toBe('js-challenge')
  })

  it('recognises a DataDome CAPTCHA redirect', () => {
    const c = classifyCanaryResponse(
      res({ finalUrl: 'https://geo.captcha-delivery.com/captcha/?initialCid=abc' }),
      SENTINEL
    )
    expect(c.verdict).toBe('captcha')
    expect(c.detail).toContain('DataDome')
  })

  it('recognises Imperva and Radware interstitials', () => {
    expect(
      classifyCanaryResponse(res({ body: '<iframe src="/_Incapsula_Resource?SWCGHOEL"></iframe>' }), SENTINEL).verdict
    ).toBe('js-challenge')
    expect(
      classifyCanaryResponse(res({ finalUrl: 'https://validate.perfdrive.com/?ssa=1' }), SENTINEL).verdict
    ).toBe('js-challenge')
  })

  it('reports a bare 403 as blocked', () => {
    const c = classifyCanaryResponse(res({ status: 403, body: 'Forbidden' }), SENTINEL)
    expect(c.verdict).toBe('blocked')
  })

  it('reports 429 as blocked and 503 as a challenge', () => {
    expect(classifyCanaryResponse(res({ status: 429, body: '' }), SENTINEL).verdict).toBe('blocked')
    expect(classifyCanaryResponse(res({ status: 503, body: '' }), SENTINEL).verdict).toBe('js-challenge')
  })

  it('catches a substituted page that still returns 200', () => {
    const c = classifyCanaryResponse(res({ body: '<html>Just a moment...</html>' }), SENTINEL)
    expect(c.verdict).toBe('js-challenge')
    expect(c.detail).toContain('sentinel is absent')
  })

  it('skips the sentinel check when none is configured', () => {
    expect(classifyCanaryResponse(res({ body: 'anything at all' }), '').verdict).toBe('passed')
  })

  it('treats a 404 as unreachable — a broken canary is not a verdict', () => {
    expect(classifyCanaryResponse(res({ status: 404, body: '' }), SENTINEL).verdict).toBe('unreachable')
  })
})

describe('canaryVector', () => {
  it('maps unreachable to unavailable so a dead canary costs nothing', () => {
    const v = canaryVector({ verdict: 'unreachable', detail: 'Canary not configured' })
    expect(v.status).toBe('unavailable')
    expect(v.passed).toBe(false)
  })

  it('marks a real mitigation fatal — it outranks every inference above it', () => {
    const v = canaryVector({ verdict: 'captcha', detail: 'DataDome CAPTCHA' })
    expect(v.severity).toBe('fatal')
    expect(v.status).toBe('fail')
    expect(v.source).toBe('canary')
  })

  it('appends the attribution when one was worked out', () => {
    const v = canaryVector({ verdict: 'blocked', detail: 'HTTP 403' }, 'the IP is the differing variable')
    expect(v.detail).toContain('the IP is the differing variable')
  })
})

// ── Attribution ──────────────────────────────────────────────────────────────

const rec = (
  profileId: string,
  proxyId: string | null,
  verdict: CanaryVerdict
): CanaryRecord => ({ profileId, proxyId, verdict, testedAt: '2026-08-13T00:00:00Z' })

describe('fingerprint-vs-IP attribution', () => {
  it('has nothing to attribute when the profile passed', () => {
    const a = attributeVerdict({ profileId: 'p1', proxyId: 'x1', verdict: 'passed' }, [])
    expect(a.suspect).toBe('inconclusive')
  })

  it('blames the fingerprint when the same proxy works for other profiles', () => {
    const a = attributeVerdict({ profileId: 'p1', proxyId: 'x1', verdict: 'blocked' }, [
      rec('p2', 'x1', 'passed'),
      rec('p3', 'x1', 'passed')
    ])
    expect(a.suspect).toBe('fingerprint')
    expect(a.summary).toContain('2 other profile')
  })

  it('blames the IP when the same profile works on other proxies', () => {
    const a = attributeVerdict({ profileId: 'p1', proxyId: 'x1', verdict: 'js-challenge' }, [
      rec('p1', 'x2', 'passed')
    ])
    expect(a.suspect).toBe('ip')
  })

  it('blames the pairing when each half works separately', () => {
    const a = attributeVerdict({ profileId: 'p1', proxyId: 'x1', verdict: 'captcha' }, [
      rec('p2', 'x1', 'passed'),
      rec('p1', 'x2', 'passed')
    ])
    expect(a.suspect).toBe('both')
    expect(a.summary).toContain('locale/timezone')
  })

  it('declines to guess with no passing comparison, and says what would settle it', () => {
    const a = attributeVerdict({ profileId: 'p1', proxyId: 'x1', verdict: 'blocked' }, [
      rec('p2', 'x1', 'blocked')
    ])
    expect(a.suspect).toBe('inconclusive')
    expect(a.summary).toContain('different proxy')
  })

  it('tells a direct-connection profile to assign a proxy first', () => {
    const a = attributeVerdict({ profileId: 'p1', proxyId: null, verdict: 'blocked' }, [])
    expect(a.summary).toContain('ran direct')
  })

  it('does not treat unreachable history as a passing comparison', () => {
    const a = attributeVerdict({ profileId: 'p1', proxyId: 'x1', verdict: 'blocked' }, [
      rec('p2', 'x1', 'unreachable'),
      rec('p1', 'x2', 'unreachable')
    ])
    expect(a.suspect).toBe('inconclusive')
  })

  it('ignores the profile own earlier runs on the same proxy', () => {
    // Same pair passing earlier says nothing about which half changed.
    const a = attributeVerdict({ profileId: 'p1', proxyId: 'x1', verdict: 'blocked' }, [
      rec('p1', 'x1', 'passed')
    ])
    expect(a.suspect).toBe('inconclusive')
  })
})
