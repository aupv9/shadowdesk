/**
 * External probes — Layer 2 of the detection validation design.
 *
 * Navigates public fingerprint testers and reads their verdict. The most
 * valuable is CreepJS, because it hunts for tampering specifically — comparing
 * realms, checking `Function.toString`, walking proto chains. That is the class
 * of defect a self-test can never find, since a self-test asks the injector to
 * confirm its own work.
 *
 * These targets change layout on their own schedule, so the design constraints
 * here are all about rot:
 *
 *   1. Selectors live in probes.json, never in this file.
 *   2. A parse miss is `unavailable`, never `fail`. A layout change must not
 *      silently drop every user's score — the SEA workflow templates already
 *      demonstrate the opposite failure mode, where selectors verified against
 *      saved fixtures stayed green while the live site had moved on.
 *   3. The raw extracted value is retained next to the parsed one so a human
 *      can audit a surprising result.
 *   4. An operator can override the manifest from userData without waiting for
 *      a release, because a rotted selector should not need a new build.
 *
 * The shipped selectors are UNVERIFIED — see probes.json and the freshness
 * workflow. Fail-soft is what makes shipping them safe.
 */
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import type { Page } from 'puppeteer-core'
import type { DetectionVectorResult, VectorSeverity } from '../../shared/types'
import bundledManifest from './probes.json'

// ── Manifest shape ───────────────────────────────────────────────────────────

export type ProbeExtract =
  /** Number of elements matching a selector — the most rot-resistant reading. */
  | { kind: 'count'; selector: string }
  /** Text content of a selector, optionally narrowed by a regex. */
  | { kind: 'text'; selector: string; pattern?: string; group?: number }
  /** An attribute value, optionally narrowed by a regex. */
  | { kind: 'attribute'; selector: string; attribute: string; pattern?: string; group?: number }

export type ProbeExpect =
  /** Numeric reading must be <= value (failing-check counts, lie counts). */
  | { type: 'maxCount'; value: number }
  /** Numeric reading must be >= value (trust scores). */
  | { type: 'minScore'; value: number }
  /** Text must contain none of these. */
  | { type: 'notContains'; values: string[] }

export interface DetectionProbe {
  id: string
  name: string
  url: string
  category: string
  severity: VectorSeverity
  /** Time to let the page's own JS finish before reading it. */
  settleMs: number
  timeoutMs: number
  /** ISO date the selectors were last confirmed against the live target. */
  lastVerified: string | null
  extract: ProbeExtract
  expect: ProbeExpect
  rationale?: string
}

export interface ProbeManifest {
  manifestVersion: string
  probes: DetectionProbe[]
}

// ── Extraction result ────────────────────────────────────────────────────────

export type Extraction =
  | { kind: 'count'; count: number }
  | { kind: 'text'; text: string }
  /** The selector matched nothing, or the regex did not fire. */
  | { kind: 'missing'; reason: string }

export type ProbeOutcome = {
  status: 'pass' | 'fail' | 'unavailable'
  detail: string
  /** What was read, verbatim, for auditing a surprising verdict. */
  raw?: string
}

// ── Manifest loading ─────────────────────────────────────────────────────────

/**
 * Bundled manifest, overlaid with an operator's `probes.json` from userData if
 * present. Overrides are merged by probe id so an operator can repair one
 * rotted selector without restating the whole file.
 */
export function loadManifest(userDataDir?: string): ProbeManifest {
  const base = bundledManifest as unknown as ProbeManifest
  if (!userDataDir) return base

  const overridePath = join(userDataDir, 'probes.json')
  if (!existsSync(overridePath)) return base

  try {
    const raw = JSON.parse(readFileSync(overridePath, 'utf-8')) as Partial<ProbeManifest>
    if (!Array.isArray(raw.probes)) return base

    const merged = new Map(base.probes.map((p) => [p.id, p]))
    for (const override of raw.probes) {
      if (!override?.id) continue
      const existing = merged.get(override.id)
      merged.set(override.id, existing ? { ...existing, ...override } : override)
    }
    return { manifestVersion: raw.manifestVersion ?? base.manifestVersion, probes: [...merged.values()] }
  } catch {
    // A malformed override must not take the bundled manifest down with it.
    return base
  }
}

// ── Pure evaluation ──────────────────────────────────────────────────────────

/**
 * Applies a probe's expectation to what was read.
 *
 * Pure, so the whole decision table — including every way a probe can go stale
 * — is tested against saved fixtures rather than against a live site.
 */
export function evaluateExtraction(probe: DetectionProbe, extraction: Extraction): ProbeOutcome {
  if (extraction.kind === 'missing') {
    return {
      status: 'unavailable',
      detail: `Manifest may be stale: ${extraction.reason}. Probe "${probe.id}" was skipped, not failed.`
    }
  }

  const { expect } = probe

  if (expect.type === 'notContains') {
    if (extraction.kind !== 'text') {
      return { status: 'unavailable', detail: `notContains needs a text reading, got ${extraction.kind}` }
    }
    const hit = expect.values.find((v) => extraction.text.includes(v))
    return hit
      ? { status: 'fail', detail: `Response contained "${hit}"`, raw: extraction.text.slice(0, 200) }
      : { status: 'pass', detail: 'None of the flagged strings present', raw: extraction.text.slice(0, 200) }
  }

  // Both remaining expectations are numeric.
  const value = extraction.kind === 'count' ? extraction.count : Number(extraction.text)
  const raw = extraction.kind === 'count' ? String(extraction.count) : extraction.text

  if (!Number.isFinite(value)) {
    return {
      status: 'unavailable',
      detail: `Read "${raw}" where a number was expected — manifest may be stale`,
      raw
    }
  }

  if (expect.type === 'maxCount') {
    return value <= expect.value
      ? { status: 'pass', detail: `${value} (allowed up to ${expect.value})`, raw }
      : { status: 'fail', detail: `${value} exceeds the allowed ${expect.value}`, raw }
  }

  return value >= expect.value
    ? { status: 'pass', detail: `${value} (minimum ${expect.value})`, raw }
    : { status: 'fail', detail: `${value} is below the minimum ${expect.value}`, raw }
}

/** Applies a probe's regex to extracted text. Exported for the freshness job. */
export function applyPattern(
  text: string,
  pattern: string | undefined,
  group: number | undefined
): Extraction {
  if (!pattern) return { kind: 'text', text: text.trim() }
  let re: RegExp
  try {
    re = new RegExp(pattern, 'i')
  } catch {
    return { kind: 'missing', reason: `invalid pattern /${pattern}/` }
  }
  const m = re.exec(text)
  if (!m) return { kind: 'missing', reason: `pattern /${pattern}/ did not match` }
  const captured = m[group ?? 0]
  if (captured === undefined) return { kind: 'missing', reason: `pattern matched but group ${group} is empty` }
  return { kind: 'text', text: captured.trim() }
}

// ── Live execution ───────────────────────────────────────────────────────────

/** Reads a probe's target value out of an already-loaded page. */
export async function extractFromPage(page: Page, probe: DetectionProbe): Promise<Extraction> {
  const { extract } = probe

  if (extract.kind === 'count') {
    const count = await page.evaluate((sel) => document.querySelectorAll(sel).length, extract.selector)
    // Zero matches is ambiguous: either nothing failed, or the selector rotted.
    // Callers cannot tell them apart, so this is reported as a count and the
    // freshness job is what distinguishes the two.
    return { kind: 'count', count }
  }

  const text = await page.evaluate(
    (sel, attr) => {
      const el = document.querySelector(sel)
      if (!el) return null
      return attr ? el.getAttribute(attr) : (el.textContent ?? '')
    },
    extract.selector,
    extract.kind === 'attribute' ? extract.attribute : null
  )

  if (text === null) {
    return { kind: 'missing', reason: `selector "${extract.selector}" matched nothing` }
  }
  return applyPattern(text, extract.pattern, extract.group)
}

/**
 * Loads a probe's page and reads it.
 *
 * A navigation failure is `unavailable`: the target being down says nothing
 * about the profile.
 */
export async function runProbe(page: Page, probe: DetectionProbe): Promise<ProbeOutcome> {
  try {
    await page.goto(probe.url, { timeout: probe.timeoutMs, waitUntil: 'domcontentloaded' })
    // These pages compute their verdict in JS after load; reading immediately
    // returns a half-built DOM.
    await new Promise((r) => setTimeout(r, probe.settleMs))
    return evaluateExtraction(probe, await extractFromPage(page, probe))
  } catch (e: any) {
    return { status: 'unavailable', detail: `Could not load ${probe.url}: ${e?.message ?? String(e)}` }
  }
}

/**
 * Runs every probe, loading each distinct URL once.
 *
 * Two probes reading different numbers off the same CreepJS page should not
 * cost two page loads — that page alone takes ~12s to settle.
 */
export async function runProbes(
  page: Page,
  probes: DetectionProbe[]
): Promise<Array<{ probe: DetectionProbe; outcome: ProbeOutcome }>> {
  const byUrl = new Map<string, DetectionProbe[]>()
  for (const p of probes) {
    const group = byUrl.get(p.url)
    if (group) group.push(p)
    else byUrl.set(p.url, [p])
  }

  const results: Array<{ probe: DetectionProbe; outcome: ProbeOutcome }> = []

  for (const [url, group] of byUrl) {
    // One load per URL, using the longest settle any probe in the group asked
    // for so the slowest reader still sees a finished page.
    const timeoutMs = Math.max(...group.map((p) => p.timeoutMs))
    const settleMs = Math.max(...group.map((p) => p.settleMs))

    try {
      await page.goto(url, { timeout: timeoutMs, waitUntil: 'domcontentloaded' })
      await new Promise((r) => setTimeout(r, settleMs))
    } catch (e: any) {
      const detail = `Could not load ${url}: ${e?.message ?? String(e)}`
      for (const probe of group) results.push({ probe, outcome: { status: 'unavailable', detail } })
      continue
    }

    for (const probe of group) {
      try {
        results.push({ probe, outcome: evaluateExtraction(probe, await extractFromPage(page, probe)) })
      } catch (e: any) {
        results.push({
          probe,
          outcome: { status: 'unavailable', detail: `Extraction threw: ${e?.message ?? String(e)}` }
        })
      }
    }
  }

  return results
}

/** Turns a probe outcome into a detection vector. */
export function probeVector(probe: DetectionProbe, outcome: ProbeOutcome): DetectionVectorResult {
  const unverified = probe.lastVerified ? '' : ' (selectors unverified)'
  return {
    name: `Probe: ${probe.name}`,
    category: probe.category,
    passed: outcome.status === 'pass',
    severity: probe.severity,
    source: 'probe',
    status: outcome.status,
    detail: `${outcome.detail}${outcome.raw ? ` [read: ${outcome.raw}]` : ''}${unverified}`
  }
}
