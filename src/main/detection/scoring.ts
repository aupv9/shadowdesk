/**
 * Severity model and weighted scoring for detection reports.
 *
 * The previous scoring was `passedCount / vectors.length`, which gave
 * `navigator.plugins.length > 0` the same weight as a leaked
 * `navigator.webdriver`. A profile could fail the one vector that gets
 * accounts banned and still be labelled "passed" at 97/100.
 *
 * Severity lives in one name-keyed table rather than on each of the ~60 call
 * sites, so adding a vector is a one-line change and the whole risk model can
 * be reviewed on one screen.
 *
 * See docs/DETECTION_VALIDATION_DESIGN.md.
 */
import type {
  DetectionVectorResult,
  VectorSeverity,
  VectorSource,
  VectorStatus
} from '../../shared/types'

/** Relative weight of each severity in the weighted mean. */
const WEIGHT: Record<VectorSeverity, number> = {
  fatal: 10,
  high: 5,
  medium: 2,
  low: 1
}

/**
 * Hard automation tells. Any real anti-bot stack treats these as conclusive,
 * so one failure sinks the report no matter what else passes.
 */
const FATAL = [
  'navigator.webdriver',
  'Headless browser signals',
  'ChromeDriver variables',
  'Selenium / WebDriver artifacts',
  'Worker navigator.webdriver',
  'Function.toString masking',
  'Prototype chain integrity',
  'Object.defineProperty consistency',
  'Error stack traces'
]

/**
 * Correlation signals. Individually survivable, but a contradiction here is
 * what a fingerprinter scores you on.
 */
const HIGH = [
  'Canvas fingerprint',
  'WebGL vendor/renderer',
  'AudioContext',
  'Math FPU fingerprint',
  'WebRTC SDP fingerprint',
  'Screen dimensions consistency',
  'Viewport consistency',
  'devicePixelRatio consistency',
  'Timezone override',
  'Language consistency',
  'Intl locale consistency',
  'Accept-Language alignment',
  'UACH platform vs UA',
  'UACH brands list',
  'UA-CH platform alignment',
  'UA-CH mobile ↔ touch alignment',
  'UA ↔ UACH brands alignment',
  'UA ↔ binary version alignment',
  'Behavior consistency & drift risk',
  'Firefox UA consistency',
  'Firefox vendor string',
  'Safari UA format',
  'Safari vendor string',
  'Safari plugins (should be 0)',
  'Edge UA format',
  'Edge Chromium base',
  'Brave UA (Chromium)',
  'Brave Shields API'
]

/** Noticed by a fingerprinter, but not conclusive on its own. */
const MEDIUM = [
  'chrome.runtime exists',
  'chrome.app stub',
  'navigator.plugins',
  'Navigator properties',
  'Permissions API consistency',
  'CSS media query consistency',
  'Date.now() precision',
  'Performance entries',
  'Navigation Timing v2',
  'SpeechSynthesis consistency',
  'KeyboardEvent.key alignment',
  'Keyboard Layout API',
  'Battery API shape',
  'Network Information API',
  'Storage quota'
]

/**
 * Optional/modern API surface. Real browsers vary here too, so absence is weak
 * evidence at best.
 */
const LOW = [
  'WebGPU API presence',
  'MediaCapabilities API',
  'Private State Tokens API',
  'SharedArrayBuffer + Atomics',
  'WebAssembly support',
  'Service Worker API',
  'Notification.permission',
  'Document focus / visibility',
  'Intl.supportedValuesOf stability'
]

const SEVERITY_EXACT: Record<string, VectorSeverity> = {}
for (const n of FATAL) SEVERITY_EXACT[n] = 'fatal'
for (const n of HIGH) SEVERITY_EXACT[n] = 'high'
for (const n of MEDIUM) SEVERITY_EXACT[n] = 'medium'
for (const n of LOW) SEVERITY_EXACT[n] = 'low'

/** Vectors whose name embeds a runtime value, e.g. "Browser consistency (Edge)". */
const SEVERITY_PREFIX: Array<[string, VectorSeverity]> = [
  ['Browser consistency', 'high'],
  ['Coherence:', 'high'] // per-rule severity is set explicitly; this is the floor
]

/**
 * Severity for a vector name. Unknown names default to `medium` — high enough
 * that a newly added vector is not silently ignored, low enough that a
 * mislabelled one cannot fail a report on its own.
 */
export function severityFor(name: string): VectorSeverity {
  const exact = SEVERITY_EXACT[name]
  if (exact) return exact
  for (const [prefix, sev] of SEVERITY_PREFIX) {
    if (name.startsWith(prefix)) return sev
  }
  return 'medium'
}

/** Fills in the fields legacy vectors and older stored rows don't carry. */
export function normalizeVector(
  v: DetectionVectorResult,
  source: VectorSource = 'injection'
): Required<Pick<DetectionVectorResult, 'severity' | 'source' | 'status'>> & DetectionVectorResult {
  const status: VectorStatus = v.status ?? (v.passed ? 'pass' : 'fail')
  return {
    ...v,
    severity: v.severity ?? severityFor(v.name),
    source: v.source ?? source,
    status
  }
}

export interface ScoreBreakdown {
  /** Weighted 0–100. 100 when nothing could be scored. */
  score: number
  /** At least one fatal vector failed — overrides the arithmetic. */
  hasFatalFailure: boolean
  /** Vectors excluded from scoring because they could not run. */
  unavailableCount: number
  /** Vectors that did contribute. */
  countedCount: number
}

/**
 * Weighted mean over vectors that actually ran.
 *
 * `unavailable` vectors leave both numerator and denominator untouched: a
 * probe that fails to parse must not look like a profile that got caught.
 */
export function scoreVectors(vectors: DetectionVectorResult[]): ScoreBreakdown {
  const normalized = vectors.map((v) => normalizeVector(v))
  const counted = normalized.filter((v) => v.status !== 'unavailable')
  const unavailableCount = normalized.length - counted.length

  if (counted.length === 0) {
    return { score: 100, hasFatalFailure: false, unavailableCount, countedCount: 0 }
  }

  let total = 0
  let earned = 0
  let hasFatalFailure = false

  for (const v of counted) {
    const w = WEIGHT[v.severity]
    total += w
    if (v.status === 'pass') earned += w
    else if (v.severity === 'fatal') hasFatalFailure = true
  }

  return {
    score: Math.round((earned / total) * 100),
    hasFatalFailure,
    unavailableCount,
    countedCount: counted.length
  }
}

/**
 * Report status. A fatal failure is `failed` at any score — that is the whole
 * point of the severity model.
 */
export function statusFor(breakdown: ScoreBreakdown): 'passed' | 'warning' | 'failed' {
  if (breakdown.hasFatalFailure) return 'failed'
  if (breakdown.score >= 90) return 'passed'
  if (breakdown.score >= 70) return 'warning'
  return 'failed'
}

export interface SplitScores {
  /** Is the injection engine working on this profile? */
  injection: ScoreBreakdown
  /** Would a real site flag this profile? Undefined when no such vector ran. */
  risk?: ScoreBreakdown
}

/**
 * Splits one vector list into the two numbers the dashboard shows separately.
 *
 * Reporting a single figure is what made the old score misleading: users read
 * "did my overrides apply" as "am I undetectable".
 */
export function splitScores(vectors: DetectionVectorResult[]): SplitScores {
  const normalized = vectors.map((v) => normalizeVector(v))
  const injectionVectors = normalized.filter((v) => v.source === 'injection')
  const riskVectors = normalized.filter((v) => v.source !== 'injection')

  return {
    injection: scoreVectors(injectionVectors),
    risk: riskVectors.length > 0 ? scoreVectors(riskVectors) : undefined
  }
}
