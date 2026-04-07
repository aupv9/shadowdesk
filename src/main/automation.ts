import { v4 as uuidv4 } from 'uuid'
import { BrowserManager } from './browser-manager'
import { Database } from './database'
import { getSettings } from './settings'
import { getSolver, type CaptchaProviderId, type SolveResult } from './captcha'
import { getVault } from './vault'
import type {
  AutomationStep,
  AutomationStepResult,
  AutomationRunResult,
  AutomationWorkflow,
  AssertResult,
  AssertType
} from '../shared/types'
import type { Page, ElementHandle } from 'puppeteer-core'
import type { WebContents } from 'electron'
import http from 'http'
import https from 'https'
import { createWriteStream } from 'fs'
import { mkdir, stat } from 'fs/promises'
import { dirname } from 'path'
import { URL } from 'url'

/** Replace {key} placeholders in step params with variable values.
 *  Keys may include dots for namespaced lookups (e.g. `{cred.username}`). */
function interpolateParams(
  params: Record<string, any>,
  vars: Record<string, string>
): Record<string, any> {
  if (Object.keys(vars).length === 0) return params
  return JSON.parse(
    JSON.stringify(params).replace(/\{([\w.]+)\}/g, (_, k) => vars[k] ?? `{${k}}`)
  )
}

/** Per-profile network interception state. Each entry holds the rules and a
 *  reference to the handler so we can detach it on `clearIntercepts` or when
 *  the workflow ends. */
interface InterceptRule {
  urlPattern: string // glob-ish: '*' wildcards
  action: 'block' | 'mock' | 'modify'
  status?: number
  contentType?: string
  body?: string
  headers?: Record<string, string>
}

interface InterceptState {
  rules: InterceptRule[]
  handler: (req: any) => void
  enabled: boolean
}

/** Convert a glob pattern (`*` wildcards) to a RegExp. */
function globToRegex(glob: string): RegExp {
  const escaped = glob.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
  return new RegExp('^' + escaped + '$')
}

/** Tier 2: Debugger control surface attached to each running workflow.
 *  The renderer interacts with these via IPC (`workflows:debug:*`). */
interface DebugControl {
  abort: boolean
  /** Currently paused (manually or by breakpoint) */
  paused: boolean
  /** "Step over" requested — runner advances one step then re-pauses */
  stepOver: boolean
  /** Set of step ids that should pause execution before running */
  breakpoints: Set<string>
  /** Resolver to wait on while paused */
  resumeWaiter: (() => void) | null
}

export class AutomationEngine {
  private static instance: AutomationEngine
  private running = new Map<string, DebugControl>()
  /** Active network intercept state per profileId */
  private intercepts = new Map<string, InterceptState>()

  static getInstance(): AutomationEngine {
    if (!AutomationEngine.instance) {
      AutomationEngine.instance = new AutomationEngine()
    }
    return AutomationEngine.instance
  }

  async executeWorkflow(
    workflowId: string,
    profileId: string,
    runtimeVars?: Record<string, string>,
    webContents?: WebContents,
    debugOpts?: { breakpoints?: string[]; pauseAtStart?: boolean }
  ): Promise<AutomationRunResult> {
    const db = Database.getInstance()
    const bm = BrowserManager.getInstance()

    const workflowRow = db.getWorkflow(workflowId)
    if (!workflowRow) throw new Error(`Workflow ${workflowId} not found`)

    const workflow: AutomationWorkflow = {
      ...workflowRow,
      steps: JSON.parse(workflowRow.steps),
      variables: workflowRow.variables ? JSON.parse(workflowRow.variables) : undefined
    }

    // Resolve profile name for built-in {profileName} variable
    let profileName = profileId
    try {
      const profileRow: any = db.getProfile(profileId)
      if (profileRow?.name) profileName = profileRow.name
    } catch { /* non-fatal */ }

    // Merge stored variables with runtime overrides, then inject built-in variables
    const variables: Record<string, string> = {
      ...(workflow.variables ?? {}),
      ...(runtimeVars ?? {}),
      // Built-in read-only variables (user-defined vars override these if same key)
      timestamp: new Date().toISOString(),
      runId: `${workflowId}:${profileId}`,
      random: Math.random().toString(36).slice(2),
      profileName
    }

    if (!bm.isRunning(profileId)) {
      throw new Error('Profile must be launched before running automation')
    }

    const page = await this.getActivePage(profileId)
    if (!page) throw new Error('No active page found for profile')

    const runKey = `${workflowId}:${profileId}`
    const control: DebugControl = {
      abort: false,
      paused: !!debugOpts?.pauseAtStart,
      stepOver: false,
      breakpoints: new Set(debugOpts?.breakpoints ?? []),
      resumeWaiter: null
    }
    this.running.set(runKey, control)

    const startedAt = new Date().toISOString()
    const startedAtMs = Date.now()
    const stepResults: AutomationStepResult[] = []
    let status: 'completed' | 'failed' | 'stopped' = 'completed'
    let runError: string | undefined

    try {
      // Variables are interpolated lazily per-step (not upfront), so actions
      // like `solveCaptcha` can write into the map and have subsequent steps
      // pick up the new values via {captchaToken}-style placeholders.
      const result = await this.executeSteps(page, workflow.steps, control, stepResults, variables, webContents, workflowId, profileId)
      if (result === 'stopped') status = 'stopped'
      else if (result === 'failed') {
        status = 'failed'
        const lastFailed = stepResults.findLast((r) => !r.success)
        if (lastFailed) runError = lastFailed.error
      }
    } catch (err: any) {
      status = 'failed'
      runError = err.message
    } finally {
      this.running.delete(runKey)
      // Tear down any network interception this run installed so it doesn't
      // leak into subsequent runs / manual browsing sessions.
      await this.teardownIntercepts(profileId, page).catch(() => { /* non-fatal */ })
    }

    const completedAt = new Date().toISOString()
    const runResult: AutomationRunResult = {
      workflowId,
      profileId,
      status,
      startedAt,
      completedAt,
      stepResults,
      error: runError
    }

    // Persist run to DB (Tier 2: includes started_at, duration, variables snapshot)
    db.addWorkflowRun({
      id: uuidv4(),
      workflow_id: workflowId,
      profile_id: profileId,
      status,
      step_results: stepResults,
      error: runError,
      started_at: startedAt,
      completed_at: completedAt,
      duration_ms: Date.now() - startedAtMs,
      variables
    })

    return runResult
  }

  // ── Tier 2: Debugger control surface ───────────────────────────────────

  /** Pause a running workflow at the next step boundary. */
  pauseWorkflow(workflowId: string, profileId: string): boolean {
    const ctrl = this.running.get(`${workflowId}:${profileId}`)
    if (!ctrl) return false
    ctrl.paused = true
    return true
  }

  /** Resume a paused workflow. */
  resumeWorkflow(workflowId: string, profileId: string): boolean {
    const ctrl = this.running.get(`${workflowId}:${profileId}`)
    if (!ctrl) return false
    ctrl.paused = false
    ctrl.stepOver = false
    if (ctrl.resumeWaiter) {
      const w = ctrl.resumeWaiter
      ctrl.resumeWaiter = null
      w()
    }
    return true
  }

  /** Run exactly one step then re-pause. */
  stepOverWorkflow(workflowId: string, profileId: string): boolean {
    const ctrl = this.running.get(`${workflowId}:${profileId}`)
    if (!ctrl) return false
    ctrl.stepOver = true
    ctrl.paused = false
    if (ctrl.resumeWaiter) {
      const w = ctrl.resumeWaiter
      ctrl.resumeWaiter = null
      w()
    }
    return true
  }

  /** Replace the breakpoint set for a running workflow. */
  setBreakpoints(workflowId: string, profileId: string, stepIds: string[]): boolean {
    const ctrl = this.running.get(`${workflowId}:${profileId}`)
    if (!ctrl) return false
    ctrl.breakpoints = new Set(stepIds)
    return true
  }

  /** Inspect a paused (or running) workflow's current state. */
  getDebugState(workflowId: string, profileId: string): {
    running: boolean
    paused: boolean
    breakpoints: string[]
  } | null {
    const ctrl = this.running.get(`${workflowId}:${profileId}`)
    if (!ctrl) return null
    return {
      running: true,
      paused: ctrl.paused,
      breakpoints: Array.from(ctrl.breakpoints)
    }
  }

  /** Wait while paused. Resolves when caller resumes / steps / aborts. */
  private async waitWhilePaused(control: DebugControl): Promise<void> {
    while (control.paused && !control.abort) {
      await new Promise<void>((resolve) => {
        control.resumeWaiter = resolve
      })
    }
  }

  // ── Tier 2: Dry-run validation ─────────────────────────────────────────

  /**
   * Validate a workflow without executing it. Checks for:
   * - unknown action types
   * - missing required params
   * - jumpToStep targets that don't exist in the same step list
   * - callWorkflow targets that don't exist in the database
   * - unresolved {variable} placeholders
   */
  dryRunWorkflow(workflowId: string, runtimeVars?: Record<string, string>): {
    valid: boolean
    issues: { stepId?: string; severity: 'error' | 'warning'; message: string }[]
    stepCount: number
  } {
    const db = Database.getInstance()
    const row = db.getWorkflow(workflowId)
    if (!row) throw new Error(`Workflow ${workflowId} not found`)

    const steps: AutomationStep[] = JSON.parse(row.steps)
    const storedVars: Record<string, string> = row.variables ? JSON.parse(row.variables) : {}
    const knownVars = new Set([
      ...Object.keys(storedVars),
      ...Object.keys(runtimeVars ?? {}),
      'timestamp', 'runId', 'random', 'profileName'
    ])

    const issues: { stepId?: string; severity: 'error' | 'warning'; message: string }[] = []

    // Required params per action type — keep tight: only the must-haves.
    const REQUIRED: Record<string, string[]> = {
      navigate: ['url'],
      click: ['selector'],
      doubleClick: ['selector'],
      rightClick: ['selector'],
      hover: ['selector'],
      type: ['selector', 'text'],
      waitForSelector: ['selector'],
      extractText: ['selector'],
      select: ['selector', 'value'],
      keyPress: ['key'],
      evaluate: ['script'],
      setAttribute: ['selector', 'attribute'],
      httpRequest: ['url'],
      upload: ['selector', 'filePath'],
      download: ['url', 'savePath'],
      solveCaptcha: ['siteKey'],
      injectCaptchaToken: ['token'],
      callWorkflow: ['workflowId'],
      jumpToStep: ['targetStepId'],
      interceptRequest: ['urlPattern'],
      setCookies: [],
      deleteCookies: [],
      getCookies: []
    }

    const KNOWN_ACTIONS = new Set([
      'navigate', 'click', 'doubleClick', 'rightClick', 'type', 'wait',
      'waitForSelector', 'waitForNavigation', 'screenshot', 'extractText',
      'scroll', 'select', 'keyPress', 'evaluate', 'hover', 'setAttribute',
      'httpRequest', 'upload', 'download', 'solveCaptcha', 'injectCaptchaToken',
      'useCredential', 'conditional', 'loop',
      'callWorkflow', 'parallelSteps', 'jumpToStep',
      'interceptRequest', 'clearIntercepts',
      'getCookies', 'setCookies', 'deleteCookies'
    ])

    // Pre-collect ids that produce variables so {var} references resolve.
    const producedVars = new Set<string>(knownVars)
    const collectProduced = (list: AutomationStep[]) => {
      for (const s of list) {
        if (s.params?.saveAs) producedVars.add(String(s.params.saveAs))
        if (s.action === 'useCredential') {
          const prefix = s.params?.prefix || 'cred'
          producedVars.add(`${prefix}.username`)
          producedVars.add(`${prefix}.password`)
        }
        // Recurse into nested step containers
        if (Array.isArray(s.params?.thenSteps)) collectProduced(s.params.thenSteps)
        if (Array.isArray(s.params?.elseSteps)) collectProduced(s.params.elseSteps)
        if (Array.isArray(s.params?.steps)) collectProduced(s.params.steps)
      }
    }
    collectProduced(steps)

    const validateStepList = (list: AutomationStep[], parentIds: Set<string>) => {
      const localIds = new Set(list.map((s) => s.id))
      for (const step of list) {
        // Unknown action
        if (!KNOWN_ACTIONS.has(step.action)) {
          issues.push({ stepId: step.id, severity: 'error', message: `Unknown action: ${step.action}` })
          continue
        }

        // Required params
        const reqs = REQUIRED[step.action] ?? []
        for (const r of reqs) {
          if (step.params == null || step.params[r] === undefined || step.params[r] === '') {
            issues.push({
              stepId: step.id,
              severity: 'error',
              message: `${step.action}: missing required param "${r}"`
            })
          }
        }

        // jumpToStep target must exist somewhere in the workflow tree.
        if (step.action === 'jumpToStep' && step.params?.targetStepId) {
          const target = String(step.params.targetStepId)
          if (!localIds.has(target) && !parentIds.has(target)) {
            issues.push({
              stepId: step.id,
              severity: 'error',
              message: `jumpToStep target "${target}" not found in workflow`
            })
          }
        }

        // callWorkflow target must exist in DB.
        if (step.action === 'callWorkflow' && step.params?.workflowId) {
          const targetId = String(step.params.workflowId)
          const target = db.getWorkflow(targetId)
          if (!target) {
            issues.push({
              stepId: step.id,
              severity: 'error',
              message: `callWorkflow: workflow "${targetId}" does not exist`
            })
          } else if (targetId === workflowId) {
            issues.push({
              stepId: step.id,
              severity: 'warning',
              message: 'callWorkflow targets itself — possible infinite recursion'
            })
          }
        }

        // Unresolved {variable} placeholders in any string param.
        try {
          const json = JSON.stringify(step.params ?? {})
          const refs = json.match(/\{([\w.]+)\}/g) ?? []
          for (const raw of refs) {
            const key = raw.slice(1, -1)
            if (!producedVars.has(key)) {
              issues.push({
                stepId: step.id,
                severity: 'warning',
                message: `${step.action}: references unknown variable "${key}"`
              })
            }
          }
        } catch { /* unstringifiable params, ignore */ }

        // Recurse
        const nextParents = new Set([...parentIds, ...localIds])
        if (Array.isArray(step.params?.thenSteps)) validateStepList(step.params.thenSteps, nextParents)
        if (Array.isArray(step.params?.elseSteps)) validateStepList(step.params.elseSteps, nextParents)
        if (Array.isArray(step.params?.steps)) validateStepList(step.params.steps, nextParents)
      }
    }

    validateStepList(steps, new Set())

    return {
      valid: issues.filter((i) => i.severity === 'error').length === 0,
      issues,
      stepCount: steps.length
    }
  }

  /** Execute a list of steps, collecting results. Returns overall status. */
  private async executeSteps(
    page: Page,
    steps: AutomationStep[],
    control: DebugControl | { abort: boolean },
    stepResults: AutomationStepResult[],
    variables: Record<string, string>,
    webContents?: WebContents,
    workflowId?: string,
    profileId?: string
  ): Promise<'completed' | 'failed' | 'stopped'> {
    // Index-based iteration so `jumpToStep` can change the cursor.
    let i = 0
    let jumpsUsed = 0
    const MAX_JUMPS = 1000 // safety: prevent infinite jump loops

    // Tier 2: Detect debugger-aware control. Sub-step lists (loop bodies,
    // conditional branches, parallelSteps) reuse the parent control so
    // breakpoints work uniformly.
    const isDebug = (c: any): c is DebugControl => c && typeof c.paused === 'boolean'

    while (i < steps.length) {
      if (control.abort) return 'stopped'
      const step = steps[i]

      // Tier 2: pause if a breakpoint is set on this step (or paused manually)
      if (isDebug(control)) {
        if (control.breakpoints.has(step.id)) {
          control.paused = true
        }
        if (control.paused) {
          if (webContents && !webContents.isDestroyed()) {
            try {
              webContents.send('automation:paused', {
                workflowId,
                profileId,
                stepId: step.id,
                action: step.action,
                variables: { ...variables }
              })
            } catch { /* non-fatal */ }
          }
          await this.waitWhilePaused(control)
          if (control.abort) return 'stopped'
          if (webContents && !webContents.isDestroyed()) {
            try {
              webContents.send('automation:resumed', { workflowId, profileId, stepId: step.id })
            } catch { /* non-fatal */ }
          }
        }
      }

      // Interpolate this step's params lazily — variables may have been
      // mutated by an earlier step (e.g. solveCaptcha → {captchaToken}).
      const liveStep: AutomationStep = {
        ...step,
        params: interpolateParams(step.params, variables)
      }

      const result = await this.executeStep(page, liveStep, control, stepResults, variables, profileId)
      stepResults.push(result)

      // Tier 2: re-pause after stepOver
      if (isDebug(control) && control.stepOver) {
        control.stepOver = false
        control.paused = true
      }

      // Stream live progress to renderer
      if (webContents && !webContents.isDestroyed()) {
        try {
          webContents.send('automation:step-progress', { workflowId, profileId, step: result })
        } catch { /* non-fatal */ }
      }

      if (!result.success) return 'failed'

      // Handle jumpToStep — the action stores the target step id in
      // `result.output.jumpTo` (or null if the condition wasn't met).
      const jumpTarget: string | undefined = result.output?.jumpTo
      if (jumpTarget) {
        const targetIdx = steps.findIndex((s) => s.id === jumpTarget)
        if (targetIdx < 0) {
          // Convert into a failed run so users notice the bad reference.
          stepResults[stepResults.length - 1] = {
            ...result,
            success: false,
            error: `jumpToStep target "${jumpTarget}" not found in workflow`
          }
          return 'failed'
        }
        jumpsUsed++
        if (jumpsUsed > MAX_JUMPS) {
          stepResults[stepResults.length - 1] = {
            ...result,
            success: false,
            error: `jumpToStep exceeded ${MAX_JUMPS} jumps (possible infinite loop)`
          }
          return 'failed'
        }
        i = targetIdx
        continue
      }

      i++
    }
    return 'completed'
  }

  stopWorkflow(workflowId: string, profileId: string): void {
    const runKey = `${workflowId}:${profileId}`
    const control = this.running.get(runKey)
    if (control) control.abort = true
  }

  isWorkflowRunning(workflowId: string, profileId: string): boolean {
    return this.running.has(`${workflowId}:${profileId}`)
  }

  /**
   * Phase 10.1 — Run a workflow against multiple profiles in parallel.
   * Each profile must already be launched. Failures on one profile do not
   * stop execution on the others — every profile produces an independent
   * AutomationRunResult.
   */
  async executeWorkflowParallel(
    workflowId: string,
    profileIds: string[],
    runtimeVars?: Record<string, string>,
    concurrency: number = 5,
    webContents?: WebContents
  ): Promise<AutomationRunResult[]> {
    if (profileIds.length === 0) return []

    const results: AutomationRunResult[] = []
    // Run in batches of `concurrency` so we don't overwhelm the host with
    // many simultaneous browser sessions.
    for (let i = 0; i < profileIds.length; i += concurrency) {
      const batch = profileIds.slice(i, i + concurrency)
      const settled = await Promise.allSettled(
        batch.map((pid) => this.executeWorkflow(workflowId, pid, runtimeVars, webContents))
      )
      for (let j = 0; j < settled.length; j++) {
        const r = settled[j]
        if (r.status === 'fulfilled') {
          results.push(r.value)
        } else {
          results.push({
            workflowId,
            profileId: batch[j],
            status: 'failed',
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            stepResults: [],
            error: String(r.reason?.message ?? r.reason)
          })
        }
      }
    }
    return results
  }

  /** Stop a parallel run by aborting all active controls for the workflow. */
  stopWorkflowAll(workflowId: string): number {
    let stopped = 0
    for (const [key, control] of this.running.entries()) {
      if (key.startsWith(`${workflowId}:`)) {
        control.abort = true
        stopped++
      }
    }
    return stopped
  }

  private async executeStep(
    page: Page,
    step: AutomationStep,
    control: DebugControl | { abort: boolean },
    allResults: AutomationStepResult[],
    variables: Record<string, string>,
    profileId?: string
  ): Promise<AutomationStepResult> {
    const start = Date.now()
    const maxAttempts = Math.max(1, (step.retries ?? 0) + 1)
    const retryDelay = step.retryDelay ?? 1000
    let lastError: string = ''

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (control.abort) {
        return { stepId: step.id, action: step.action, success: false, duration_ms: Date.now() - start, error: 'Workflow stopped' }
      }
      try {
        const output = await this.runAction(page, step, control, allResults, variables, profileId)
        return {
          stepId: step.id,
          action: step.action,
          success: true,
          duration_ms: Date.now() - start,
          output: attempt > 0 ? { ...output, retriedAfter: attempt } : output
        }
      } catch (err: any) {
        lastError = err.message
        if (attempt < maxAttempts - 1) {
          await new Promise((r) => setTimeout(r, retryDelay))
        }
      }
    }

    return {
      stepId: step.id,
      action: step.action,
      success: false,
      duration_ms: Date.now() - start,
      error: maxAttempts > 1 ? `Failed after ${maxAttempts} attempts: ${lastError}` : lastError
    }
  }

  private async runAction(
    page: Page,
    step: AutomationStep,
    control: DebugControl | { abort: boolean },
    allResults: AutomationStepResult[],
    variables: Record<string, string>,
    profileId?: string
  ): Promise<any> {
    const { action, params } = step

    switch (action) {
      case 'navigate':
        await page.goto(params.url, {
          waitUntil: params.waitUntil ?? 'networkidle2',
          timeout: params.timeout ?? 30000
        })
        return { url: params.url }

      case 'click':
        await page.waitForSelector(params.selector, { timeout: params.timeout ?? 10000 })
        await page.click(params.selector)
        return { selector: params.selector }

      case 'type':
        await page.waitForSelector(params.selector, { timeout: params.timeout ?? 10000 })
        if (params.clear) {
          await page.click(params.selector, { clickCount: 3 })
        }
        await page.type(params.selector, params.text, { delay: params.delay ?? 50 })
        return { selector: params.selector, length: params.text.length }

      case 'wait':
        await new Promise((r) => setTimeout(r, params.ms ?? 1000))
        return { waited_ms: params.ms ?? 1000 }

      case 'waitForSelector':
        await page.waitForSelector(params.selector, {
          visible: params.visible ?? true,
          timeout: params.timeout ?? 30000
        })
        return { selector: params.selector }

      case 'screenshot': {
        const buffer = await page.screenshot({
          fullPage: params.fullPage ?? false,
          type: 'png'
        })
        return { size: (buffer as Buffer).length }
      }

      case 'extractText': {
        const text = await page.$eval(
          params.selector,
          (el: Element) => el.textContent ?? ''
        )
        const trimmed = text.trim()
        if (params.saveAs) variables[params.saveAs] = trimmed
        return { text: trimmed }
      }

      case 'scroll':
        await page.evaluate(
          (x: number, y: number) => window.scrollBy(x, y),
          params.x ?? 0,
          params.y ?? params.amount ?? 500
        )
        return { scrolled: true }

      case 'select':
        await page.select(params.selector, params.value)
        return { selector: params.selector, value: params.value }

      case 'keyPress':
        await page.keyboard.press(params.key)
        return { key: params.key }

      case 'evaluate': {
        const result = await page.evaluate(params.script)
        if (params.saveAs) variables[params.saveAs] = String(result ?? '')
        return { result }
      }

      // ── Phase 4 actions ──────────────────────────────────────────────

      case 'hover':
        await page.waitForSelector(params.selector, { timeout: params.timeout ?? 10000 })
        await page.hover(params.selector)
        return { selector: params.selector }

      case 'rightClick':
        await page.waitForSelector(params.selector, { timeout: params.timeout ?? 10000 })
        await page.click(params.selector, { button: 'right' })
        return { selector: params.selector }

      case 'setAttribute':
        await page.waitForSelector(params.selector, { timeout: params.timeout ?? 10000 })
        await page.$eval(
          params.selector,
          (el: Element, attr: string, val: string) => el.setAttribute(attr, val),
          params.attribute,
          params.value
        )
        return { selector: params.selector, attribute: params.attribute, value: params.value }

      case 'httpRequest': {
        const response = await this.makeHttpRequest(
          params.url,
          params.method ?? 'GET',
          params.headers,
          params.body
        )
        if (params.saveAs) variables[params.saveAs] = response.body
        return response
      }

      // ── Phase 12.B.3: File transfer ──────────────────────────────────

      case 'upload': {
        // Upload a local file into a <input type="file"> element
        await page.waitForSelector(params.selector, { timeout: params.timeout ?? 10000 })
        const handle = (await page.$(params.selector)) as ElementHandle<HTMLInputElement> | null
        if (!handle) throw new Error(`Element not found: ${params.selector}`)
        // Verify the file exists before handing it to puppeteer (clearer error)
        try {
          await stat(params.filePath)
        } catch {
          throw new Error(`File not found: ${params.filePath}`)
        }
        await handle.uploadFile(params.filePath)
        return { selector: params.selector, filePath: params.filePath }
      }

      case 'download': {
        // Stream a remote URL to disk, reusing the active session's cookies
        // so authenticated downloads work. Falls back to no cookies if the
        // page isn't on the same origin.
        const result = await this.downloadToFile(page, params.url, params.savePath, params.timeout ?? 60000)
        return result
      }

      case 'conditional': {
        const conditionType: string = params.conditionType ?? 'selector-exists'
        let matched = false

        if (conditionType === 'selector-exists') {
          matched = !!(await page.$(params.selector).catch(() => null))
        } else if (conditionType === 'text-equals' || conditionType === 'text-contains') {
          const text: string = await page
            .$eval(params.selector, (el: Element) => el.textContent ?? '')
            .catch(() => '')
          const trimmed = text.trim()
          matched = conditionType === 'text-equals'
            ? trimmed === (params.expected ?? '')
            : trimmed.includes(params.expected ?? '')
        } else if (conditionType === 'js-truthy') {
          matched = !!(await page.evaluate(params.script ?? 'false'))
        }

        const branch = matched ? (params.thenSteps ?? []) : (params.elseSteps ?? [])
        if (branch.length > 0) {
          const branchStatus = await this.executeSteps(page, branch, control, allResults, variables)
          if (branchStatus === 'stopped') throw new Error('Workflow stopped')
          if (branchStatus === 'failed') throw new Error('Conditional branch failed')
        }
        return { conditionType, matched, branchSteps: branch.length }
      }

      case 'loop': {
        const times = params.times ?? 1
        const loopSteps: AutomationStep[] = params.steps ?? []
        let iterations = 0
        for (let i = 0; i < times; i++) {
          if (control.abort) throw new Error('Workflow stopped')
          const loopStatus = await this.executeSteps(page, loopSteps, control, allResults, variables)
          if (loopStatus === 'stopped') throw new Error('Workflow stopped')
          if (loopStatus === 'failed') throw new Error(`Loop iteration ${i + 1} failed`)
          iterations++
        }
        return { iterations, totalSteps: loopSteps.length * times }
      }

      // ── Phase 12.B.1: Captcha solving ───────────────────────────────

      case 'solveCaptcha': {
        // Resolve which provider + key to use. `params.provider` overrides
        // the global default; `params.apiKey` overrides the stored key.
        const settings = getSettings()
        const providerId: CaptchaProviderId =
          (params.provider as CaptchaProviderId) || settings.captcha.defaultProvider
        const apiKey: string = params.apiKey || settings.captcha.apiKeys[providerId] || ''
        if (!apiKey) {
          throw new Error(
            `Captcha provider "${providerId}" has no API key — configure it in Settings or pass apiKey in step params`
          )
        }
        const solver = getSolver(providerId)
        const pageUrl: string = params.pageUrl || page.url()
        const type: string = params.type || 'recaptcha-v2'

        let result: SolveResult
        switch (type) {
          case 'recaptcha-v2':
            result = await solver.solveRecaptchaV2(apiKey, {
              siteKey: params.siteKey,
              pageUrl,
              invisible: !!params.invisible
            })
            break
          case 'recaptcha-v3':
            result = await solver.solveRecaptchaV3(apiKey, {
              siteKey: params.siteKey,
              pageUrl,
              action: params.action || 'verify',
              minScore: params.minScore
            })
            break
          case 'hcaptcha':
            result = await solver.solveHCaptcha(apiKey, {
              siteKey: params.siteKey,
              pageUrl
            })
            break
          case 'image':
            result = await solver.solveImage(apiKey, { imageBase64: params.imageBase64 })
            break
          default:
            throw new Error(`Unknown captcha type: ${type}`)
        }

        // Persist the token into the live variables map so subsequent steps
        // can reference it via {captchaToken} (or whatever key was requested).
        const saveAs: string = params.saveAs || 'captchaToken'
        variables[saveAs] = result.token

        return {
          provider: result.provider,
          type: result.type,
          taskId: result.taskId,
          duration_ms: result.duration_ms,
          tokenLength: result.token.length,
          savedAs: saveAs
        }
      }

      // ── Phase 12.C.3: Vault-backed credential injection ─────────────
      case 'useCredential': {
        const vault = getVault()
        if (!vault.isUnlocked()) {
          throw new Error('Vault is locked — unlock it from the Settings page first')
        }
        const id: string | undefined = params.id
        const label: string | undefined = params.label
        let cred
        if (id) {
          cred = vault.get(id)
        } else if (label) {
          const list = vault.list()
          cred = list.find((c) => c.label === label)
          if (!cred) throw new Error(`Vault credential "${label}" not found`)
        } else {
          throw new Error('useCredential requires either id or label')
        }
        const prefix: string = params.prefix || 'cred'
        variables[`${prefix}.username`] = cred.username
        variables[`${prefix}.password`] = cred.password
        for (const [k, v] of Object.entries(cred.fields ?? {})) {
          variables[`${prefix}.${k}`] = String(v)
        }
        return {
          loaded: true,
          label: cred.label,
          prefix,
          fields: Object.keys(cred.fields ?? {}).length
        }
      }

      case 'injectCaptchaToken': {
        // Inject a previously-solved token into the standard reCAPTCHA / hCaptcha
        // hidden textarea so the form submit picks it up. Selector defaults to
        // the canonical reCAPTCHA hidden field.
        const token: string = params.token
        if (!token) throw new Error('injectCaptchaToken requires a token (use {captchaToken})')
        const selector: string = params.selector || '#g-recaptcha-response'
        const injected = await page.evaluate(
          (sel: string, value: string) => {
            const el = document.querySelector(sel) as HTMLTextAreaElement | HTMLInputElement | null
            if (!el) return { found: false, count: 0 }
            // Both reCAPTCHA and hCaptcha hide their textarea with display:none — set
            // the value directly and dispatch a synthetic event so any listeners notice.
            ;(el as any).value = value
            el.style.display = 'block'
            el.dispatchEvent(new Event('input', { bubbles: true }))
            el.dispatchEvent(new Event('change', { bubbles: true }))
            return { found: true, count: 1 }
          },
          selector,
          token
        )
        if (!injected.found) throw new Error(`Captcha target selector not found: ${selector}`)
        return { selector, tokenLength: token.length }
      }

      case 'doubleClick':
        await page.waitForSelector(params.selector, { timeout: params.timeout ?? 10000 })
        await page.click(params.selector, { clickCount: 2 })
        return { selector: params.selector }

      case 'waitForNavigation':
        await page.waitForNavigation({
          waitUntil: params.waitUntil ?? 'networkidle2',
          timeout: params.timeout ?? 30000
        })
        return { waitUntil: params.waitUntil ?? 'networkidle2' }

      // ── Tier 1: Workflow chaining ───────────────────────────────────
      case 'callWorkflow': {
        // Execute another workflow's steps inline using the current page
        // and variables map. Useful for building reusable sub-workflows
        // (login, cookie check, retry helpers).
        const targetId: string = params.workflowId
        if (!targetId) throw new Error('callWorkflow requires workflowId')

        const db = Database.getInstance()
        const row = db.getWorkflow(targetId)
        if (!row) throw new Error(`callWorkflow: workflow ${targetId} not found`)
        const subSteps: AutomationStep[] = JSON.parse(row.steps)
        const subVars: Record<string, string> =
          row.variables ? JSON.parse(row.variables) : {}

        // Optional input variables provided by the caller override the
        // sub-workflow's stored defaults but live in a scoped copy so
        // they don't leak back into the parent.
        const inputVars: Record<string, string> = params.inputVars ?? {}
        const childVars: Record<string, string> = {
          ...subVars,
          ...variables, // parent variables visible by default
          ...inputVars
        }

        const childResults: AutomationStepResult[] = []
        const childStatus = await this.executeSteps(
          page, subSteps, control, childResults, childVars
        )

        // Merge selected outputs back into parent variables under a prefix.
        const outputPrefix: string | undefined = params.outputPrefix
        if (outputPrefix) {
          for (const [k, v] of Object.entries(childVars)) {
            // Only export keys that didn't exist in the parent — these were
            // produced by the sub-workflow.
            if (!(k in variables)) {
              variables[`${outputPrefix}.${k}`] = v
            }
          }
        }

        if (childStatus === 'stopped') throw new Error('Sub-workflow stopped')
        if (childStatus === 'failed') {
          const failed = childResults.findLast((r) => !r.success)
          throw new Error(
            `Sub-workflow "${row.name}" failed${failed ? `: ${failed.error}` : ''}`
          )
        }
        return {
          workflowId: targetId,
          name: row.name,
          steps: childResults.length,
          status: childStatus
        }
      }

      // ── Tier 1: Parallel step execution ─────────────────────────────
      case 'parallelSteps': {
        // Run a list of independent steps concurrently against the same
        // page. The caller is responsible for ensuring the steps don't
        // race on the same DOM nodes — typical usage is N independent
        // extractText / httpRequest steps.
        const branchSteps: AutomationStep[] = params.steps ?? []
        if (branchSteps.length === 0) return { ran: 0 }

        const settled = await Promise.allSettled(
          branchSteps.map((s) => {
            const liveStep: AutomationStep = {
              ...s,
              params: interpolateParams(s.params, variables)
            }
            return this.executeStep(page, liveStep, control, allResults, variables, profileId)
          })
        )

        const results: AutomationStepResult[] = []
        let failures = 0
        for (let idx = 0; idx < settled.length; idx++) {
          const r = settled[idx]
          if (r.status === 'fulfilled') {
            results.push(r.value)
            if (!r.value.success) failures++
          } else {
            failures++
            results.push({
              stepId: branchSteps[idx].id,
              action: branchSteps[idx].action,
              success: false,
              duration_ms: 0,
              error: String(r.reason?.message ?? r.reason)
            })
          }
        }

        // Append child results to the parent results trail for visibility.
        for (const r of results) allResults.push(r)

        const failFast = params.failFast !== false // default true
        if (failures > 0 && failFast) {
          throw new Error(`parallelSteps: ${failures}/${results.length} step(s) failed`)
        }
        return { ran: results.length, failures }
      }

      // ── Tier 1: Output-driven branching ─────────────────────────────
      case 'jumpToStep': {
        // Conditionally instruct the runner to jump the cursor to another
        // step by id. Returns `jumpTo` in `output` which the executor
        // inspects to perform the jump.
        const conditionType: string =
          params.conditionType ?? 'var-equals'
        const variable: string = params.variable ?? ''
        const value: string = String(variables[variable] ?? '')
        const expected: string = String(params.expected ?? '')
        let matched = false

        switch (conditionType) {
          case 'always':
            matched = true
            break
          case 'var-equals':
            matched = value === expected
            break
          case 'var-not-equals':
            matched = value !== expected
            break
          case 'var-contains':
            matched = value.includes(expected)
            break
          case 'var-truthy':
            matched = value !== '' && value !== '0' && value !== 'false'
            break
          case 'var-empty':
            matched = value === '' || value === 'undefined' || value === 'null'
            break
          case 'var-gt':
            matched = Number(value) > Number(expected)
            break
          case 'var-lt':
            matched = Number(value) < Number(expected)
            break
          default:
            throw new Error(`Unknown jumpToStep conditionType: ${conditionType}`)
        }

        return {
          conditionType,
          variable,
          value,
          expected,
          matched,
          jumpTo: matched ? params.targetStepId : undefined
        }
      }

      // ── Tier 1: Network interception ────────────────────────────────
      case 'interceptRequest': {
        // Install a request interceptor for the active page. Multiple
        // rules can be added; each call appends a rule unless `replace`
        // is true. Tear down via `clearIntercepts` or workflow end.
        const rule: InterceptRule = {
          urlPattern: params.urlPattern ?? '*',
          action: params.action ?? 'block',
          status: params.status ?? 200,
          contentType: params.contentType ?? 'application/json',
          body: params.body ?? '',
          headers: params.headers ?? {}
        }
        const replace: boolean = params.replace === true

        const pid = profileId ?? '_anon'
        let state = this.intercepts.get(pid)

        if (!state || replace) {
          // Detach previous handler before re-installing
          if (state) {
            try { page.off('request', state.handler as any) } catch { /* noop */ }
          }
          await page.setRequestInterception(true).catch((err) => {
            throw new Error(`Failed to enable request interception: ${err.message}`)
          })

          const handler = (req: any) => {
            try {
              const url: string = req.url()
              const current = this.intercepts.get(pid)
              if (!current || !current.enabled) {
                req.continue().catch(() => { /* noop */ })
                return
              }
              // First matching rule wins
              const matched = current.rules.find((r) => globToRegex(r.urlPattern).test(url))
              if (!matched) {
                req.continue().catch(() => { /* noop */ })
                return
              }
              if (matched.action === 'block') {
                req.abort('blockedbyclient').catch(() => { /* noop */ })
              } else if (matched.action === 'mock') {
                req.respond({
                  status: matched.status ?? 200,
                  contentType: matched.contentType ?? 'application/json',
                  headers: matched.headers ?? {},
                  body: matched.body ?? ''
                }).catch(() => { /* noop */ })
              } else if (matched.action === 'modify') {
                // Forward but with modified headers
                req.continue({
                  headers: { ...req.headers(), ...(matched.headers ?? {}) }
                }).catch(() => { /* noop */ })
              } else {
                req.continue().catch(() => { /* noop */ })
              }
            } catch {
              try { req.continue() } catch { /* noop */ }
            }
          }

          state = { rules: replace ? [rule] : [rule], handler, enabled: true }
          page.on('request', handler)
          this.intercepts.set(pid, state)
        } else {
          state.rules.push(rule)
        }
        return { rules: state.rules.length, urlPattern: rule.urlPattern, action: rule.action }
      }

      case 'clearIntercepts': {
        const pid = profileId ?? '_anon'
        await this.teardownIntercepts(pid, page)
        return { cleared: true }
      }

      // ── Tier 1: Cookie management ───────────────────────────────────
      case 'getCookies': {
        const url: string | undefined = params.url
        const cookies = url
          ? await page.cookies(url)
          : await page.cookies()
        if (params.saveAs) {
          variables[params.saveAs] = JSON.stringify(cookies)
        }
        return { count: cookies.length, cookies }
      }

      case 'setCookies': {
        // Accept either a `cookies` array param or a JSON string in `json`
        let list: any[] = []
        if (Array.isArray(params.cookies)) list = params.cookies
        else if (typeof params.json === 'string' && params.json.trim()) {
          try { list = JSON.parse(params.json) } catch (err: any) {
            throw new Error(`setCookies: invalid JSON — ${err.message}`)
          }
        } else if (params.name) {
          list = [{
            name: params.name,
            value: params.value ?? '',
            domain: params.domain,
            path: params.path ?? '/',
            url: params.url,
            secure: params.secure,
            httpOnly: params.httpOnly,
            sameSite: params.sameSite,
            expires: params.expires
          }]
        }
        if (list.length === 0) throw new Error('setCookies: no cookies provided')
        // Strip undefined fields so puppeteer accepts the payload
        const cleaned = list.map((c) => {
          const out: Record<string, any> = {}
          for (const [k, v] of Object.entries(c)) if (v !== undefined) out[k] = v
          return out
        })
        await page.setCookie(...(cleaned as any[]))
        return { set: cleaned.length }
      }

      case 'deleteCookies': {
        // Delete by name (single or array). If `all` is true, clear every
        // cookie visible to the current page.
        if (params.all) {
          const all = await page.cookies()
          if (all.length > 0) await page.deleteCookie(...all)
          return { deleted: all.length, mode: 'all' }
        }
        const names: string[] = Array.isArray(params.names)
          ? params.names
          : params.name
            ? [params.name]
            : []
        if (names.length === 0) throw new Error('deleteCookies: provide name, names[], or all=true')
        const targets = names.map((n) => ({
          name: n,
          url: params.url,
          domain: params.domain,
          path: params.path
        }))
        await page.deleteCookie(...(targets as any[]))
        return { deleted: targets.length, names }
      }

      // ── Tier 3: Assertion framework ─────────────────────────────────
      case 'assert': {
        const assertType: AssertType = params.assertType ?? 'element-exists'
        const onFail: 'stop' | 'warn' | 'continue' = params.onFail ?? 'stop'
        let passed = false
        let actual: string | undefined
        let failureMessage = ''
        const expected: string = String(params.expected ?? '')

        switch (assertType) {
          case 'element-exists': {
            const el = await page.$(params.selector ?? '').catch(() => null)
            passed = el !== null
            actual = passed ? 'found' : 'not found'
            if (!passed) failureMessage = `Expected "${params.selector}" to exist`
            break
          }
          case 'element-not-exists': {
            const el = await page.$(params.selector ?? '').catch(() => null)
            passed = el === null
            actual = passed ? 'not found' : 'found'
            if (!passed) failureMessage = `Expected "${params.selector}" to NOT exist`
            break
          }
          case 'text-equals':
          case 'text-contains':
          case 'text-not-contains': {
            actual = await page
              .$eval(params.selector ?? 'body', (el: Element) => el.textContent ?? '')
              .catch(() => '')
            actual = actual.trim()
            if (assertType === 'text-equals') {
              passed = actual === expected
              if (!passed) failureMessage = `Expected text "${expected}", got "${actual}"`
            } else if (assertType === 'text-contains') {
              passed = actual.includes(expected)
              if (!passed) failureMessage = `Expected text to contain "${expected}", got "${actual}"`
            } else {
              passed = !actual.includes(expected)
              if (!passed) failureMessage = `Expected text NOT to contain "${expected}"`
            }
            break
          }
          case 'url-matches': {
            actual = page.url()
            const regex = new RegExp(expected)
            passed = regex.test(actual)
            if (!passed) failureMessage = `URL "${actual}" does not match /${expected}/`
            break
          }
          case 'url-contains': {
            actual = page.url()
            passed = actual.includes(expected)
            if (!passed) failureMessage = `URL "${actual}" does not contain "${expected}"`
            break
          }
          case 'variable-equals': {
            const varName: string = params.variable ?? ''
            actual = variables[varName] ?? ''
            passed = actual === expected
            if (!passed) failureMessage = `Variable "${varName}" is "${actual}", expected "${expected}"`
            break
          }
          case 'variable-contains': {
            const varName: string = params.variable ?? ''
            actual = variables[varName] ?? ''
            passed = actual.includes(expected)
            if (!passed) failureMessage = `Variable "${varName}" ("${actual}") does not contain "${expected}"`
            break
          }
          case 'variable-truthy': {
            const varName: string = params.variable ?? ''
            actual = variables[varName] ?? ''
            passed = actual !== '' && actual !== '0' && actual !== 'false' && actual !== 'null' && actual !== 'undefined'
            if (!passed) failureMessage = `Variable "${varName}" is falsy: "${actual}"`
            break
          }
          case 'element-count': {
            const els = await page.$$(params.selector ?? '')
            actual = String(els.length)
            const op: string = params.operator ?? 'eq'
            const count = Number(expected)
            if (op === 'eq') passed = els.length === count
            else if (op === 'gt') passed = els.length > count
            else if (op === 'gte') passed = els.length >= count
            else if (op === 'lt') passed = els.length < count
            else if (op === 'lte') passed = els.length <= count
            else passed = els.length === count
            if (!passed) failureMessage = `Expected ${params.selector} count ${op} ${count}, got ${els.length}`
            break
          }
          case 'page-title-contains': {
            actual = await page.title()
            passed = actual.includes(expected)
            if (!passed) failureMessage = `Page title "${actual}" does not contain "${expected}"`
            break
          }
          case 'js-truthy': {
            const result = await page.evaluate(params.script ?? 'false')
            actual = String(result)
            passed = !!result
            if (!passed) failureMessage = `Script returned falsy: ${actual}`
            break
          }
          default:
            throw new Error(`Unknown assertType: ${assertType}`)
        }

        const assertResult: AssertResult = {
          assertType,
          passed,
          failureMessage,
          actual,
          expected: expected || undefined
        }

        if (!passed) {
          if (onFail === 'stop') throw new Error(failureMessage || `Assertion failed: ${assertType}`)
          if (onFail === 'warn') {
            // Mark as succeeded but include failure info so the UI shows a warning badge
            return { ...assertResult, warning: true }
          }
          // onFail === 'continue': swallow, return failed result without throwing
          return { ...assertResult, continued: true }
        }
        return assertResult
      }

      default:
        throw new Error(`Unknown action: ${action}`)
    }
  }

  private makeHttpRequest(
    url: string,
    method: string,
    headers?: Record<string, string>,
    body?: string
  ): Promise<{ status: number; body: string }> {
    return new Promise((resolve, reject) => {
      const lib = url.startsWith('https') ? https : http
      const req = lib.request(url, { method, headers: headers ?? {} }, (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }))
      })
      req.on('error', reject)
      if (body) req.write(body)
      req.end()
    })
  }

  /**
   * Phase 12.B.3 — Stream a remote URL to a local file path.
   * Reuses cookies from the active page so authenticated downloads work
   * when the URL is on (or near) the same origin as the current page.
   */
  private async downloadToFile(
    page: Page,
    url: string,
    savePath: string,
    timeoutMs: number
  ): Promise<{ url: string; savePath: string; bytes: number; status: number }> {
    // Pull cookies the browser would send for this URL.
    let cookieHeader = ''
    try {
      const cookies = await page.cookies(url)
      if (cookies.length > 0) {
        cookieHeader = cookies.map((c: any) => `${c.name}=${c.value}`).join('; ')
      }
    } catch {
      // Non-fatal — proceed without cookies.
    }

    // Ensure parent directory exists.
    await mkdir(dirname(savePath), { recursive: true })

    const followRedirect = async (
      currentUrl: string,
      redirectsLeft: number
    ): Promise<{ status: number; bytes: number }> => {
      return new Promise((resolve, reject) => {
        let parsed: URL
        try {
          parsed = new URL(currentUrl)
        } catch (err) {
          reject(new Error(`Invalid URL: ${currentUrl}`))
          return
        }

        const lib = parsed.protocol === 'https:' ? https : http
        const headers: Record<string, string> = {}
        if (cookieHeader) headers['Cookie'] = cookieHeader

        const req = lib.request(
          parsed,
          { method: 'GET', headers, timeout: timeoutMs },
          (res) => {
            const status = res.statusCode ?? 0

            // Handle redirects (3xx with Location header)
            if (status >= 300 && status < 400 && res.headers.location) {
              res.resume()
              if (redirectsLeft <= 0) {
                reject(new Error(`Too many redirects fetching ${url}`))
                return
              }
              const next = new URL(res.headers.location, parsed).toString()
              followRedirect(next, redirectsLeft - 1).then(resolve, reject)
              return
            }

            if (status < 200 || status >= 300) {
              res.resume()
              reject(new Error(`Download failed: HTTP ${status}`))
              return
            }

            const out = createWriteStream(savePath)
            let bytes = 0
            res.on('data', (chunk: Buffer) => {
              bytes += chunk.length
            })
            res.pipe(out)
            out.on('finish', () => out.close(() => resolve({ status, bytes })))
            out.on('error', reject)
            res.on('error', reject)
          }
        )

        req.on('timeout', () => {
          req.destroy(new Error(`Download timed out after ${timeoutMs}ms`))
        })
        req.on('error', reject)
        req.end()
      })
    }

    const { status, bytes } = await followRedirect(url, 5)
    return { url, savePath, bytes, status }
  }

  /** Detach the request handler and disable interception on the page.
   *  Safe to call multiple times. */
  private async teardownIntercepts(profileId: string, page: Page | null): Promise<void> {
    const state = this.intercepts.get(profileId)
    if (!state) return
    state.enabled = false
    if (page) {
      try { page.off('request', state.handler as any) } catch { /* noop */ }
      try { await page.setRequestInterception(false) } catch { /* noop */ }
    }
    this.intercepts.delete(profileId)
  }

  private async getActivePage(profileId: string): Promise<Page | null> {
    const bm = BrowserManager.getInstance()
    const session = (bm as any).sessions.get(profileId)
    if (!session) return null

    const pages = await session.browser.pages()
    return pages.length > 0 ? pages[pages.length - 1] : null
  }
}
