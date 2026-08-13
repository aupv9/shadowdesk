/**
 * WAF canary — Layer 3 of the detection validation design.
 *
 * Layers 0 and 1 reason about the fingerprint. This layer asks the only
 * question that settles the matter: does a production bot-mitigation system
 * challenge this profile? The answer is a fact about a moment in time, through
 * one IP, not a promise about any site.
 *
 * The canary must be an endpoint the operator owns — typically a static page
 * behind Cloudflare Bot Fight Mode. No third-party URL is shipped as a default:
 * probing someone else's WAF to grade our own product is both unreliable and
 * not ours to do.
 *
 * The request is driven through the profile's own browser so the real
 * fingerprint, real TLS stack and real proxy are all in play. A bare HTTP
 * request would exercise none of them.
 *
 * See docs/DETECTION_VALIDATION_DESIGN.md.
 */
import type { Page } from 'puppeteer-core'
import type { DetectionVectorResult } from '../../shared/types'

export type CanaryVerdict =
  /** Served the real page — no mitigation triggered. */
  | 'passed'
  /** Interstitial JS challenge (Cloudflare "checking your browser", etc). */
  | 'js-challenge'
  /** Escalated to an interactive CAPTCHA. */
  | 'captcha'
  /** Refused outright. */
  | 'blocked'
  /** Could not reach the canary — says nothing about the profile. */
  | 'unreachable'

/** The parts of a response the classifier looks at. */
export interface CanaryResponse {
  status: number
  /** Lower-cased header names. */
  headers: Record<string, string>
  /** Final URL after any redirects. */
  finalUrl: string
  /** Enough of the body to spot an interstitial. */
  body: string
}

export interface CanaryClassification {
  verdict: CanaryVerdict
  /** Human-readable reason, shown verbatim in the report. */
  detail: string
}

/** Hosts that only appear when a specific vendor has intercepted the request. */
const VENDOR_INTERSTITIALS: Array<[RegExp, CanaryVerdict, string]> = [
  [/captcha-delivery\.com/i, 'captcha', 'DataDome CAPTCHA'],
  [/geo\.captcha-delivery\.com/i, 'captcha', 'DataDome CAPTCHA'],
  [/challenges\.cloudflare\.com/i, 'js-challenge', 'Cloudflare Turnstile'],
  [/\/cdn-cgi\/challenge-platform/i, 'js-challenge', 'Cloudflare challenge platform'],
  [/px-captcha|_px[A-Za-z]*Captcha/i, 'captcha', 'PerimeterX CAPTCHA'],
  [/\/_Incapsula_Resource/i, 'js-challenge', 'Imperva/Incapsula challenge'],
  [/validate\.perfdrive\.com/i, 'js-challenge', 'Radware Bot Manager']
]

/**
 * Classifies one canary response.
 *
 * Pure, so the whole decision table is exercised in unit tests against
 * synthetic responses rather than by provoking a real WAF.
 *
 * Order matters: an explicit vendor signal beats a status code, because a
 * challenge page is frequently served with HTTP 200.
 */
export function classifyCanaryResponse(
  res: CanaryResponse,
  sentinel: string
): CanaryClassification {
  const haystack = `${res.finalUrl}\n${res.body}`

  // Cloudflare states its own action in a header — the least ambiguous signal
  // available, and it is present even when the body looks like a normal page.
  const mitigated = res.headers['cf-mitigated']
  if (mitigated && mitigated.toLowerCase() !== 'none') {
    return { verdict: 'js-challenge', detail: `Cloudflare cf-mitigated: ${mitigated}` }
  }

  for (const [pattern, verdict, label] of VENDOR_INTERSTITIALS) {
    if (pattern.test(haystack)) {
      return { verdict, detail: `${label} intercepted the request` }
    }
  }

  // 403/429 without a vendor marker: refused, vendor unknown.
  if (res.status === 403 || res.status === 429) {
    return { verdict: 'blocked', detail: `HTTP ${res.status} with no vendor marker` }
  }
  if (res.status === 503) {
    return { verdict: 'js-challenge', detail: 'HTTP 503 — typical of an interstitial' }
  }
  if (res.status >= 400) {
    return { verdict: 'unreachable', detail: `HTTP ${res.status} from the canary` }
  }

  // A 200 is only a pass if the page is actually ours. Without the sentinel we
  // may be looking at a challenge page that happens to return 200.
  if (sentinel && !res.body.includes(sentinel)) {
    return {
      verdict: 'js-challenge',
      detail: `HTTP ${res.status} but the canary sentinel is absent — page was substituted`
    }
  }

  return { verdict: 'passed', detail: `HTTP ${res.status}, canary content served intact` }
}

export interface CanaryConfig {
  enabled: boolean
  /** Operator-owned endpoint. Empty = not configured. */
  url: string
  /** A string that appears only on the genuine canary page. */
  sentinel: string
}

/** How long to give the canary before calling it unreachable. */
const CANARY_TIMEOUT_MS = 20000

/** Body prefix we keep — enough to spot an interstitial, small enough to store. */
const BODY_SNIPPET_LIMIT = 4000

/**
 * Loads the canary through the profile's browser and classifies what came back.
 *
 * Any navigation error is `unreachable`, never `blocked`: a DNS failure or a
 * dead proxy is our problem, not a verdict on the profile.
 */
export async function runCanary(page: Page, config: CanaryConfig): Promise<CanaryClassification> {
  if (!config.enabled) {
    return { verdict: 'unreachable', detail: 'Canary disabled in settings' }
  }
  if (!config.url) {
    return { verdict: 'unreachable', detail: 'No canary URL configured' }
  }

  try {
    const response = await page.goto(config.url, {
      timeout: CANARY_TIMEOUT_MS,
      waitUntil: 'domcontentloaded'
    })
    if (!response) {
      return { verdict: 'unreachable', detail: 'No response from the canary' }
    }

    const rawHeaders = response.headers()
    const headers: Record<string, string> = {}
    for (const [k, v] of Object.entries(rawHeaders)) headers[k.toLowerCase()] = String(v)

    // Read the rendered DOM rather than the raw body: a JS challenge rewrites
    // the document, and the sentinel check has to see what the page became.
    const body = await page
      .evaluate(() => document.documentElement.outerHTML)
      .catch(() => '')

    return classifyCanaryResponse(
      {
        status: response.status(),
        headers,
        finalUrl: page.url(),
        body: body.slice(0, BODY_SNIPPET_LIMIT)
      },
      config.sentinel
    )
  } catch (e: any) {
    return { verdict: 'unreachable', detail: `Navigation failed: ${e?.message ?? String(e)}` }
  }
}

/**
 * Turns a verdict into a detection vector.
 *
 * `unreachable` maps to `unavailable` so a dead canary never counts against a
 * profile — the same contract every other layer honours.
 */
export function canaryVector(
  classification: CanaryClassification,
  attribution?: string
): DetectionVectorResult {
  const { verdict, detail } = classification
  const suffix = attribution ? ` — ${attribution}` : ''

  return {
    name: 'Canary: live WAF verdict',
    category: 'Network',
    passed: verdict === 'passed',
    // A real WAF challenging this profile is the strongest negative signal the
    // product can produce, so it outranks every inference above it.
    severity: 'fatal',
    source: 'canary',
    status: verdict === 'unreachable' ? 'unavailable' : verdict === 'passed' ? 'pass' : 'fail',
    detail: `${verdict}: ${detail}${suffix}`
  }
}
