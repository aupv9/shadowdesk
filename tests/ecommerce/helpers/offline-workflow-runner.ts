/**
 * Offline Workflow Runner — simulates a subset of AutomationEngine against
 * static HTML fixtures so tests can validate the shape of each SEA workflow
 * template without launching a real Chromium.
 *
 * What it supports (matching what the SEA e-commerce templates in
 * src/main/workflow-templates.ts actually use):
 *
 *   - navigate           → set current page to the fixture URL
 *   - wait               → no-op (simulated)
 *   - waitForSelector    → assert selector exists on current page
 *   - scroll             → no-op (simulated)
 *   - click              → assert selector exists; no state change
 *   - hover              → assert selector exists
 *   - type / keyPress    → no-op (simulated)
 *   - extractText        → return HtmlDoc.extractAll / .extract, store in vars
 *   - screenshot         → no-op
 *   - loop               → iterate nested steps
 *   - waitForNavigation  → no-op
 *   - conditional        → use selector presence as condition
 *
 * The runner takes a URL→fixture map — when a navigate step fires, the runner
 * loads the matching fixture as the "current page". extractText then reads
 * from that fixture. This intentionally mirrors AutomationEngine's DOM-based
 * extraction logic without its browser side.
 *
 * NOT a full substitute for a live browser run. It only validates that:
 *   1. Workflow selectors match the DOM shape we expect.
 *   2. `extractText(all:true)` produces the right cardinality.
 *   3. `saveAs` variables are populated correctly.
 *   4. Required navigate/wait/conditional structure is sound.
 *
 * Everything stateful in a real run (cookies, auth, proxy rotation) is
 * exercised by the mock-marketplace-server tests instead.
 */

import type { AutomationStep, AutomationWorkflow } from '../../../src/shared/types'
import { HtmlDoc } from './html-matcher'

export interface FixtureSource {
  /** Map from navigate URL (or URL glob like "shopee.vn/*") to HTML body. */
  [urlGlob: string]: string
}

export interface RunnerOptions {
  fixtures: FixtureSource
  /** Runtime variable overrides — interpolated into step params like {keyword}. */
  variables?: Record<string, string>
  /** Throw on selector-not-found (waitForSelector). Default: true. */
  strictSelectors?: boolean
}

export interface RunnerStepResult {
  stepId: string
  action: AutomationStep['action']
  label?: string
  success: boolean
  output?: unknown
  error?: string
  url?: string
}

export interface RunnerResult {
  status: 'completed' | 'failed'
  stepResults: RunnerStepResult[]
  variables: Record<string, unknown>
  /** Extracted single values (from saveAs on scalar extractText). */
  scalars: Record<string, string>
  /** Extracted arrays (from saveAs on extractText with all:true). */
  arrays: Record<string, string[]>
  /** Final page URL at end of run. */
  finalUrl: string | null
  /** Error message if status === 'failed'. */
  error?: string
}

/** Simple {key} interpolation matching AutomationEngine's own placeholder style. */
function interpolate(value: unknown, vars: Record<string, string>): unknown {
  if (typeof value !== 'string') return value
  return value.replace(/\{([\w.]+)\}/g, (_, key: string) => vars[key] ?? `{${key}}`)
}

function interpolateParams(
  params: Record<string, unknown>,
  vars: Record<string, string>
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) out[k] = v.map((item) => interpolate(item, vars))
    else if (v && typeof v === 'object') out[k] = interpolateParams(v as Record<string, unknown>, vars)
    else out[k] = interpolate(v, vars)
  }
  return out
}

/** Match an incoming URL against a fixture map key. Supports `*` glob. */
function resolveFixture(url: string, fixtures: FixtureSource): string | null {
  // Exact match first
  if (fixtures[url]) return fixtures[url]
  // Host-only match (strip path)
  try {
    const parsed = new URL(url)
    const hostOnly = `${parsed.protocol}//${parsed.host}`
    if (fixtures[hostOnly]) return fixtures[hostOnly]
  } catch { /* bare URL */ }
  // Glob match — convert * to .*
  for (const [key, body] of Object.entries(fixtures)) {
    if (!key.includes('*')) continue
    const escaped = key.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
    const re = new RegExp(`^${escaped}$`)
    if (re.test(url)) return body
  }
  return null
}

export class OfflineWorkflowRunner {
  private currentDoc: HtmlDoc | null = null
  private currentUrl: string | null = null
  private results: RunnerStepResult[] = []
  private scalars: Record<string, string> = {}
  private arrays: Record<string, string[]> = {}
  private vars: Record<string, string>

  constructor(private readonly opts: RunnerOptions) {
    this.vars = {
      timestamp: new Date().toISOString(),
      runId: 'offline-test',
      random: 'deterministic',
      ...(opts.variables ?? {})
    }
  }

  run(workflow: AutomationWorkflow): RunnerResult {
    try {
      const status = this.runSteps(workflow.steps)
      return {
        status,
        stepResults: this.results,
        variables: { ...this.scalars, ...this.arrays },
        scalars: this.scalars,
        arrays: this.arrays,
        finalUrl: this.currentUrl
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return {
        status: 'failed',
        stepResults: this.results,
        variables: { ...this.scalars, ...this.arrays },
        scalars: this.scalars,
        arrays: this.arrays,
        finalUrl: this.currentUrl,
        error: message
      }
    }
  }

  private runSteps(steps: AutomationStep[]): 'completed' | 'failed' {
    for (const rawStep of steps) {
      const params = interpolateParams(rawStep.params ?? {}, this.vars)
      const step = { ...rawStep, params }
      try {
        const output = this.runStep(step)
        this.results.push({
          stepId: step.id,
          action: step.action,
          label: step.label,
          success: true,
          output,
          url: this.currentUrl ?? undefined
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        this.results.push({
          stepId: step.id,
          action: step.action,
          label: step.label,
          success: false,
          error: message,
          url: this.currentUrl ?? undefined
        })
        return 'failed'
      }
    }
    return 'completed'
  }

  private runStep(step: AutomationStep): unknown {
    const { action, params } = step
    switch (action) {
      case 'navigate': {
        const url = String(params.url ?? '')
        if (!url) throw new Error('navigate: missing url')
        const body = resolveFixture(url, this.opts.fixtures)
        if (body === null) {
          throw new Error(`navigate: no fixture registered for "${url}"`)
        }
        this.currentDoc = new HtmlDoc(body)
        this.currentUrl = url
        return { url }
      }

      case 'wait':
      case 'waitForNavigation':
      case 'scroll':
      case 'screenshot':
      case 'type':
      case 'keyPress':
      case 'evaluate':
        // Simulated — no-op but still participates in the pipeline.
        return null

      case 'waitForSelector':
      case 'click':
      case 'hover': {
        const selector = String(params.selector ?? '')
        if (!selector) throw new Error(`${action}: missing selector`)
        if (!this.currentDoc) {
          throw new Error(`${action}: no current page — did you run navigate first?`)
        }
        const found = this.currentDoc.query(selector)
        if (!found) {
          if (this.opts.strictSelectors === false) return null
          throw new Error(
            `${action}: selector "${selector}" not found in fixture (${this.currentUrl})`
          )
        }
        return { matched: selector }
      }

      case 'extractText': {
        const selector = String(params.selector ?? '')
        if (!selector) throw new Error('extractText: missing selector')
        if (!this.currentDoc) {
          throw new Error('extractText: no current page')
        }
        const saveAs = params.saveAs ? String(params.saveAs) : null
        if (params.all === true) {
          const values = this.currentDoc.extractAll(selector)
          if (saveAs) this.arrays[saveAs] = values
          return values
        }
        const value = this.currentDoc.extract(selector)
        if (saveAs && value !== null) this.scalars[saveAs] = value
        return value
      }

      case 'loop': {
        const times = Number(params.times ?? 0)
        const inner = (params.steps ?? []) as AutomationStep[]
        for (let i = 0; i < times; i++) {
          const status = this.runSteps(inner)
          if (status === 'failed') return { iterations: i, aborted: true }
        }
        return { iterations: times }
      }

      case 'conditional': {
        const selector = String(params.selector ?? '')
        const matched = selector && this.currentDoc
          ? this.currentDoc.query(selector) !== null
          : false
        const branch = (matched ? params.thenSteps : params.elseSteps) as AutomationStep[] | undefined
        if (Array.isArray(branch)) {
          const status = this.runSteps(branch)
          if (status === 'failed') throw new Error('conditional: branch failed')
        }
        return { matched }
      }

      default:
        // Unsupported in offline runner — treat as simulated no-op rather than
        // failing the whole workflow. Tests that care should assert specific
        // step shapes directly.
        return null
    }
  }
}

/** Convenience factory — build an AutomationWorkflow from steps + id/name. */
export function defineWorkflow(
  id: string,
  name: string,
  steps: AutomationStep[],
  variables?: Record<string, string>
): AutomationWorkflow {
  return {
    id,
    name,
    description: '',
    steps,
    variables,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
}
