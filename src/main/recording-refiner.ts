/**
 * Phase 17.C — Recording Refiner
 *
 * Batch AI pipeline that processes a RecordingAnalysis and applies a series of
 * improvements: healing fragile selectors, adding retry configs, wrapping risky
 * steps in tryCatch, generating step labels, and merging AI workflow metadata.
 *
 * Respects the existing Phase 16 AI rate-limit budget.
 */

import { v4 as uuidv4 } from 'uuid'
import { healSelector, explainStep, generateWorkflow } from './ai-assistant'
import type {
  RecordingAnalysis,
  RefinedRecording,
  RefinementSuggestion,
  RefineOptions,
  AutomationStep,
  SelectorQualityReport,
} from '../shared/types'

const DEFAULT_OPTIONS: Required<RefineOptions> = {
  healFragileSelectors: true,
  addRetryOnNetworkActions: true,
  addErrorHandlers: true,
  generateStepLabels: true,
  maxAiCalls: 20,
}

export class RecordingRefiner {
  async refine(
    analysis: RecordingAnalysis,
    options: Partial<RefineOptions> = {}
  ): Promise<RefinedRecording> {
    const opts: Required<RefineOptions> = { ...DEFAULT_OPTIONS, ...options }
    if (opts.maxAiCalls === undefined) {
      opts.maxAiCalls = Math.min(analysis.suggestedWorkflow.steps.length * 2, 30)
    }

    let steps: AutomationStep[] = analysis.suggestedWorkflow.steps.map((s) => ({ ...s }))
    const suggestions: RefinementSuggestion[] = []
    let aiCallsUsed = 0

    // ── Step 1: Heal fragile/brittle selectors ────────────────────────────────
    if (opts.healFragileSelectors) {
      const fragile = analysis.selectorQuality.filter(
        (q) => (q.quality === 'fragile' || q.quality === 'brittle') && !q.suggestedSelector
      )
      for (const q of fragile) {
        if (aiCallsUsed >= opts.maxAiCalls) break
        const step = steps[q.stepIndex]
        if (!step) continue
        try {
          const result = await healSelector(
            q.selector,
            '',  // no live DOM available at refine time — use domSnapshot if available
            `Step: ${step.label ?? step.action}`
          )
          aiCallsUsed++
          if (result.confidence !== 'low') {
            const before = { params: { ...step.params } }
            steps[q.stepIndex] = {
              ...step,
              params: { ...step.params, selector: result.suggestedSelector }
            }
            suggestions.push({
              stepId: step.id,
              type: 'selector-heal',
              before,
              after: { params: steps[q.stepIndex].params },
              reason: `Selector healed (${result.confidence} confidence): ${result.reasoning}`,
              applied: true
            })
          }
        } catch {
          // Non-fatal — continue with next selector
        }
      }
    }

    // ── Step 2: Add retry on steps with network requests ─────────────────────
    if (opts.addRetryOnNetworkActions) {
      const networkStepIndices = this.findNetworkStepIndices(analysis, steps)
      for (const idx of networkStepIndices) {
        const step = steps[idx]
        if (!step || step.retries) continue  // already has retry
        const before: Partial<AutomationStep> = { retries: step.retries, retryDelay: step.retryDelay }
        steps[idx] = { ...step, retries: 2, retryDelay: 1000, retryBackoff: 'exponential' }
        suggestions.push({
          stepId: step.id,
          type: 'add-retry',
          before,
          after: { retries: 2, retryDelay: 1000, retryBackoff: 'exponential' } as any,
          reason: 'Network request detected — added retry x2 with exponential backoff.',
          applied: true
        })
      }
    }

    // ── Step 3: Wrap risky step groups in tryCatch ────────────────────────────
    if (opts.addErrorHandlers) {
      steps = this.wrapRiskyGroups(steps, suggestions)
    }

    // ── Step 4: Generate step labels for unlabeled steps ─────────────────────
    if (opts.generateStepLabels) {
      for (let i = 0; i < steps.length; i++) {
        if (aiCallsUsed >= opts.maxAiCalls) break
        const step = steps[i]
        if (step.label && step.label !== step.action) continue
        try {
          const explanation = await explainStep(step)
          aiCallsUsed++
          const before = { label: step.label }
          const shortLabel = explanation.split('.')[0].slice(0, 60)
          steps[i] = { ...step, label: shortLabel }
          suggestions.push({
            stepId: step.id,
            type: 'step-fix',
            before,
            after: { label: shortLabel },
            reason: 'AI-generated step label.',
            applied: true
          })
        } catch {
          // Non-fatal
        }
      }
    }

    // ── Step 5: Generate workflow metadata via AI ─────────────────────────────
    let aiSummary = analysis.suggestedWorkflow.description ?? ''
    let aiNotes = ''
    if (aiCallsUsed < opts.maxAiCalls) {
      try {
        const recordingSummary = this.buildRecordingSummary(analysis)
        const result = await generateWorkflow(recordingSummary)
        aiCallsUsed++
        aiSummary = result.summary
        aiNotes = result.notes ?? ''
      } catch {
        // Non-fatal
      }
    }

    return {
      sessionId: analysis.sessionId,
      originalSteps: analysis.suggestedWorkflow.steps,
      refinedSteps: steps,
      appliedSuggestions: suggestions,
      summary: aiSummary,
      aiNotes,
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  /** Find step indices that had network activity during recording. */
  private findNetworkStepIndices(analysis: RecordingAnalysis, steps: AutomationStep[]): number[] {
    // Steps that follow a navigation or form submit are likely to trigger network
    const indices: number[] = []
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]
      if (step.action === 'navigate') indices.push(i)
      if (step.action === 'click' && i > 0) {
        const label = (step.label ?? '').toLowerCase()
        if (label.includes('submit') || label.includes('login') || label.includes('search') || label.includes('send')) {
          indices.push(i)
        }
      }
    }
    return [...new Set(indices)]
  }

  /** Wrap consecutive risky steps (login, form submit, navigation chains) in tryCatch. */
  private wrapRiskyGroups(steps: AutomationStep[], suggestions: RefinementSuggestion[]): AutomationStep[] {
    const result: AutomationStep[] = []
    let i = 0
    while (i < steps.length) {
      // Detect start of a risky group (navigate followed by type/click sequence)
      if (
        steps[i].action === 'navigate' &&
        i + 2 < steps.length &&
        (steps[i + 1]?.action === 'type' || steps[i + 1]?.action === 'click') &&
        !this.isAlreadyWrapped(steps[i])
      ) {
        // Collect 2–5 steps into a tryCatch group
        const groupEnd = Math.min(i + 5, steps.length)
        const bodySteps = steps.slice(i, groupEnd)
        const tryCatchStep: AutomationStep = {
          id: uuidv4(),
          action: 'tryCatch' as any,
          label: 'Try: ' + (steps[i].label ?? 'navigation flow'),
          params: {
            steps: bodySteps,
            catchSteps: [{
              id: uuidv4(),
              action: 'screenshot',
              label: 'Error screenshot',
              params: { path: `error-${Date.now()}.png` }
            }]
          }
        }
        suggestions.push({
          stepId: steps[i].id,
          type: 'add-error-handler',
          before: { action: steps[i].action },
          after: { action: 'tryCatch' } as any,
          reason: `Steps ${i + 1}–${groupEnd} wrapped in tryCatch (risky navigation/login flow).`,
          applied: true
        })
        result.push(tryCatchStep)
        i = groupEnd
      } else {
        result.push(steps[i])
        i++
      }
    }
    return result
  }

  private isAlreadyWrapped(step: AutomationStep): boolean {
    return (step.action as string) === 'tryCatch'
  }

  private buildRecordingSummary(analysis: RecordingAnalysis): string {
    const { rawStepCount, optimizedStepCount, extractedVariables, detectedPatterns, analysisNotes } = analysis
    return [
      `I have a recorded browser workflow with ${rawStepCount} steps (optimized to ${optimizedStepCount}).`,
      `Detected patterns: ${detectedPatterns.map((p) => p.description).join('; ') || 'none'}.`,
      `Extracted variables: ${extractedVariables.map((v) => v.name).join(', ') || 'none'}.`,
      `Notes: ${analysisNotes.join(' ')}`,
      `Generate a concise workflow name, description, and any important usage notes.`
    ].join(' ')
  }
}
