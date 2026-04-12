import { v4 as uuidv4 } from 'uuid'
import { Database } from './database'
import { DetectionTestRunner } from './detection-test'
import type {
  BatchTestRun,
  BatchResultsSummary,
  BatchTestProgress,
  CreateBatchTestInput,
  DetectionTestResult
} from '../shared/types'

/**
 * Phase 19.1 — Batch Test Service
 *
 * Orchestrates detection tests across multiple profiles in parallel,
 * tracks progress, aggregates results, and identifies the most common
 * failing vectors across the profile pool.
 */
export class BatchTestService {
  private static instance: BatchTestService
  private activeBatches = new Map<string, BatchTestProgress>()

  static getInstance(): BatchTestService {
    if (!BatchTestService.instance) {
      BatchTestService.instance = new BatchTestService()
    }
    return BatchTestService.instance
  }

  /**
   * Create and immediately start a batch test run.
   * Tests run sequentially to avoid overwhelming the system with
   * too many browser instances.
   */
  async createAndRun(input: CreateBatchTestInput): Promise<BatchTestRun> {
    const db = Database.getInstance()
    const batchId = uuidv4()
    const now = new Date().toISOString()

    const batch: BatchTestRun = {
      id: batchId,
      name: input.name || `Batch Test ${now.slice(0, 10)}`,
      status: 'running',
      test_type: input.testType,
      profile_ids: input.profileIds,
      total_profiles: input.profileIds.length,
      completed_count: 0,
      failed_count: 0,
      avg_score: 0,
      started_at: now,
      completed_at: null,
      results_summary: null
    }

    db.createBatchTestRun(batch)

    // Track progress
    this.activeBatches.set(batchId, {
      batchId,
      completed: 0,
      total: input.profileIds.length,
      currentProfileId: null,
      currentProfileName: null
    })

    // Run tests asynchronously — don't await so the IPC call returns immediately
    this.executeBatch(batchId, input.profileIds).catch((err) => {
      console.error(`[BatchTestService] Batch ${batchId} failed:`, err)
      db.updateBatchTestRun(batchId, { status: 'failed' })
    })

    return batch
  }

  private async executeBatch(batchId: string, profileIds: string[]): Promise<void> {
    const db = Database.getInstance()
    const runner = DetectionTestRunner.getInstance()
    const results: DetectionTestResult[] = []
    let failedCount = 0

    for (const profileId of profileIds) {
      // Check if cancelled
      const currentBatch = db.getBatchTestRun(batchId)
      if (currentBatch?.status === 'cancelled') {
        this.activeBatches.delete(batchId)
        return
      }

      const profile = db.getProfile(profileId) as any

      // Update progress
      const progress = this.activeBatches.get(batchId)
      if (progress) {
        progress.currentProfileId = profileId
        progress.currentProfileName = profile?.name ?? profileId
      }

      try {
        const result = await runner.runTest(profileId)
        results.push(result)
      } catch (err) {
        failedCount++
        console.warn(`[BatchTestService] Profile ${profileId} test failed:`, err)
      }

      // Update DB progress
      const completedCount = results.length + failedCount
      db.updateBatchTestRun(batchId, {
        completed_count: completedCount,
        failed_count: failedCount
      })

      if (progress) {
        progress.completed = completedCount
      }
    }

    // Generate summary
    const summary = this.buildSummary(results)
    const avgScore = results.length > 0
      ? Math.round(results.reduce((s, r) => s + r.overallScore, 0) / results.length)
      : 0

    db.updateBatchTestRun(batchId, {
      status: 'completed',
      completed_count: results.length + failedCount,
      failed_count: failedCount,
      avg_score: avgScore,
      completed_at: new Date().toISOString(),
      results_summary: JSON.stringify(summary)
    })

    this.activeBatches.delete(batchId)
  }

  private buildSummary(results: DetectionTestResult[]): BatchResultsSummary {
    if (results.length === 0) {
      return {
        avgScore: 0, minScore: 0, maxScore: 0,
        passedCount: 0, warningCount: 0, failedCount: 0,
        vectorFailRates: {}, topFailingVectors: []
      }
    }

    const scores = results.map((r) => r.overallScore)
    const vectorFails: Record<string, number> = {}

    for (const result of results) {
      for (const v of result.vectors) {
        if (!v.passed) {
          vectorFails[v.name] = (vectorFails[v.name] || 0) + 1
        }
      }
    }

    // Convert to failure rates (0-1)
    const vectorFailRates: Record<string, number> = {}
    for (const [name, count] of Object.entries(vectorFails)) {
      vectorFailRates[name] = count / results.length
    }

    // Top failing vectors sorted by failure rate descending
    const topFailingVectors = Object.entries(vectorFailRates)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name]) => name)

    return {
      avgScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      minScore: Math.min(...scores),
      maxScore: Math.max(...scores),
      passedCount: results.filter((r) => r.status === 'passed').length,
      warningCount: results.filter((r) => r.status === 'warning').length,
      failedCount: results.filter((r) => r.status === 'failed').length,
      vectorFailRates,
      topFailingVectors
    }
  }

  /** Get live progress for a running batch */
  getProgress(batchId: string): BatchTestProgress | null {
    return this.activeBatches.get(batchId) ?? null
  }

  /** Cancel a running batch test */
  cancel(batchId: string): void {
    const db = Database.getInstance()
    db.updateBatchTestRun(batchId, { status: 'cancelled' })
    this.activeBatches.delete(batchId)
  }

  /** List all batch test runs */
  list(limit: number = 50): BatchTestRun[] {
    return Database.getInstance().listBatchTestRuns(limit)
  }

  /** Get a single batch test run by ID */
  get(batchId: string): BatchTestRun | null {
    return Database.getInstance().getBatchTestRun(batchId)
  }

  /** Delete a batch test run */
  delete(batchId: string): void {
    Database.getInstance().deleteBatchTestRun(batchId)
  }
}
