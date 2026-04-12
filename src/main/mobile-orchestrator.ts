import { v4 as uuidv4 } from 'uuid'
import { MobileWorkflowEngine } from './mobile-workflow-engine'
import { BrowserManager } from './browser-manager'
import { Database } from './database'
import type {
  MobileWorkflow,
  MobileExecutionResult,
  MobileBatchExecutionResult
} from '../shared/types'
import type { Page } from 'puppeteer-core'

/**
 * Phase 17: Cross-Device Orchestrator
 *
 * Manages execution of a mobile workflow across multiple profiles,
 * either in parallel or sequentially with configurable delays.
 */
export class MobileOrchestrator {
  private static instance: MobileOrchestrator

  static getInstance(): MobileOrchestrator {
    if (!MobileOrchestrator.instance) {
      MobileOrchestrator.instance = new MobileOrchestrator()
    }
    return MobileOrchestrator.instance
  }

  /**
   * Execute a workflow on multiple profiles.
   */
  async executeBatch(
    workflow: MobileWorkflow,
    profileIds: string[]
  ): Promise<MobileBatchExecutionResult> {
    const executionId = uuidv4()
    const engine = MobileWorkflowEngine.getInstance()
    const bm = BrowserManager.getInstance()
    const results: MobileExecutionResult[] = []

    const mode = workflow.deviceConfig.executionMode ?? 'sequential'

    if (mode === 'parallel') {
      const promises = profileIds.map(async (profileId) => {
        try {
          const page = await this.getOrLaunchPage(bm, profileId)
          if (!page) {
            return this.failedResult(executionId, workflow.id, profileId, 'Could not launch profile')
          }
          return await engine.executeWorkflow(workflow, profileId, page)
        } catch (err: any) {
          return this.failedResult(executionId, workflow.id, profileId, err.message)
        }
      })

      const settled = await Promise.allSettled(promises)
      for (const s of settled) {
        if (s.status === 'fulfilled') {
          results.push(s.value)
        }
      }
    } else {
      // Sequential
      for (const profileId of profileIds) {
        try {
          const page = await this.getOrLaunchPage(bm, profileId)
          if (!page) {
            results.push(this.failedResult(executionId, workflow.id, profileId, 'Could not launch profile'))
            if (workflow.deviceConfig.stopOnError) break
            continue
          }
          const result = await engine.executeWorkflow(workflow, profileId, page)
          results.push(result)

          if (!result.success && workflow.deviceConfig.stopOnError) break

          // Delay between profiles
          const delay = workflow.deviceConfig.delayBetweenProfiles
          if (delay && delay > 0) {
            await new Promise((r) => setTimeout(r, delay))
          }
        } catch (err: any) {
          results.push(this.failedResult(executionId, workflow.id, profileId, err.message))
          if (workflow.deviceConfig.stopOnError) break
        }
      }
    }

    const successCount = results.filter((r) => r.success).length
    const failCount = results.filter((r) => !r.success).length

    return {
      executionId,
      workflowId: workflow.id,
      executionMode: mode === 'parallel' ? 'parallel' : 'sequential',
      total: profileIds.length,
      successCount,
      failCount,
      results
    }
  }

  /**
   * Get existing active page or launch the profile.
   */
  private async getOrLaunchPage(bm: BrowserManager, profileId: string): Promise<Page | null> {
    // Check if profile is already active
    if (bm.isRunning(profileId)) {
      return bm.getActivePage(profileId)
    }

    // Launch the profile
    const db = Database.getInstance()
    const profile = db.getProfile(profileId)
    if (!profile) return null

    try {
      const fp = JSON.parse(profile.fingerprint)
      const proxy = profile.proxy_id ? db.getProxy(profile.proxy_id) : undefined
      await bm.launchProfile(profileId, fp, proxy ?? undefined)
      return bm.getActivePage(profileId)
    } catch {
      return null
    }
  }

  private failedResult(
    executionId: string,
    workflowId: string,
    profileId: string,
    error: string
  ): MobileExecutionResult {
    return {
      executionId,
      workflowId,
      profileId,
      deviceName: 'Unknown',
      success: false,
      duration: 0,
      steps: [],
      metrics: {
        tapCount: 0,
        swipeCount: 0,
        scrollCount: 0,
        longPressCount: 0,
        pinchCount: 0,
        totalDuration: 0,
        averageStepDuration: 0
      },
      error
    }
  }
}
