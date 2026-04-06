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
      for (const step of workflow.steps) {
        if (control.abort) {
          status = 'stopped'
          break
        }

        const result = await this.executeStep(page, step)
        stepResults.push(result)

        if (!result.success) {
          status = 'failed'
          runError = result.error
          break
        }
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

  stopWorkflow(workflowId: string, profileId: string): void {
    const runKey = `${workflowId}:${profileId}`
    const control = this.running.get(runKey)
    if (control) control.abort = true
  }

  isWorkflowRunning(workflowId: string, profileId: string): boolean {
    return this.running.has(`${workflowId}:${profileId}`)
  }

  private async executeStep(page: Page, step: AutomationStep): Promise<AutomationStepResult> {
    const start = Date.now()
    try {
      const output = await this.runAction(page, step)
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

  private async runAction(page: Page, step: AutomationStep): Promise<any> {
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

      default:
        throw new Error(`Unknown action: ${action}`)
    }
  }

  private async getActivePage(profileId: string): Promise<Page | null> {
    const bm = BrowserManager.getInstance()
    const session = (bm as any).sessions.get(profileId)
    if (!session) return null

    const pages = await session.browser.pages()
    return pages.length > 0 ? pages[pages.length - 1] : null
  }
}
