/**
 * Phase 17.H — Platform-Specific Detection Hardening
 *
 * Pre-flight validator + live tuning engine.
 *
 *  1. Before a workflow runs, inspect the profile's behavior/timing config
 *     and compare it against platform-specific recommendations derived from
 *     the SEA_PLATFORMS catalog.  Issues are emitted via the `pre-flight-
 *     validation` workflow hook so the renderer can show a blocking card.
 *
 *  2. While the workflow runs, `analyzeRuntimeSignal()` listens for hints
 *     that the site is challenging the session (captchas, sliders, rate-
 *     limit errors, repeated selector misses) and returns a `LiveAdjustment
 *     Event` with a recommended fix.  The fix can be auto-applied via
 *     `applyFix()` or surfaced to the user as a toast.
 *
 * This module is pure / stateless — it reads from the DB and the static
 * SEA_PLATFORMS catalog, but never mutates anything directly.  Callers
 * (automation.ts) decide when to apply the suggested fixes.
 */

import type {
  AutomationStep,
  AutomationWorkflow,
  BehaviorConfig,
  BehaviorPresetId,
  FingerprintConfig,
  HardenerFix,
  HardenerIssue,
  HardenerSeverity,
  LiveAdjustmentEvent,
  PlatformTuningHint,
  PreFlightValidationResult,
  TimingConfig,
} from '../shared/types'
import { SEA_PLATFORMS } from './sea-platforms'
import { BEHAVIOR_PRESETS } from './fingerprint/behavior-presets'
import { Database } from './database'

// ──────────────────────────────────────────────────────────────────────────
//  Platform tuning catalog
// ──────────────────────────────────────────────────────────────────────────

/**
 * Per-platform overrides on top of the base behavior preset.  These values
 * are chosen from field experience against each platform's detection stack:
 *
 *  • Shopee   — SLARDAR analytics. Vary scroll inertia 30-50% (decay 0.78-
 *               0.88), moderate mouse jitter, typing 65-80 WPM with 25%
 *               variance so each session looks different from the last.
 *  • Lazada   — Akamai Bot Manager. Randomize typing cadence (variance 30%),
 *               heavier rAF jitter, strict timing clamp.
 *  • TikTokSh — msToken device fingerprinting. Heavy preset + mobile UA.
 *  • Tiki     — Light defence. Subtle preset is enough.
 *  • VNPay    — Do NOT automate OTP pages. Pre-flight blocks if a workflow
 *               looks like a payment flow.
 *  • Grab     — Mobile-only UX. Android/iOS preset required.
 */
interface PlatformProfile {
  platformId: string
  /** Base behavior preset we start from */
  basePreset: BehaviorPresetId
  /** Behavior-field overrides merged on top of the base preset */
  behaviorOverrides: Partial<BehaviorConfig>
  /** Timing-field overrides merged on top of the base preset */
  timingOverrides: Partial<TimingConfig>
  /** Free-form tips the UI renders as bullets */
  tips: string[]
  /** Short blurb rendered at the top of the validator card */
  summary: string
  /** Whether this platform should BLOCK automation entirely (e.g. VNPay OTP) */
  block?: boolean
  /** Human-readable reason for the block, if any */
  blockReason?: string
}

const PLATFORM_PROFILES: Record<string, PlatformProfile> = {
  shopee: {
    platformId: 'shopee',
    basePreset: 'heavy',
    behaviorOverrides: {
      mouseJitter: true,
      scrollInertia: true,
      typingNoise: true,
      mouseJitterIntensity: 'moderate',
      mouseJitterSigma: 0.55,
      // Vary scroll inertia 30-50% — seed picks a value inside this band
      scrollDecay: 0.83,
      scrollNoisePx: 3,
      typingWpm: 72,
      typingVariancePct: 25,
      typingHoldSigmaMs: 7,
    },
    timingOverrides: {
      dateNoisePrecision: 100,
      rafJitter: true,
      performanceClamp: true,
      rafJitterSigmaMs: 2.0,
      atomicsWaitNoise: true,
    },
    summary:
      'Shopee runs SLARDAR behaviour analytics — vary scroll inertia 30-50% and keep mouse jitter in the moderate band so each session fingerprints differently.',
    tips: [
      'Pair with a rotating residential proxy in the same country as the storefront',
      'Scroll slowly so lazy-loaded product tiles hydrate before scraping',
      'Avoid more than 2 login attempts per session — Shopee flips to CAPTCHA on the 3rd',
      'Use an Android preset (samsung / pixel) — SLARDAR trusts mobile UAs more',
    ],
  },
  lazada: {
    platformId: 'lazada',
    basePreset: 'heavy',
    behaviorOverrides: {
      mouseJitter: true,
      scrollInertia: true,
      typingNoise: true,
      mouseJitterIntensity: 'heavy',
      mouseJitterSigma: 0.8,
      scrollDecay: 0.82,
      scrollNoisePx: 4,
      // Lazada's slider CAPTCHA is triggered by uniform typing — randomize hard
      typingWpm: 65,
      typingVariancePct: 35,
      typingHoldSigmaMs: 9,
    },
    timingOverrides: {
      dateNoisePrecision: 100,
      rafJitter: true,
      performanceClamp: true,
      rafJitterSigmaMs: 2.5,
      atomicsWaitNoise: true,
    },
    summary:
      'Lazada uses Akamai Bot Manager. Randomize typing cadence (±35%) and keep mouse jitter at heavy so the slider CAPTCHA does not engage.',
    tips: [
      'Enable Phase 8 Chromium Layer 1 + Layer 4 patches — Akamai fingerprints TLS + canvas',
      'Preserve the _m_h5_tk cookie between steps — dropping it forces a reload',
      'A hoverJitter step on the product card helps before the slider is shown',
    ],
  },
  'tiktok-shop': {
    platformId: 'tiktok-shop',
    basePreset: 'stealth',
    behaviorOverrides: {
      mouseJitter: true,
      scrollInertia: true,
      typingNoise: true,
      mouseJitterIntensity: 'heavy',
      mouseJitterSigma: 1.0,
      scrollDecay: 0.8,
      scrollNoisePx: 4,
      typingWpm: 60,
      typingVariancePct: 40,
      typingHoldSigmaMs: 10,
    },
    timingOverrides: {
      dateNoisePrecision: 250,
      rafJitter: true,
      performanceClamp: true,
      rafJitterSigmaMs: 3.0,
      atomicsWaitNoise: true,
    },
    summary:
      'TikTok Shop generates msToken + s_v_web_id on every load — stealth-level timing defences are required so the token does not look replayed.',
    tips: [
      'Use an Android or iOS preset — desktop UAs are heavily weighted against',
      'Keep the proxy country aligned with the shop region (shop.tiktok.com/@vn needs VN exit)',
      'Never block websocket traffic — live-stream chat breaks the device challenge flow',
    ],
  },
  tiki: {
    platformId: 'tiki',
    basePreset: 'subtle',
    behaviorOverrides: {
      mouseJitter: true,
      scrollInertia: true,
      typingNoise: true,
      mouseJitterIntensity: 'subtle',
      mouseJitterSigma: 0.3,
      scrollDecay: 0.9,
      scrollNoisePx: 1.5,
      typingWpm: 85,
      typingVariancePct: 18,
      typingHoldSigmaMs: 4,
    },
    timingOverrides: {
      dateNoisePrecision: 50,
      rafJitter: true,
      performanceClamp: true,
      rafJitterSigmaMs: 1.0,
      atomicsWaitNoise: false,
    },
    summary:
      'Tiki has a light bot defence. Subtle preset is enough — cranking jitter up only slows scraping.',
    tips: [
      'Tiki exposes a GraphQL endpoint at /api/v2/products — prefer httpRequest for bulk data',
      'Prices are in VND with space separators — parse carefully',
    ],
  },
  vnpay: {
    platformId: 'vnpay',
    basePreset: 'balanced',
    behaviorOverrides: {},
    timingOverrides: {},
    summary:
      'VNPay checkout requires real OTPs from bank apps — this workflow cannot run end-to-end without a human in the loop.',
    tips: [
      'Use the sandbox at https://sandbox.vnpayment.vn for integration testing only',
      'Never run against pay.vnpay.vn with real cards in an automated context',
    ],
    block: true,
    blockReason:
      'VNPay checkout requires an OTP step that cannot be completed without a real phone — pre-flight blocks this workflow from auto-running.',
  },
  grab: {
    platformId: 'grab',
    basePreset: 'heavy',
    behaviorOverrides: {
      mouseJitter: true,
      scrollInertia: true,
      typingNoise: true,
      mouseJitterIntensity: 'heavy',
      mouseJitterSigma: 0.85,
      scrollDecay: 0.81,
      scrollNoisePx: 3.5,
      typingWpm: 62,
      typingVariancePct: 32,
      typingHoldSigmaMs: 9,
    },
    timingOverrides: {
      dateNoisePrecision: 100,
      rafJitter: true,
      performanceClamp: true,
      rafJitterSigmaMs: 2.2,
      atomicsWaitNoise: true,
    },
    summary:
      'Grab is mobile-only. Make sure the profile uses an Android or iOS preset — desktop UAs fall over on the restaurant browser page.',
    tips: [
      'Set a delivery location as the very first step — without it the restaurant grid never loads',
      'Phone OTP is required for GrabPay — not compatible with fully-automated runs',
    ],
  },
}

// Domain-keyword fallbacks used when the SEA_PLATFORMS regionUrls list does
// not cover a particular subdomain (e.g. seller.shopee.vn, live.tiktok.com).
const DOMAIN_KEYWORDS: Array<{ keyword: string; platformId: string }> = [
  { keyword: 'shopee.', platformId: 'shopee' },
  { keyword: 'lazada.', platformId: 'lazada' },
  { keyword: 'shop.tiktok.', platformId: 'tiktok-shop' },
  { keyword: 'tiktokshop.', platformId: 'tiktok-shop' },
  { keyword: 'tiki.vn', platformId: 'tiki' },
  { keyword: 'vnpay', platformId: 'vnpay' },
  { keyword: 'vnpayment', platformId: 'vnpay' },
  { keyword: 'food.grab.com', platformId: 'grab' },
  { keyword: 'grab.com', platformId: 'grab' },
]

// ──────────────────────────────────────────────────────────────────────────
//  URL → platform detection
// ──────────────────────────────────────────────────────────────────────────

export interface PlatformDetectionResult {
  platformId: string | null
  platformName: string | null
  region?: string
  matchedUrl?: string
}

/** Extract the first navigate-style URL from a workflow's steps. */
export function extractTargetUrl(steps: AutomationStep[]): string | undefined {
  for (const step of steps) {
    if (step.action === 'navigate' && typeof step.params?.url === 'string') {
      const url = step.params.url.trim()
      if (url) return url
    }
    if (step.action === 'httpRequest' && typeof step.params?.url === 'string') {
      return step.params.url.trim()
    }
  }
  return undefined
}

/** Detect which SEA platform a URL points to. Returns null on no match. */
export function detectPlatformFromUrl(url: string): PlatformDetectionResult {
  const none: PlatformDetectionResult = { platformId: null, platformName: null }
  if (!url) return none
  let host: string
  try {
    // Tolerate bare domains that were pasted without a scheme.
    const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`
    host = new URL(normalized).hostname.toLowerCase()
  } catch {
    return none
  }

  // First: exact base / region-URL match against the SEA_PLATFORMS catalog.
  for (const platform of SEA_PLATFORMS) {
    const candidates: Array<{ region?: string; url: string }> = [
      { url: platform.baseUrl },
      ...Object.entries(platform.regionUrls ?? {}).map(([region, url]) => ({ region, url })),
    ]
    for (const c of candidates) {
      try {
        const candidateHost = new URL(c.url).hostname.toLowerCase()
        if (host === candidateHost || host.endsWith('.' + candidateHost) || candidateHost.endsWith('.' + host)) {
          return {
            platformId: platform.id,
            platformName: platform.name,
            region: c.region,
            matchedUrl: c.url,
          }
        }
      } catch {
        /* ignore malformed catalog entry */
      }
    }
  }

  // Fallback: substring keyword scan (handles seller.shopee.vn etc.).
  for (const { keyword, platformId } of DOMAIN_KEYWORDS) {
    if (host.includes(keyword)) {
      const meta = SEA_PLATFORMS.find((p) => p.id === platformId)
      return {
        platformId,
        platformName: meta?.name ?? platformId,
      }
    }
  }

  return none
}

// ──────────────────────────────────────────────────────────────────────────
//  Build recommended BehaviorConfig + TimingConfig for a platform
// ──────────────────────────────────────────────────────────────────────────

function getBehaviorPreset(id: BehaviorPresetId) {
  return BEHAVIOR_PRESETS.find((p) => p.id === id) ?? BEHAVIOR_PRESETS.find((p) => p.id === 'balanced')!
}

/** Merge a base preset with per-platform overrides to produce a full
 *  BehaviorConfig + TimingConfig the renderer can apply one-click. */
export function buildTuningHint(platformId: string): PlatformTuningHint | null {
  const platformProfile = PLATFORM_PROFILES[platformId]
  if (!platformProfile) return null
  const platformMeta = SEA_PLATFORMS.find((p) => p.id === platformId)
  const preset = getBehaviorPreset(platformProfile.basePreset)

  const recommendedBehavior: BehaviorConfig = {
    ...preset.behavior,
    ...platformProfile.behaviorOverrides,
  }
  const recommendedTiming: TimingConfig = {
    ...preset.timing,
    ...platformProfile.timingOverrides,
  }

  return {
    platformId,
    platformName: platformMeta?.name ?? platformId,
    summary: platformProfile.summary,
    recommendedBehaviorPreset: platformProfile.basePreset,
    recommendedBehavior,
    recommendedTiming,
    recommendedFingerprintPresets: platformMeta?.recommendedPresets ?? [],
    tips: platformProfile.tips,
  }
}

export function getAllTuningHints(): PlatformTuningHint[] {
  return Object.keys(PLATFORM_PROFILES)
    .map((id) => buildTuningHint(id))
    .filter((h): h is PlatformTuningHint => h !== null)
}

// ──────────────────────────────────────────────────────────────────────────
//  Pre-flight validator
// ──────────────────────────────────────────────────────────────────────────

const SEVERITY_RANK: Record<HardenerSeverity, number> = { critical: 0, warning: 1, info: 2 }

function sortIssues(issues: HardenerIssue[]): HardenerIssue[] {
  return [...issues].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
}

function parseFingerprint(raw: string | null | undefined): FingerprintConfig | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as FingerprintConfig
  } catch {
    return null
  }
}

function isBehaviorBasicallyOff(b?: BehaviorConfig): boolean {
  if (!b) return true
  return !b.mouseJitter && !b.scrollInertia && !b.typingNoise
}

function isTimingWeak(t?: TimingConfig): boolean {
  if (!t) return true
  // Weak = no rAF jitter AND no performance clamp → trivially timing-fingerprintable
  return !t.rafJitter && !t.performanceClamp
}

/** Build a HardenerFix the renderer can one-click apply to align the profile
 *  with a platform's recommended settings. */
function buildFixForHint(hint: PlatformTuningHint): HardenerFix {
  return {
    label: `Apply ${hint.platformName} tuning (${hint.recommendedBehaviorPreset} preset)`,
    behavior: hint.recommendedBehavior,
    timing: hint.recommendedTiming,
    applyPreset: hint.recommendedBehaviorPreset,
  }
}

/**
 * Run the pre-flight validator synchronously against a workflow + profile.
 * Callers pass a workflow + the profile row they already have in memory so
 * we avoid a round-trip to the DB when automation.ts just loaded them.
 */
export function validatePreFlight(
  workflow: AutomationWorkflow,
  profileRow: { id: string; name?: string; fingerprint: string | null | undefined }
): PreFlightValidationResult {
  const issues: HardenerIssue[] = []

  const fingerprint = parseFingerprint(profileRow.fingerprint)
  const currentBehavior = fingerprint?.behavior
  const currentTiming = fingerprint?.timing

  const targetUrl = extractTargetUrl(workflow.steps)
  const detection = targetUrl ? detectPlatformFromUrl(targetUrl) : { platformId: null, platformName: null }
  const hint = detection.platformId ? buildTuningHint(detection.platformId) : null
  const tuningHint: PlatformTuningHint | null = hint
    ? { ...hint, detectedRegion: detection.region }
    : null

  // ── Step 1: Is behavior simulation enabled at all? ──────────────────────
  // This is the single most important gate — without it, no amount of
  // platform tuning will save you.  Always emitted as a warning; promoted
  // to critical when running against a high-risk platform.
  if (isBehaviorBasicallyOff(currentBehavior)) {
    const severity: HardenerSeverity = tuningHint ? 'critical' : 'warning'
    issues.push({
      code: 'behavior-disabled',
      severity,
      message:
        'Behaviour simulation is disabled on this profile. Enable mouse jitter, typing noise and scroll inertia before running.',
      detail:
        'Without these noise layers, every click/scroll/keystroke is event-identical and trivially bot-flaggable by SLARDAR / Akamai / msToken.',
      suggestedFix: tuningHint
        ? buildFixForHint(tuningHint)
        : {
            label: 'Apply the "balanced" behaviour preset',
            applyPreset: 'balanced',
          },
    })
  }

  // ── Step 2: Timing defences ─────────────────────────────────────────────
  if (isTimingWeak(currentTiming)) {
    issues.push({
      code: 'timing-weak',
      severity: 'warning',
      message:
        'Timing defences are off — rAF jitter + performance.now() clamping are recommended for modern detection stacks.',
      detail:
        'Detection scripts fingerprint a session by measuring the gap between requestAnimationFrame callbacks and performance.now() reads. Enable both for a quick safety win.',
      suggestedFix: tuningHint
        ? { label: 'Apply platform timing', timing: tuningHint.recommendedTiming }
        : {
            label: 'Enable rAF jitter + performance clamp',
            timing: {
              dateNoisePrecision: 100,
              rafJitter: true,
              performanceClamp: true,
              rafJitterSigmaMs: 1.2,
              atomicsWaitNoise: true,
            },
          },
    })
  }

  // ── Step 3: Platform-specific checks ────────────────────────────────────
  if (tuningHint && detection.platformId) {
    const platformProfile = PLATFORM_PROFILES[detection.platformId]

    // 3a. Hard block (VNPay OTP etc.)
    if (platformProfile?.block) {
      issues.push({
        code: 'platform-blocked',
        severity: 'critical',
        message: `${tuningHint.platformName} cannot be automated end-to-end`,
        detail: platformProfile.blockReason ?? 'This platform requires a human-in-the-loop step.',
      })
    }

    // 3b. Preset mismatch (e.g. desktop preset against mobile-only Grab)
    const currentPreset = fingerprint?.preset
    if (
      tuningHint.recommendedFingerprintPresets.length > 0 &&
      currentPreset &&
      !tuningHint.recommendedFingerprintPresets.includes(currentPreset)
    ) {
      issues.push({
        code: 'fingerprint-preset-mismatch',
        severity: 'warning',
        message: `Profile uses "${currentPreset}" — ${tuningHint.platformName} prefers ${tuningHint.recommendedFingerprintPresets
          .slice(0, 2)
          .join(' or ')}.`,
        detail:
          'Using the wrong OS/browser preset is the fastest way to get flagged. The platform catalog tracks which presets field-test well against each site.',
        suggestedFix: {
          label: `Switch to ${tuningHint.recommendedFingerprintPresets[0]}`,
          applyFingerprintPreset: tuningHint.recommendedFingerprintPresets[0],
        },
      })
    }

    // 3c. Scroll inertia variance check (Shopee 30-50% band)
    if (detection.platformId === 'shopee' && currentBehavior?.scrollInertia) {
      const decay = currentBehavior.scrollDecay ?? 0.88
      if (decay > 0.9) {
        issues.push({
          code: 'shopee-scroll-inertia-too-stiff',
          severity: 'warning',
          message: 'Shopee expects scroll inertia to vary 30-50% — current decay is too stiff.',
          detail:
            'A scrollDecay of >0.9 produces near-identical scroll curves every session. Shopee SLARDAR correlates this across visits.',
          suggestedFix: {
            label: 'Randomize Shopee scroll inertia',
            behavior: { scrollDecay: 0.83, scrollNoisePx: 3 },
          },
        })
      }
    }

    // 3d. Lazada typing variance check
    if (detection.platformId === 'lazada' && currentBehavior?.typingNoise) {
      const variance = currentBehavior.typingVariancePct ?? 20
      if (variance < 25) {
        issues.push({
          code: 'lazada-typing-too-uniform',
          severity: 'warning',
          message: `Lazada expects typing variance ≥25% — currently ${variance}%.`,
          detail:
            'Akamai Bot Manager measures keydown interval variance. Anything below 25% consistently triggers the slider CAPTCHA.',
          suggestedFix: {
            label: 'Randomize Lazada typing delays',
            behavior: { typingVariancePct: 35, typingHoldSigmaMs: 9 },
          },
        })
      }
    }

    // 3e. TikTok Shop + desktop preset = high risk
    if (detection.platformId === 'tiktok-shop' && currentPreset && !currentPreset.includes('android') && !currentPreset.includes('ios')) {
      issues.push({
        code: 'tiktok-shop-desktop-preset',
        severity: 'critical',
        message: 'TikTok Shop only trusts mobile UAs — desktop presets get msToken-flagged immediately.',
        detail:
          'shop.tiktok.com generates a device fingerprint (msToken) that is cross-checked against the UA class. Desktop UAs have ~0% trust score.',
        suggestedFix: {
          label: 'Switch to android-pixel-chrome121',
          applyFingerprintPreset: 'android-pixel-chrome121',
        },
      })
    }
  }

  // ── Step 4: Info-level tuning hint ─────────────────────────────────────
  if (tuningHint) {
    issues.push({
      code: 'platform-tuning-available',
      severity: 'info',
      message: `Platform-specific tuning is available for ${tuningHint.platformName}.`,
      detail: tuningHint.summary,
      suggestedFix: buildFixForHint(tuningHint),
    })
  }

  // ── Verdict ────────────────────────────────────────────────────────────
  const sorted = sortIssues(issues)
  let verdict: PreFlightValidationResult['verdict'] = 'ready'
  if (sorted.some((i) => i.severity === 'critical')) verdict = 'block'
  else if (sorted.some((i) => i.severity === 'warning')) verdict = 'warn'

  return {
    workflowId: workflow.id,
    profileId: profileRow.id,
    profileName: profileRow.name ?? profileRow.id,
    validatedAt: new Date().toISOString(),
    platform: tuningHint,
    targetUrl,
    verdict,
    issues: sorted,
    currentBehavior,
    currentTiming,
  }
}

/**
 * DB-backed variant — used by the IPC layer when the renderer only has the
 * workflowId + profileId.
 */
export function validatePreFlightById(
  workflowId: string,
  profileId: string
): PreFlightValidationResult {
  const db = Database.getInstance()
  const workflowRow: any = db.getWorkflow(workflowId)
  if (!workflowRow) {
    throw new Error(`Workflow ${workflowId} not found`)
  }
  const profileRow: any = db.getProfile(profileId)
  if (!profileRow) {
    throw new Error(`Profile ${profileId} not found`)
  }
  const workflow: AutomationWorkflow = {
    ...workflowRow,
    steps: typeof workflowRow.steps === 'string' ? JSON.parse(workflowRow.steps) : workflowRow.steps,
    variables:
      workflowRow.variables && typeof workflowRow.variables === 'string'
        ? JSON.parse(workflowRow.variables)
        : workflowRow.variables,
  }
  return validatePreFlight(workflow, {
    id: profileRow.id,
    name: profileRow.name,
    fingerprint: profileRow.fingerprint,
  })
}

// ──────────────────────────────────────────────────────────────────────────
//  Apply a fix to a profile fingerprint
// ──────────────────────────────────────────────────────────────────────────

/** Merge a HardenerFix into a fingerprint and return the patched object.
 *  This is pure — the caller decides whether to persist via profiles:update. */
export function applyFix(fp: FingerprintConfig, fix: HardenerFix): FingerprintConfig {
  const next: FingerprintConfig = { ...fp }

  if (fix.applyPreset) {
    const preset = BEHAVIOR_PRESETS.find((p) => p.id === fix.applyPreset)
    if (preset) {
      next.behavior = { ...(next.behavior ?? preset.behavior), ...preset.behavior }
      next.timing = { ...(next.timing ?? preset.timing), ...preset.timing }
    }
  }

  if (fix.behavior) {
    next.behavior = { ...(next.behavior ?? ({} as BehaviorConfig)), ...fix.behavior } as BehaviorConfig
  }
  if (fix.timing) {
    next.timing = { ...(next.timing ?? ({} as TimingConfig)), ...fix.timing } as TimingConfig
  }
  if (fix.applyFingerprintPreset) {
    next.preset = fix.applyFingerprintPreset
  }
  return next
}

// ──────────────────────────────────────────────────────────────────────────
//  Live adjustment — runtime challenge detection
// ──────────────────────────────────────────────────────────────────────────

/**
 * Runtime signal the caller hands us when something might indicate the
 * site is challenging the session.  We stay loose on shape on purpose so
 * this can be wired from multiple places (step errors, page eval results,
 * navigation events, etc).
 */
export interface RuntimeSignal {
  workflowId: string
  profileId: string
  /** Current URL when the signal fired (optional but very useful) */
  currentUrl?: string
  /** Free-form signal kind — `step-error` | `navigation` | `selector-miss` | `page-text` */
  kind: string
  /** The error message, DOM-text snippet, URL fragment, etc. */
  detail: string
}

/** Common challenge text / URL fragments we look for.  Order matters — the
 *  first match wins so more specific kinds are listed first. */
const CHALLENGE_PATTERNS: Array<{
  kind: string
  description: string
  regex: RegExp
}> = [
  {
    kind: 'captcha',
    description: 'Explicit CAPTCHA challenge detected on page',
    regex: /captcha|recaptcha|hcaptcha|geetest/i,
  },
  {
    kind: 'slider',
    description: 'Slider / puzzle verification flow triggered',
    regex: /slider|puzzle|drag.*verify|верификация/i,
  },
  {
    kind: 'rate-limit',
    description: 'Rate-limit / throttling response from the target',
    regex: /rate.?limit|too many requests|429|slow ?down/i,
  },
  {
    kind: 'blocked',
    description: 'Target returned a hard "access denied" response',
    regex: /access ?denied|forbidden|blocked|not authori[sz]ed/i,
  },
  {
    kind: 'selector-miss',
    description: 'Expected selector vanished — likely the page was re-rendered by bot-defence',
    regex: /waiting for selector|node is detached|selector.*failed/i,
  },
]

/**
 * Inspect a runtime signal and return an adjustment recommendation, or
 * null if nothing looks bot-related.  When a platform was detected from
 * the currentUrl we layer its tuning hint on top of the generic fix.
 */
export function analyzeRuntimeSignal(signal: RuntimeSignal): LiveAdjustmentEvent | null {
  const match = CHALLENGE_PATTERNS.find((p) => p.regex.test(signal.detail))
  if (!match) return null

  const detection = signal.currentUrl ? detectPlatformFromUrl(signal.currentUrl) : { platformId: null }
  const hint = detection.platformId ? buildTuningHint(detection.platformId) : null

  // Default escalation — step up to the next-heavier preset and widen typing
  // variance.  These values are deliberately conservative so auto-apply is safe.
  let suggestedFix: HardenerFix = {
    label: 'Escalate to heavy behaviour preset and widen typing variance',
    applyPreset: 'heavy',
    behavior: {
      typingVariancePct: 40,
      typingHoldSigmaMs: 10,
      mouseJitterIntensity: 'heavy',
      mouseJitterSigma: 0.9,
      scrollDecay: 0.8,
    },
    timing: {
      rafJitter: true,
      performanceClamp: true,
      rafJitterSigmaMs: 2.5,
      atomicsWaitNoise: true,
      dateNoisePrecision: 100,
    },
  }

  // Platform-specific escalation paths override the generic one.
  if (hint) {
    if (detection.platformId === 'shopee' && match.kind !== 'captcha') {
      suggestedFix = {
        label: 'Randomize Shopee scroll inertia and slow typing',
        behavior: {
          scrollDecay: 0.8,
          scrollNoisePx: 4,
          typingWpm: 65,
          typingVariancePct: 30,
        },
      }
    } else if (detection.platformId === 'lazada' && match.kind === 'slider') {
      suggestedFix = {
        label: 'Randomize Lazada typing delays to dodge slider CAPTCHA',
        behavior: {
          typingWpm: 60,
          typingVariancePct: 40,
          typingHoldSigmaMs: 11,
          mouseJitterSigma: 1.0,
        },
      }
    } else if (detection.platformId === 'tiktok-shop') {
      suggestedFix = buildFixForHint(hint)
    }
  }

  return {
    workflowId: signal.workflowId,
    profileId: signal.profileId,
    observedAt: new Date().toISOString(),
    challengeKind: match.kind,
    description: `${match.description} — ${signal.kind}: ${signal.detail.slice(0, 200)}`,
    suggestedFix,
    autoApplied: false,
  }
}
