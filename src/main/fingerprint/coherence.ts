/**
 * Coherence engine — Layer 1 of the detection validation design.
 *
 * The existing vector suite asks whether our overrides applied. Real anti-bot
 * systems rarely act on a single bad value; they act on two values that
 * contradict each other. A profile advertising Windows while WebGL reports an
 * Apple GPU passes every layer-0 vector and gets banned anyway.
 *
 * Every rule here is a pure function over a `CoherenceContext`, so the whole
 * rule set unit-tests without launching a browser: build a deliberately
 * contradictory context and assert the rule fires. Collecting the context is
 * the only part that needs a page.
 *
 * See docs/DETECTION_VALIDATION_DESIGN.md for the rule table (R1–R14).
 */
import type {
  DetectionVectorResult,
  FingerprintConfig,
  VectorSeverity
} from '../../shared/types'

// ── Context ──────────────────────────────────────────────────────────────────

/** Values read out of one JS realm (main thread, worker, or iframe). */
export interface RealmSnapshot {
  userAgent: string
  platform: string
  languages: string[]
  hardwareConcurrency: number
  deviceMemory?: number
}

/** Everything only the main thread can report. */
export interface MainSnapshot extends RealmSnapshot {
  language: string
  timeZone: string
  uachPlatform?: string
  uaBrands?: Array<{ brand: string; version: string }>
  webglVendor?: string
  webglRenderer?: string
  maxTouchPoints: number
  hasTouchStart: boolean
  pointerCoarse: boolean
  screen: {
    width: number
    height: number
    availWidth: number
    availHeight: number
    pixelRatio: number
  }
}

export interface RenderHashes {
  canvas: string
  webgl: string
  audio: string
}

export interface ProxyGeo {
  ip: string
  countryCode?: string
  timezone?: string
}

export interface CoherenceContext {
  /** D — what the profile claims to be. */
  declared: FingerprintConfig
  /** M — what the main thread actually reports. */
  main: MainSnapshot
  /** W — worker realm. Null when the worker could not be created. */
  worker: RealmSnapshot | null
  /** F — same-origin iframe realm. Null when it could not be created. */
  iframe: RealmSnapshot | null
  /** P — geo of the proxy in use. Null when the profile runs direct. */
  proxy: ProxyGeo | null
  /** Hashes rendered during this run. */
  render: RenderHashes
  /** Hashes recorded on a previous run of this profile, for R11. */
  baseline: RenderHashes | null
  /** Other profiles' recorded hashes, for R12. */
  otherProfiles: Array<{ profileId: string; hashes: RenderHashes }>
  /** Public IPs surfaced by ICE candidate gathering. */
  webrtcPublicIps: string[]
  /** Real Chromium major version of the launched binary. */
  binaryMajor?: number
}

// ── Rule plumbing ────────────────────────────────────────────────────────────

export type RuleOutcome =
  | { status: 'pass'; detail: string }
  | { status: 'fail'; detail: string }
  /** The inputs this rule needs were not available — never counts against a score. */
  | { status: 'unavailable'; detail: string }

export interface CoherenceRule {
  id: string
  name: string
  category: string
  severity: VectorSeverity
  evaluate(ctx: CoherenceContext): RuleOutcome
}

// ── Shared helpers ───────────────────────────────────────────────────────────

export type OsFamily = 'Windows' | 'macOS' | 'Linux' | 'Android' | 'iOS' | 'unknown'

/** OS implied by a User-Agent string. Android is checked before Linux — every
 *  Android UA also contains "Linux". */
export function osFromUserAgent(ua: string): OsFamily {
  if (/Android/i.test(ua)) return 'Android'
  if (/(iPhone|iPad|iPod)/i.test(ua)) return 'iOS'
  if (/Windows NT/i.test(ua)) return 'Windows'
  if (/Mac OS X/i.test(ua)) return 'macOS'
  if (/Linux|X11/i.test(ua)) return 'Linux'
  return 'unknown'
}

/** OS implied by `navigator.platform`. */
export function osFromPlatform(platform: string): OsFamily {
  switch (platform) {
    case 'Win32':
    case 'Win64':
      return 'Windows'
    case 'MacIntel':
      return 'macOS'
    case 'Linux x86_64':
    case 'Linux i686':
      return 'Linux'
    case 'Linux armv8l':
    case 'Linux aarch64':
      return 'Android'
    case 'iPhone':
    case 'iPad':
      return 'iOS'
    default:
      return 'unknown'
  }
}

/** OS implied by the UA-CH `platform` hint. */
export function osFromUachPlatform(p: string | undefined): OsFamily {
  if (!p) return 'unknown'
  const map: Record<string, OsFamily> = {
    Windows: 'Windows',
    macOS: 'macOS',
    Linux: 'Linux',
    Android: 'Android',
    iOS: 'iOS'
  }
  return map[p] ?? 'unknown'
}

/**
 * OS families a GPU renderer string is consistent with.
 *
 * Returns an empty array when the string carries no OS signal, so an
 * unrecognised GPU never fails the rule.
 */
export function osFromRenderer(renderer: string | undefined): OsFamily[] {
  if (!renderer) return []
  const r = renderer.toLowerCase()

  // Apple silicon / Apple GPU strings appear on macOS and iOS only.
  if (/\bapple\b/.test(r)) return ['macOS', 'iOS']
  // ANGLE's Direct3D backend exists only on Windows.
  if (/direct3d|d3d11|d3d9/.test(r)) return ['Windows']
  // Mobile GPU vendors.
  if (/adreno|mali|powervr|xclipse/.test(r)) return ['Android']
  // Mesa / software rasterisers are Linux-side (also Android, but the mobile
  // GPU check above catches those first).
  if (/mesa|llvmpipe|swiftshader|gallium/.test(r)) return ['Linux']
  return []
}

/** Chrome major version from a UA string, if present. */
export function chromeMajorFromUa(ua: string): number | null {
  const m = /Chrome\/(\d+)/.exec(ua)
  return m ? Number(m[1]) : null
}

function realmDiff(a: RealmSnapshot, b: RealmSnapshot): string[] {
  const diffs: string[] = []
  if (a.userAgent !== b.userAgent) diffs.push('userAgent')
  if (a.platform !== b.platform) diffs.push('platform')
  if (a.hardwareConcurrency !== b.hardwareConcurrency) diffs.push('hardwareConcurrency')
  if ((a.deviceMemory ?? null) !== (b.deviceMemory ?? null)) diffs.push('deviceMemory')
  if (a.languages.join(',') !== b.languages.join(',')) diffs.push('languages')
  return diffs
}

/** Two IANA zones are compatible if equal, or share a region when one is coarse. */
function zonesAgree(a: string, b: string): boolean {
  if (!a || !b) return true
  if (a === b) return true
  // ip-api often returns a representative zone for the region rather than the
  // exact one — "Asia/Saigon" vs "Asia/Ho_Chi_Minh". Compare the region only.
  return a.split('/')[0] === b.split('/')[0]
}

const MOBILE: OsFamily[] = ['Android', 'iOS']

// ── Rules ────────────────────────────────────────────────────────────────────

/** R1 — UA, navigator.platform and UA-CH platform must name the same OS. */
const r1PlatformTriad: CoherenceRule = {
  id: 'R1',
  name: 'Coherence: OS agreement across UA, platform and UA-CH',
  category: 'Locale',
  severity: 'fatal',
  evaluate(ctx) {
    const fromUa = osFromUserAgent(ctx.main.userAgent)
    const fromPlatform = osFromPlatform(ctx.main.platform)
    const fromUach = osFromUachPlatform(ctx.main.uachPlatform)

    const seen = [
      ['UA', fromUa],
      ['navigator.platform', fromPlatform],
      ['UA-CH platform', fromUach]
    ].filter(([, os]) => os !== 'unknown') as Array<[string, OsFamily]>

    if (seen.length < 2) {
      return { status: 'unavailable', detail: 'Fewer than two sources reported an OS' }
    }

    const distinct = [...new Set(seen.map(([, os]) => os))]
    if (distinct.length > 1) {
      return {
        status: 'fail',
        detail: `Contradiction — ${seen.map(([src, os]) => `${src}=${os}`).join(', ')}`
      }
    }
    return { status: 'pass', detail: `All sources agree on ${distinct[0]}` }
  }
}

/** R2 — the GPU string must be possible on the OS the UA claims. */
const r2GpuOsCoherence: CoherenceRule = {
  id: 'R2',
  name: 'Coherence: WebGL renderer vs claimed OS',
  category: 'Graphics',
  severity: 'fatal',
  evaluate(ctx) {
    const uaOs = osFromUserAgent(ctx.main.userAgent)
    const rendererOs = osFromRenderer(ctx.main.webglRenderer)

    if (uaOs === 'unknown') return { status: 'unavailable', detail: 'OS not derivable from UA' }
    if (rendererOs.length === 0) {
      return { status: 'unavailable', detail: `Renderer carries no OS signal: ${ctx.main.webglRenderer ?? 'none'}` }
    }
    if (!rendererOs.includes(uaOs)) {
      return {
        status: 'fail',
        detail: `UA claims ${uaOs} but renderer "${ctx.main.webglRenderer}" implies ${rendererOs.join('/')}`
      }
    }
    return { status: 'pass', detail: `Renderer consistent with ${uaOs}` }
  }
}

/** R3 — the worker realm must report the same identity as the main thread. */
const r3WorkerParity: CoherenceRule = {
  id: 'R3',
  name: 'Coherence: worker realm matches main thread',
  category: 'Automation',
  severity: 'fatal',
  evaluate(ctx) {
    if (!ctx.worker) return { status: 'unavailable', detail: 'Worker realm unavailable' }
    const diffs = realmDiff(ctx.main, ctx.worker)
    if (diffs.length > 0) {
      return { status: 'fail', detail: `Worker diverges on: ${diffs.join(', ')}` }
    }
    return { status: 'pass', detail: 'Worker identity matches main thread' }
  }
}

/** R4 — same for a same-origin iframe, the other classic override gap. */
const r4IframeParity: CoherenceRule = {
  id: 'R4',
  name: 'Coherence: iframe realm matches main thread',
  category: 'Automation',
  severity: 'fatal',
  evaluate(ctx) {
    if (!ctx.iframe) return { status: 'unavailable', detail: 'Iframe realm unavailable' }
    const diffs = realmDiff(ctx.main, ctx.iframe)
    if (diffs.length > 0) {
      return { status: 'fail', detail: `Iframe diverges on: ${diffs.join(', ')}` }
    }
    return { status: 'pass', detail: 'Iframe identity matches main thread' }
  }
}

/** R5 — WebRTC must not surface a public IP other than the proxy's. */
const r5WebrtcLeak: CoherenceRule = {
  id: 'R5',
  name: 'Coherence: WebRTC does not leak a non-proxy IP',
  category: 'Network',
  severity: 'fatal',
  evaluate(ctx) {
    if (!ctx.proxy) return { status: 'unavailable', detail: 'No proxy in use — nothing to leak past' }
    const leaked = ctx.webrtcPublicIps.filter((ip) => ip !== ctx.proxy!.ip)
    if (leaked.length > 0) {
      return { status: 'fail', detail: `WebRTC exposed ${leaked.join(', ')} alongside proxy ${ctx.proxy.ip}` }
    }
    return { status: 'pass', detail: 'No public IP beyond the proxy' }
  }
}

/** R6 — declared timezone, live Intl zone and the proxy's geo must agree. */
const r6Timezone: CoherenceRule = {
  id: 'R6',
  name: 'Coherence: timezone vs Intl vs proxy geo-IP',
  category: 'Locale',
  severity: 'high',
  evaluate(ctx) {
    const declared = ctx.declared.locale?.timezone
    const live = ctx.main.timeZone
    const issues: string[] = []

    if (declared && live && declared !== live) {
      issues.push(`declared ${declared} but Intl reports ${live}`)
    }
    if (ctx.proxy?.timezone && live && !zonesAgree(live, ctx.proxy.timezone)) {
      issues.push(`browser in ${live} but proxy geolocates to ${ctx.proxy.timezone}`)
    }

    if (issues.length > 0) return { status: 'fail', detail: issues.join('; ') }
    if (!ctx.proxy?.timezone) {
      return { status: 'pass', detail: `Timezone ${live} consistent (no proxy geo to compare)` }
    }
    return { status: 'pass', detail: `Timezone ${live} agrees with proxy geo` }
  }
}

/** R7 — language, languages[0] and the declared locale must line up. */
const r7LocaleChain: CoherenceRule = {
  id: 'R7',
  name: 'Coherence: language chain',
  category: 'Locale',
  severity: 'high',
  evaluate(ctx) {
    const { language, languages } = ctx.main
    const issues: string[] = []

    if (languages.length === 0) {
      issues.push('navigator.languages is empty')
    } else if (languages[0] !== language) {
      issues.push(`navigator.language=${language} but languages[0]=${languages[0]}`)
    }

    const declared = ctx.declared.locale?.language
    if (declared && language && declared !== language) {
      issues.push(`declared ${declared} but browser reports ${language}`)
    }

    return issues.length > 0
      ? { status: 'fail', detail: issues.join('; ') }
      : { status: 'pass', detail: `Language chain consistent (${language})` }
  }
}

/** R8 — screen geometry must be internally possible and match the profile. */
const r8ScreenSanity: CoherenceRule = {
  id: 'R8',
  name: 'Coherence: screen geometry',
  category: 'Hardware',
  severity: 'high',
  evaluate(ctx) {
    const s = ctx.main.screen
    const issues: string[] = []

    if (s.availWidth > s.width) issues.push(`availWidth ${s.availWidth} > width ${s.width}`)
    if (s.availHeight > s.height) issues.push(`availHeight ${s.availHeight} > height ${s.height}`)
    if (s.pixelRatio <= 0) issues.push(`devicePixelRatio ${s.pixelRatio}`)

    const d = ctx.declared.screen
    if (d) {
      if (d.width !== s.width || d.height !== s.height) {
        issues.push(`declared ${d.width}x${d.height} but reported ${s.width}x${s.height}`)
      }
      if (d.pixelRatio !== s.pixelRatio) {
        issues.push(`declared DPR ${d.pixelRatio} but reported ${s.pixelRatio}`)
      }
    }

    return issues.length > 0
      ? { status: 'fail', detail: issues.join('; ') }
      : { status: 'pass', detail: `${s.width}x${s.height} @${s.pixelRatio}x` }
  }
}

/** R9 — touch capability must agree with itself and with the device class. */
const r9TouchCoherence: CoherenceRule = {
  id: 'R9',
  name: 'Coherence: touch support vs device class',
  category: 'Hardware',
  severity: 'high',
  evaluate(ctx) {
    const { maxTouchPoints, hasTouchStart, pointerCoarse } = ctx.main
    const os = osFromUserAgent(ctx.main.userAgent)
    const issues: string[] = []

    if (maxTouchPoints > 0 !== hasTouchStart) {
      issues.push(`maxTouchPoints=${maxTouchPoints} but ontouchstart=${hasTouchStart}`)
    }
    if (MOBILE.includes(os)) {
      if (maxTouchPoints === 0) issues.push(`${os} UA with maxTouchPoints=0`)
      if (!pointerCoarse) issues.push(`${os} UA but pointer:coarse does not match`)
    } else if (os !== 'unknown' && pointerCoarse) {
      issues.push(`desktop ${os} UA but pointer:coarse matches`)
    }

    return issues.length > 0
      ? { status: 'fail', detail: issues.join('; ') }
      : { status: 'pass', detail: `Touch profile consistent for ${os}` }
  }
}

/** R10 — UA version, UA-CH brand version and the real binary must agree. */
const r10ChromeVersion: CoherenceRule = {
  id: 'R10',
  name: 'Coherence: Chrome version across UA, UA-CH and binary',
  category: 'Browser',
  severity: 'high',
  evaluate(ctx) {
    const uaMajor = chromeMajorFromUa(ctx.main.userAgent)
    if (uaMajor === null) return { status: 'unavailable', detail: 'Not a Chromium UA' }

    const issues: string[] = []

    const brand = ctx.main.uaBrands?.find((b) => /Chrome|Chromium/i.test(b.brand))
    if (brand) {
      const brandMajor = Number(String(brand.version).split('.')[0])
      if (Number.isFinite(brandMajor) && brandMajor !== uaMajor) {
        issues.push(`UA says ${uaMajor} but UA-CH brand says ${brandMajor}`)
      }
    }

    // A spoofed version far from the real binary shows up in feature probing:
    // the UA claims an engine whose APIs the binary does not have.
    if (ctx.binaryMajor !== undefined && Math.abs(ctx.binaryMajor - uaMajor) > 2) {
      issues.push(`UA claims ${uaMajor} but the binary is ${ctx.binaryMajor}`)
    }

    return issues.length > 0
      ? { status: 'fail', detail: issues.join('; ') }
      : { status: 'pass', detail: `Chrome ${uaMajor} consistent` }
  }
}

/**
 * R11 — the same profile must render the same hashes on every launch.
 *
 * CLAUDE.md states this as an invariant ("same profile = same fingerprint
 * across sessions"). Nothing verified it. A profile whose canvas changes every
 * session is trivially linkable as "the account that never looks the same".
 */
const r11RenderStability: CoherenceRule = {
  id: 'R11',
  name: 'Coherence: rendered output stable across sessions',
  category: 'Graphics',
  severity: 'high',
  evaluate(ctx) {
    if (!ctx.baseline) {
      return { status: 'unavailable', detail: 'No previous run recorded — baseline stored for next time' }
    }
    const drifted = (['canvas', 'webgl', 'audio'] as const).filter(
      (k) => ctx.baseline![k] && ctx.render[k] !== ctx.baseline![k]
    )
    if (drifted.length > 0) {
      return { status: 'fail', detail: `Changed since last session: ${drifted.join(', ')}` }
    }
    return { status: 'pass', detail: 'Canvas, WebGL and audio hashes unchanged' }
  }
}

/**
 * R12 — no two profiles may render identical hashes.
 *
 * `collision-detector.ts` compares stored config, which is a different claim:
 * two profiles can hold different configs and still paint the same canvas.
 */
const r12RenderUniqueness: CoherenceRule = {
  id: 'R12',
  name: 'Coherence: rendered output unique across profiles',
  category: 'Graphics',
  severity: 'high',
  evaluate(ctx) {
    if (ctx.otherProfiles.length === 0) {
      return { status: 'unavailable', detail: 'No other profile has recorded hashes yet' }
    }
    const clashes = ctx.otherProfiles.filter(
      (o) =>
        (o.hashes.canvas && o.hashes.canvas === ctx.render.canvas) ||
        (o.hashes.webgl && o.hashes.webgl === ctx.render.webgl) ||
        (o.hashes.audio && o.hashes.audio === ctx.render.audio)
    )
    if (clashes.length > 0) {
      return {
        status: 'fail',
        detail: `Shares rendered output with ${clashes.length} profile(s): ${clashes.slice(0, 3).map((c) => c.profileId).join(', ')}`
      }
    }
    return { status: 'pass', detail: `Distinct from ${ctx.otherProfiles.length} other profile(s)` }
  }
}

/** R13 — memory and core count must be plausible for the claimed device. */
const r13HardwarePlausibility: CoherenceRule = {
  id: 'R13',
  name: 'Coherence: hardware plausible for device class',
  category: 'Hardware',
  severity: 'medium',
  evaluate(ctx) {
    const os = osFromUserAgent(ctx.main.userAgent)
    const cores = ctx.main.hardwareConcurrency
    const mem = ctx.main.deviceMemory
    const issues: string[] = []

    if (!Number.isFinite(cores) || cores <= 0) {
      issues.push(`hardwareConcurrency=${cores}`)
    } else if (MOBILE.includes(os) && cores > 10) {
      issues.push(`${os} device claiming ${cores} cores`)
    } else if (cores > 64) {
      issues.push(`implausible core count ${cores}`)
    }

    // Safari/iOS does not expose deviceMemory at all; reporting it is a tell.
    if (os === 'iOS' && mem !== undefined) {
      issues.push('iOS exposes navigator.deviceMemory, which real Safari does not')
    }
    if (mem !== undefined && ![1, 2, 4, 8, 16, 32].includes(mem)) {
      issues.push(`deviceMemory=${mem} is not one of the values Chrome reports`)
    }

    return issues.length > 0
      ? { status: 'fail', detail: issues.join('; ') }
      : { status: 'pass', detail: `${cores} cores${mem !== undefined ? `, ${mem}GB` : ''} plausible for ${os}` }
  }
}

/** Families that ship with exactly one OS — a cheap, high-signal tell. */
const OS_SIGNATURE_FONTS: Partial<Record<OsFamily, string[]>> = {
  Windows: ['Segoe UI', 'Calibri', 'Cambria'],
  macOS: ['Helvetica Neue', 'Menlo', 'Geneva'],
  iOS: ['Helvetica Neue'],
  Android: ['Roboto', 'Droid Sans']
}

/** R14 — the font whitelist must look like the OS the profile claims. */
const r14FontOsCoherence: CoherenceRule = {
  id: 'R14',
  name: 'Coherence: font list vs claimed OS',
  category: 'Browser',
  severity: 'medium',
  evaluate(ctx) {
    const fonts = ctx.declared.fonts
    if (!fonts || fonts.mode !== 'whitelist' || fonts.whitelist.length === 0) {
      return { status: 'unavailable', detail: 'No font whitelist configured' }
    }
    const os = osFromUserAgent(ctx.main.userAgent)
    const expected = OS_SIGNATURE_FONTS[os]
    if (!expected) return { status: 'unavailable', detail: `No font signature known for ${os}` }

    const present = new Set(ctx.declared.fonts.whitelist.map((f) => f.toLowerCase()))
    const missing = expected.filter((f) => !present.has(f.toLowerCase()))

    // Leaking another OS's exclusive fonts is the stronger signal of the two.
    const foreign: string[] = []
    for (const [otherOs, list] of Object.entries(OS_SIGNATURE_FONTS) as Array<[OsFamily, string[]]>) {
      if (otherOs === os) continue
      // iOS and macOS legitimately share families.
      if ((os === 'macOS' && otherOs === 'iOS') || (os === 'iOS' && otherOs === 'macOS')) continue
      for (const f of list) {
        if (present.has(f.toLowerCase()) && !expected.includes(f)) foreign.push(`${f} (${otherOs})`)
      }
    }

    const issues: string[] = []
    if (missing.length === expected.length) issues.push(`none of the ${os} signature fonts present`)
    if (foreign.length > 0) issues.push(`exposes foreign-OS fonts: ${foreign.join(', ')}`)

    return issues.length > 0
      ? { status: 'fail', detail: issues.join('; ') }
      : { status: 'pass', detail: `Font list consistent with ${os}` }
  }
}

export const COHERENCE_RULES: CoherenceRule[] = [
  r1PlatformTriad,
  r2GpuOsCoherence,
  r3WorkerParity,
  r4IframeParity,
  r5WebrtcLeak,
  r6Timezone,
  r7LocaleChain,
  r8ScreenSanity,
  r9TouchCoherence,
  r10ChromeVersion,
  r11RenderStability,
  r12RenderUniqueness,
  r13HardwarePlausibility,
  r14FontOsCoherence
]

/**
 * Runs every rule and converts the outcomes into detection vectors.
 *
 * A rule that throws becomes `unavailable` rather than taking the sweep down —
 * the same contract the layer-0 probes get from `runGuarded`.
 */
export function runCoherenceRules(ctx: CoherenceContext): DetectionVectorResult[] {
  return COHERENCE_RULES.map((rule) => {
    let outcome: RuleOutcome
    try {
      outcome = rule.evaluate(ctx)
    } catch (e: any) {
      outcome = { status: 'unavailable', detail: `Rule threw: ${e?.message ?? String(e)}` }
    }
    return {
      name: `${rule.name} [${rule.id}]`,
      category: rule.category,
      passed: outcome.status === 'pass',
      detail: outcome.detail,
      severity: rule.severity,
      source: 'coherence' as const,
      status: outcome.status
    }
  })
}
