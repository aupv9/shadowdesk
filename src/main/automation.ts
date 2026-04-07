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
  AutomationWorkflow
} from '../shared/types'
import type { Page, ElementHandle } from 'puppeteer-core'
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

export class AutomationEngine {
  private static instance: AutomationEngine
  private running = new Map<string, { abort: boolean }>()

  static getInstance(): AutomationEngine {
    if (!AutomationEngine.instance) {
      AutomationEngine.instance = new AutomationEngine()
    }
    return AutomationEngine.instance
  }

  async executeWorkflow(
    workflowId: string,
    profileId: string,
    runtimeVars?: Record<string, string>
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

    // Merge stored variables with runtime overrides
    const variables: Record<string, string> = { ...(workflow.variables ?? {}), ...(runtimeVars ?? {}) }

    if (!bm.isRunning(profileId)) {
      throw new Error('Profile must be launched before running automation')
    }

    const page = await this.getActivePage(profileId)
    if (!page) throw new Error('No active page found for profile')

    const runKey = `${workflowId}:${profileId}`
    const control = { abort: false }
    this.running.set(runKey, control)

    const startedAt = new Date().toISOString()
    const stepResults: AutomationStepResult[] = []
    let status: 'completed' | 'failed' | 'stopped' = 'completed'
    let runError: string | undefined

    try {
      // Variables are interpolated lazily per-step (not upfront), so actions
      // like `solveCaptcha` can write into the map and have subsequent steps
      // pick up the new values via {captchaToken}-style placeholders.
      const result = await this.executeSteps(page, workflow.steps, control, stepResults, variables)
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

    // Persist run to DB
    db.addWorkflowRun({
      id: uuidv4(),
      workflow_id: workflowId,
      profile_id: profileId,
      status,
      step_results: stepResults,
      error: runError,
      completed_at: completedAt
    })

    return runResult
  }

  /** Execute a list of steps, collecting results. Returns overall status. */
  private async executeSteps(
    page: Page,
    steps: AutomationStep[],
    control: { abort: boolean },
    stepResults: AutomationStepResult[],
    variables: Record<string, string>
  ): Promise<'completed' | 'failed' | 'stopped'> {
    for (const step of steps) {
      if (control.abort) return 'stopped'

      // Interpolate this step's params lazily — variables may have been
      // mutated by an earlier step (e.g. solveCaptcha → {captchaToken}).
      const liveStep: AutomationStep = {
        ...step,
        params: interpolateParams(step.params, variables)
      }

      const result = await this.executeStep(page, liveStep, control, stepResults, variables)
      stepResults.push(result)

      if (!result.success) return 'failed'
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
    concurrency: number = 5
  ): Promise<AutomationRunResult[]> {
    if (profileIds.length === 0) return []

    const results: AutomationRunResult[] = []
    // Run in batches of `concurrency` so we don't overwhelm the host with
    // many simultaneous browser sessions.
    for (let i = 0; i < profileIds.length; i += concurrency) {
      const batch = profileIds.slice(i, i + concurrency)
      const settled = await Promise.allSettled(
        batch.map((pid) => this.executeWorkflow(workflowId, pid, runtimeVars))
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
    control: { abort: boolean },
    allResults: AutomationStepResult[],
    variables: Record<string, string>
  ): Promise<AutomationStepResult> {
    const start = Date.now()
    try {
      const output = await this.runAction(page, step, control, allResults, variables)
      return {
        stepId: step.id,
        action: step.action,
        success: true,
        duration_ms: Date.now() - start,
        output
      }
    } catch (err: any) {
      return {
        stepId: step.id,
        action: step.action,
        success: false,
        duration_ms: Date.now() - start,
        error: err.message
      }
    }
  }

  private async runAction(
    page: Page,
    step: AutomationStep,
    control: { abort: boolean },
    allResults: AutomationStepResult[],
    variables: Record<string, string>
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
        return { text: text.trim() }
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
        // Evaluate condition: check if selector exists on page
        const exists = await page.$(params.selector).then((el: any) => !!el)
        const branch = exists ? (params.thenSteps ?? []) : (params.elseSteps ?? [])
        if (branch.length > 0) {
          const branchStatus = await this.executeSteps(page, branch, control, allResults, variables)
          if (branchStatus === 'stopped') throw new Error('Workflow stopped')
          if (branchStatus === 'failed') throw new Error('Conditional branch failed')
        }
        return { condition: params.selector, matched: exists, branchSteps: branch.length }
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

  private async getActivePage(profileId: string): Promise<Page | null> {
    const bm = BrowserManager.getInstance()
    const session = (bm as any).sessions.get(profileId)
    if (!session) return null

    const pages = await session.browser.pages()
    return pages.length > 0 ? pages[pages.length - 1] : null
  }
}
