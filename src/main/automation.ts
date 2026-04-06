import { v4 as uuidv4 } from 'uuid'
import { BrowserManager } from './browser-manager'
import { Database } from './database'
import type {
  AutomationStep,
  AutomationStepResult,
  AutomationRunResult,
  AutomationWorkflow
} from '../shared/types'
import type { Page } from 'puppeteer-core'
import http from 'http'
import https from 'https'

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
    profileId: string
  ): Promise<AutomationRunResult> {
    const db = Database.getInstance()
    const bm = BrowserManager.getInstance()

    const workflowRow = db.getWorkflow(workflowId)
    if (!workflowRow) throw new Error(`Workflow ${workflowId} not found`)

    const workflow: AutomationWorkflow = {
      ...workflowRow,
      steps: JSON.parse(workflowRow.steps)
    }

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
      const result = await this.executeSteps(page, workflow.steps, control, stepResults)
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
    stepResults: AutomationStepResult[]
  ): Promise<'completed' | 'failed' | 'stopped'> {
    for (const step of steps) {
      if (control.abort) return 'stopped'

      const result = await this.executeStep(page, step, control, stepResults)
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

  private async executeStep(
    page: Page,
    step: AutomationStep,
    control: { abort: boolean },
    allResults: AutomationStepResult[]
  ): Promise<AutomationStepResult> {
    const start = Date.now()
    try {
      const output = await this.runAction(page, step, control, allResults)
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
    allResults: AutomationStepResult[]
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

      case 'conditional': {
        // Evaluate condition: check if selector exists on page
        const exists = await page.$(params.selector).then((el: any) => !!el)
        const branch = exists ? (params.thenSteps ?? []) : (params.elseSteps ?? [])
        if (branch.length > 0) {
          const branchStatus = await this.executeSteps(page, branch, control, allResults)
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
          const loopStatus = await this.executeSteps(page, loopSteps, control, allResults)
          if (loopStatus === 'stopped') throw new Error('Workflow stopped')
          if (loopStatus === 'failed') throw new Error(`Loop iteration ${i + 1} failed`)
          iterations++
        }
        return { iterations, totalSteps: loopSteps.length * times }
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

  private async getActivePage(profileId: string): Promise<Page | null> {
    const bm = BrowserManager.getInstance()
    const session = (bm as any).sessions.get(profileId)
    if (!session) return null

    const pages = await session.browser.pages()
    return pages.length > 0 ? pages[pages.length - 1] : null
  }
}
