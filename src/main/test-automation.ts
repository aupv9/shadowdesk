/**
 * Automation Test Runner
 *
 * Simulates running workflows against profiles and tracks execution
 */

import fs from 'fs'
import path from 'path'

interface WorkflowAction {
  id: string
  type: string
  name: string
  params?: Record<string, any>
  timeout?: number
  retries?: number
  skipOnError?: boolean
}

interface Workflow {
  id: string
  name: string
  description: string
  profileIds: string[]
  steps: WorkflowAction[]
}

interface ExecutionResult {
  id: string
  workflowId: string
  workflowName: string
  profileId: string
  status: 'success' | 'failed' | 'partial' | 'running'
  stepResults: {
    stepId: string
    stepName: string
    type: string
    status: 'success' | 'failed' | 'skipped'
    duration: number
    error?: string
  }[]
  totalDuration: number
  executedAt: string
  completedAt?: string
}

class AutomationTestRunner {
  private workflows: Workflow[] = []
  private executions: ExecutionResult[] = []

  constructor() {
    this.loadWorkflows()
  }

  private loadWorkflows(): void {
    try {
      const workflowsPath = path.join(process.cwd(), 'testdata', 'automation-workflows.json')
      if (fs.existsSync(workflowsPath)) {
        this.workflows = JSON.parse(fs.readFileSync(workflowsPath, 'utf-8'))
        console.log(`✓ Loaded ${this.workflows.length} workflows\n`)
      }
    } catch (error) {
      console.error('Error loading workflows:', error)
      process.exit(1)
    }
  }

  async simulateWorkflowExecution(workflow: Workflow, profileId: string): Promise<ExecutionResult> {
    const executionId = `exec-${Date.now()}`
    const startTime = Date.now()
    const stepResults: ExecutionResult['stepResults'] = []
    let overallStatus: 'success' | 'failed' | 'partial' = 'success'

    console.log(`\n🔄 Executing: ${workflow.name}`)
    console.log(`   Profile: ${profileId.slice(0, 8)}...`)
    console.log(`   Steps: ${workflow.steps.length}\n`)

    for (const step of workflow.steps) {
      const stepStartTime = Date.now()
      const duration = Math.floor(Math.random() * 2000) + 500 // Simulate 0.5-2.5s per step

      // Simulate action execution
      let stepStatus: 'success' | 'failed' | 'skipped' = 'success'
      let error: string | undefined

      // Add randomness for more realistic simulation
      const failureChance = step.skipOnError ? 0.1 : 0.05
      if (Math.random() < failureChance) {
        if (step.retries && step.retries > 0) {
          stepStatus = 'success' // Recovered after retry
        } else if (step.skipOnError) {
          stepStatus = 'skipped'
          error = `Skipped due to error: ${step.type} action failed`
        } else {
          stepStatus = 'failed'
          error = `${step.type} action timed out after ${step.timeout || 5000}ms`
          overallStatus = 'failed'
        }
      }

      const icon = stepStatus === 'success' ? '✓' : stepStatus === 'failed' ? '✗' : '⊘'
      console.log(`   ${icon} ${step.name}`)
      console.log(`     Type: ${step.type} | Duration: ${duration}ms | Status: ${stepStatus}`)

      if (error) {
        console.log(`     Error: ${error}`)
      }

      stepResults.push({
        stepId: step.id,
        stepName: step.name,
        type: step.type,
        status: stepStatus,
        duration,
        error
      })

      // Simulate async delay
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    const totalDuration = Date.now() - startTime
    const successCount = stepResults.filter(s => s.status === 'success').length
    const failureCount = stepResults.filter(s => s.status === 'failed').length

    if (failureCount > 0 && successCount < stepResults.length / 2) {
      overallStatus = 'failed'
    } else if (failureCount > 0) {
      overallStatus = 'partial'
    }

    const execution: ExecutionResult = {
      id: executionId,
      workflowId: workflow.id,
      workflowName: workflow.name,
      profileId,
      status: overallStatus,
      stepResults,
      totalDuration,
      executedAt: new Date().toISOString(),
      completedAt: new Date().toISOString()
    }

    console.log(`\n   ✨ Completed: ${overallStatus.toUpperCase()} (${totalDuration}ms)`)
    console.log(`   ✓ ${successCount}/${stepResults.length} steps successful`)

    this.executions.push(execution)
    return execution
  }

  async runAllWorkflows(): Promise<void> {
    console.log('=' + '='.repeat(60))
    console.log('ShadowDesk Automation Test Suite')
    console.log('=' + '='.repeat(60))
    console.log(`\n📊 Running ${this.workflows.length} workflows...\n`)

    const startTime = Date.now()
    const profileIds = Array.from(
      new Set(this.workflows.flatMap(w => w.profileIds))
    ).slice(0, 2) // Run with first 2 unique profiles

    for (const workflow of this.workflows) {
      const profileId = workflow.profileIds[0] || profileIds[0]
      await this.simulateWorkflowExecution(workflow, profileId)
    }

    const duration = Date.now() - startTime
    this.printSummary(duration)
    this.saveResults()
  }

  private printSummary(duration: number): void {
    const successful = this.executions.filter(e => e.status === 'success').length
    const failed = this.executions.filter(e => e.status === 'failed').length
    const partial = this.executions.filter(e => e.status === 'partial').length

    const totalSteps = this.executions.reduce((sum, e) => sum + e.stepResults.length, 0)
    const successfulSteps = this.executions.reduce(
      (sum, e) => sum + e.stepResults.filter(s => s.status === 'success').length,
      0
    )

    const avgDuration =
      this.executions.reduce((sum, e) => sum + e.totalDuration, 0) / this.executions.length

    console.log('\n' + '='.repeat(60))
    console.log('Execution Summary')
    console.log('='.repeat(60))
    console.log(`✓ Successful Workflows: ${successful}`)
    console.log(`✗ Failed Workflows: ${failed}`)
    console.log(`⊘ Partial Workflows: ${partial}`)
    console.log(`📊 Overall Success Rate: ${((successful / this.executions.length) * 100).toFixed(1)}%`)
    console.log(`\n📈 Step Statistics:`)
    console.log(`   Total Steps: ${totalSteps}`)
    console.log(`   Successful: ${successfulSteps}`)
    console.log(`   Success Rate: ${((successfulSteps / totalSteps) * 100).toFixed(1)}%`)
    console.log(`\n⏱ Performance:`)
    console.log(`   Total Duration: ${(duration / 1000).toFixed(2)}s`)
    console.log(`   Average Workflow: ${(avgDuration / 1000).toFixed(2)}s`)
    console.log(`   Total Workflows: ${this.executions.length}`)

    if (failed > 0) {
      console.log(`\n❌ Failed Workflows:`)
      this.executions
        .filter(e => e.status === 'failed')
        .forEach(e => {
          console.log(`   • ${e.workflowName}`)
          const failedSteps = e.stepResults.filter(s => s.status === 'failed')
          failedSteps.forEach(s => {
            console.log(`     - ${s.stepName}: ${s.error}`)
          })
        })
    }

    console.log('')
  }

  private saveResults(): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const resultsFile = path.join(
      process.cwd(),
      'testdata',
      `automation-test-results-${timestamp}.json`
    )

    fs.writeFileSync(resultsFile, JSON.stringify(this.executions, null, 2))
    console.log(`📄 Results saved to: ${resultsFile}\n`)

    // Also create a summary report
    const reportFile = path.join(
      process.cwd(),
      'testdata',
      `automation-test-report-${timestamp}.json`
    )

    const report = {
      timestamp: new Date().toISOString(),
      totalWorkflows: this.workflows.length,
      totalExecutions: this.executions.length,
      successfulWorkflows: this.executions.filter(e => e.status === 'success').length,
      failedWorkflows: this.executions.filter(e => e.status === 'failed').length,
      partialWorkflows: this.executions.filter(e => e.status === 'partial').length,
      totalSteps: this.executions.reduce((sum, e) => sum + e.stepResults.length, 0),
      successfulSteps: this.executions.reduce(
        (sum, e) => sum + e.stepResults.filter(s => s.status === 'success').length,
        0
      ),
      actionTypes: Array.from(
        new Set(
          this.executions.flatMap(e => e.stepResults.map(s => s.type))
        )
      ),
      workflowSummary: this.workflows.map(w => ({
        name: w.name,
        description: w.description,
        stepCount: w.steps.length,
        profileCount: w.profileIds.length,
        execution: this.executions.find(e => e.workflowId === w.id)
      }))
    }

    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2))
    console.log(`📋 Report saved to: ${reportFile}`)
  }
}

// Run tests
const runner = new AutomationTestRunner()
runner.runAllWorkflows()
