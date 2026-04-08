/**
 * Phase 17.B — Script Analyzer
 *
 * Detects patterns, extracts variables, optimizes waits, and assesses selector
 * quality from a raw RecordingSession. Produces a RecordingAnalysis that is
 * ready for AI refinement (Phase 17.C) or direct use.
 */

import { v4 as uuidv4 } from 'uuid'
import type {
  RecordingSession,
  RecordedEvent,
  RecordingAnalysis,
  DetectedPattern,
  ExtractedVariable,
  WaitOptimization,
  SelectorQualityReport,
  AutomationStep,
  AutomationWorkflow,
} from '../shared/types'

export class ScriptAnalyzer {
  analyze(session: RecordingSession): RecordingAnalysis {
    const rawSteps = this.eventsToSteps(session.events)
    const detectedPatterns = [
      ...this.detectLoops(rawSteps, session.events),
      ...this.detectFormGroups(rawSteps),
      ...this.detectNavigationChains(rawSteps),
    ]
    const extractedVariables = this.extractVariables(rawSteps, session.events)
    const waitOptimizations = this.optimizeWaits(rawSteps, session.events)
    const selectorQuality = this.assessSelectorQuality(rawSteps)

    // Apply high-confidence patterns and auto-apply variables
    const optimizedSteps = this.applyPatterns(rawSteps.map((s) => ({ ...s })), detectedPatterns)
    const finalSteps = this.applyVariables(optimizedSteps, extractedVariables, true)

    const analysisNotes: string[] = []
    if (detectedPatterns.some((p) => p.type === 'loop')) {
      analysisNotes.push(`${detectedPatterns.filter((p) => p.type === 'loop').length} repeating loop(s) detected and collapsed.`)
    }
    if (extractedVariables.length > 0) {
      analysisNotes.push(`${extractedVariables.length} variable(s) extracted (${extractedVariables.filter((v) => v.autoApply).length} auto-applied).`)
    }
    const fragile = selectorQuality.filter((s) => s.quality === 'fragile' || s.quality === 'brittle')
    if (fragile.length > 0) {
      analysisNotes.push(`${fragile.length} fragile/brittle selector(s) detected — AI refinement recommended.`)
    }

    const now = new Date().toISOString()
    const suggestedWorkflow: AutomationWorkflow = {
      id: uuidv4(),
      name: `Recording — ${session.pageTitle ?? session.startUrl ?? new Date(session.startedAt).toLocaleString()}`,
      description: `Auto-generated from recording session started at ${session.startedAt}.`,
      steps: finalSteps,
      variables: Object.fromEntries(extractedVariables.filter((v) => v.autoApply).map((v) => [v.name, v.value])),
      created_at: now,
      updated_at: now,
    }

    return {
      sessionId: session.id,
      rawStepCount: rawSteps.length,
      optimizedStepCount: finalSteps.length,
      detectedPatterns,
      extractedVariables,
      waitOptimizations,
      selectorQuality,
      suggestedWorkflow,
      analysisNotes,
    }
  }

  // ── Raw step conversion ─────────────────────────────────────────────────────

  eventsToSteps(events: RecordedEvent[]): AutomationStep[] {
    const steps: AutomationStep[] = []
    for (const ev of events) {
      switch (ev.type) {
        case 'navigate':
          steps.push({ id: uuidv4(), action: 'navigate', label: ev.label || `Navigate to ${ev.url}`, params: { url: ev.url ?? '' } })
          break
        case 'click':
          steps.push({ id: uuidv4(), action: 'click', label: ev.label || `Click ${ev.selector}`, params: { selector: ev.selector } })
          break
        case 'input':
          steps.push({ id: uuidv4(), action: 'type', label: ev.label || `Type into ${ev.selector}`, params: { selector: ev.selector, text: ev.value ?? '' } })
          break
        case 'change':
          steps.push({
            id: uuidv4(),
            action: ev.tag === 'select' ? 'select' : 'type',
            label: ev.label || (ev.tag === 'select' ? `Select ${ev.value}` : `Set ${ev.selector}`),
            params: { selector: ev.selector, ...(ev.tag === 'select' ? { value: ev.value ?? '' } : { text: ev.value ?? '' }) }
          })
          break
        case 'submit':
          steps.push({ id: uuidv4(), action: 'click', label: ev.label || `Submit ${ev.selector}`, params: { selector: ev.selector } })
          break
        case 'scroll':
          steps.push({ id: uuidv4(), action: 'scroll', label: ev.label || 'Scroll page', params: { y: ev.value ? parseInt(ev.value, 10) : 300 } })
          break
        case 'keypress':
          steps.push({ id: uuidv4(), action: 'keyPress', label: ev.label || `Press ${ev.value}`, params: { key: ev.value ?? 'Enter' } })
          break
      }
    }
    return steps
  }

  // ── Pattern detection ───────────────────────────────────────────────────────

  private detectLoops(steps: AutomationStep[], events: RecordedEvent[]): DetectedPattern[] {
    const patterns: DetectedPattern[] = []
    if (steps.length < 4) return patterns

    // Look for repeating selector sequences (minimum 2 repetitions)
    for (let seqLen = 2; seqLen <= Math.floor(steps.length / 2); seqLen++) {
      let i = 0
      while (i + seqLen * 2 <= steps.length) {
        const seqA = steps.slice(i, i + seqLen)
        const seqB = steps.slice(i + seqLen, i + seqLen * 2)
        if (this.sequenceSimilarity(seqA, seqB) >= 0.8) {
          // Count total repetitions
          let reps = 2
          let j = i + seqLen * 2
          while (j + seqLen <= steps.length) {
            const seqC = steps.slice(j, j + seqLen)
            if (this.sequenceSimilarity(seqA, seqC) >= 0.8) { reps++; j += seqLen } else break
          }
          const stepIndices: number[] = []
          for (let k = i; k < i + seqLen * reps; k++) stepIndices.push(k)
          patterns.push({
            type: 'loop',
            stepIndices,
            confidence: Math.min(0.95, 0.6 + (reps - 2) * 0.15 + seqLen * 0.05),
            description: `${reps} repetitions of a ${seqLen}-step sequence detected (steps ${i + 1}–${i + seqLen * reps}).`
          })
          i = i + seqLen * reps // skip past the matched block
        } else {
          i++
        }
      }
    }

    // URL increment pattern: /page/1, /page/2 → pagination
    const navSteps = steps.filter((s) => s.action === 'navigate')
    if (navSteps.length >= 2) {
      const urls = navSteps.map((s) => s.params?.url as string ?? '')
      const pagingMatch = urls.every((u, idx) => {
        if (idx === 0) return true
        return u.replace(/\d+/, '{n}') === urls[0].replace(/\d+/, '{n}')
      })
      if (pagingMatch && urls.length >= 2) {
        const navIndices = steps.reduce<number[]>((acc, s, idx) => { if (s.action === 'navigate') acc.push(idx); return acc }, [])
        patterns.push({
          type: 'navigation-chain',
          stepIndices: navIndices,
          confidence: 0.75,
          description: `Pagination pattern detected across ${navSteps.length} navigate steps.`
        })
      }
    }

    return patterns
  }

  private sequenceSimilarity(a: AutomationStep[], b: AutomationStep[]): number {
    if (a.length !== b.length) return 0
    let matches = 0
    for (let i = 0; i < a.length; i++) {
      if (a[i].action === b[i].action) matches++
      if (a[i].params?.selector && b[i].params?.selector &&
          a[i].params.selector.replace(/\d+/g, '#') === b[i].params.selector.replace(/\d+/g, '#')) {
        matches += 0.5
      }
    }
    return matches / (a.length * 1.5)
  }

  private detectFormGroups(steps: AutomationStep[]): DetectedPattern[] {
    const patterns: DetectedPattern[] = []
    let groupStart = -1
    let groupCount = 0

    for (let i = 0; i < steps.length; i++) {
      const s = steps[i]
      const isInput = s.action === 'type' || s.action === 'select'
      if (isInput) {
        if (groupStart === -1) groupStart = i
        groupCount++
      } else {
        if (groupCount >= 3) {
          const indices: number[] = []
          for (let k = groupStart; k < i; k++) indices.push(k)
          patterns.push({
            type: 'form-group',
            stepIndices: indices,
            confidence: 0.8,
            description: `Form group: ${groupCount} consecutive input/select steps (steps ${groupStart + 1}–${i}).`
          })
        }
        groupStart = -1
        groupCount = 0
      }
    }
    if (groupCount >= 3) {
      const indices: number[] = []
      for (let k = groupStart; k < steps.length; k++) indices.push(k)
      patterns.push({
        type: 'form-group',
        stepIndices: indices,
        confidence: 0.8,
        description: `Form group: ${groupCount} consecutive input/select steps at end of recording.`
      })
    }

    return patterns
  }

  private detectNavigationChains(steps: AutomationStep[]): DetectedPattern[] {
    const patterns: DetectedPattern[] = []
    const navIndices: number[] = []
    for (let i = 0; i < steps.length; i++) {
      if (steps[i].action === 'navigate') navIndices.push(i)
    }
    if (navIndices.length >= 3) {
      patterns.push({
        type: 'navigation-chain',
        stepIndices: navIndices,
        confidence: 0.65,
        description: `${navIndices.length} navigation steps — consider parameterizing with {targetUrl} variable.`
      })
    }
    return patterns
  }

  // ── Variable extraction ─────────────────────────────────────────────────────

  private extractVariables(steps: AutomationStep[], events: RecordedEvent[]): ExtractedVariable[] {
    const vars: ExtractedVariable[] = []
    const seen = new Map<string, number[]>()

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]
      const ev = events[i]

      // URL variables
      if (step.action === 'navigate' && step.params?.url) {
        const url = step.params.url as string
        if (url && url !== 'about:blank') {
          const key = `url::${url}`
          if (!seen.has(key)) seen.set(key, [])
          seen.get(key)!.push(i)
        }
      }

      // Credential variables (email/password inputs)
      if (step.action === 'type' && ev) {
        const selector = step.params?.selector as string ?? ''
        const text = step.params?.text as string ?? ''
        const tag = ev.tag ?? ''

        if (selector.includes('type="password"') || selector.includes('[type=password]') || ev.label?.toLowerCase().includes('password')) {
          if (!vars.find((v) => v.type === 'credential' && v.name === 'password')) {
            vars.push({ name: 'password', value: text || '••••••', occurrences: [i], type: 'credential', confidence: 0.95, autoApply: false })
          }
        } else if (
          selector.includes('email') || selector.includes('username') || selector.includes('user') ||
          (tag === 'input' && (ev.label?.toLowerCase().includes('email') || ev.label?.toLowerCase().includes('user')))
        ) {
          if (!vars.find((v) => v.name === 'username')) {
            vars.push({ name: 'username', value: text, occurrences: [i], type: 'credential', confidence: 0.9, autoApply: false })
          }
        } else if (text) {
          // Numeric value
          if (/^\d+$/.test(text) && parseInt(text, 10) > 1) {
            const key = `num::${text}`
            if (!seen.has(key)) seen.set(key, [])
            seen.get(key)!.push(i)
          }
          // Date string
          if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
            const key = `date::${text}`
            if (!seen.has(key)) seen.set(key, [])
            seen.get(key)!.push(i)
          }
          // Repeated text value
          const key = `text::${text}`
          if (!seen.has(key)) seen.set(key, [])
          seen.get(key)!.push(i)
        }
      }
    }

    // URL variables: first occurrence only, high confidence
    for (const [key, occurrences] of seen.entries()) {
      const [type, value] = key.split('::') as [string, string]
      if (type === 'url' && occurrences.length === 1) {
        const existing = vars.find((v) => v.type === 'url' && v.value === value)
        if (!existing) {
          vars.push({
            name: 'targetUrl',
            value,
            occurrences,
            type: 'url',
            confidence: 0.85,
            autoApply: true
          })
        }
      }
      if (type === 'num') {
        vars.push({
          name: `quantity_${value}`,
          value,
          occurrences,
          type: 'numeric',
          confidence: 0.7,
          autoApply: false
        })
      }
      if (type === 'date') {
        vars.push({
          name: 'targetDate',
          value,
          occurrences,
          type: 'date',
          confidence: 0.85,
          autoApply: true
        })
      }
      if (type === 'text' && occurrences.length >= 2) {
        const varName = `sharedValue_${vars.length}`
        vars.push({
          name: varName,
          value,
          occurrences,
          type: 'text-input',
          confidence: 0.75,
          autoApply: false
        })
      }
    }

    return vars
  }

  // ── Wait optimization ───────────────────────────────────────────────────────

  private optimizeWaits(steps: AutomationStep[], events: RecordedEvent[]): WaitOptimization[] {
    const opts: WaitOptimization[] = []
    for (let i = 0; i < steps.length; i++) {
      const ev = events[i]
      const timingMs = ev?.timingMs ?? 0
      const step = steps[i]

      if (timingMs === 0) continue

      if (timingMs < 300) {
        opts.push({ stepIndex: i, originalTimingMs: timingMs, suggestedWaitMs: 0, strategy: 'no-wait', reason: 'Very fast interaction — no wait needed.' })
      } else if (timingMs > 2000 && i > 0 && steps[i - 1]?.action === 'navigate') {
        opts.push({ stepIndex: i, originalTimingMs: timingMs, suggestedWaitMs: 0, strategy: 'waitForSelector', reason: 'Long pause after navigation — insert waitForSelector before this step.' })
      } else if (timingMs >= 300 && timingMs <= 2000) {
        const tag = ev?.tag
        if (tag === 'button' || tag === 'input[type=submit]' || step.action === 'click') {
          opts.push({ stepIndex: i, originalTimingMs: timingMs, suggestedWaitMs: 500, strategy: 'fixed-wait', reason: 'Moderate pause after click — use fixed 500ms wait.' })
        }
      }
    }
    return opts
  }

  // ── Selector quality assessment ─────────────────────────────────────────────

  private assessSelectorQuality(steps: AutomationStep[]): SelectorQualityReport[] {
    const reports: SelectorQualityReport[] = []
    const selectorActions = new Set(['click', 'type', 'waitForSelector', 'extractText', 'select', 'hover', 'doubleClick', 'rightClick', 'setAttribute', 'upload'])

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]
      if (!selectorActions.has(step.action)) continue
      const selector = step.params?.selector as string
      if (!selector) continue

      let quality: SelectorQualityReport['quality']
      let reason: string

      if (/^#[a-zA-Z_][\w-]*$/.test(selector)) {
        quality = 'excellent'; reason = 'ID selector — highly stable.'
      } else if (selector.startsWith('[data-testid=') || selector.startsWith('[data-test=')) {
        quality = 'excellent'; reason = 'data-testid attribute — explicitly set for testing.'
      } else if (selector.startsWith('[name=') || selector.startsWith('input[name=') || selector.startsWith('select[name=')) {
        quality = 'good'; reason = 'name attribute — stable in forms.'
      } else if (selector.includes('[aria-label=')) {
        quality = 'good'; reason = 'aria-label attribute — generally stable.'
      } else if (/nth-of-type\(\d+\)/.test(selector) || /nth-child\(\d+\)/.test(selector)) {
        quality = 'brittle'; reason = 'Position-based selector — breaks on DOM structure changes.'
      } else if (selector.split('>').length > 3) {
        quality = 'fragile'; reason = 'Deep descendant chain — fragile if layout changes.'
      } else if (/\.\w/.test(selector) && !selector.startsWith('[')) {
        quality = 'fragile'; reason = 'Class-based selector — may break on CSS refactors.'
      } else {
        quality = 'good'; reason = 'Reasonable selector.'
      }

      reports.push({ stepIndex: i, selector, quality, reason })
    }
    return reports
  }

  // ── Apply patterns & variables ──────────────────────────────────────────────

  applyPatterns(steps: AutomationStep[], patterns: DetectedPattern[]): AutomationStep[] {
    // Only apply loop patterns with high confidence (≥ 0.75)
    const loopPatterns = patterns.filter((p) => p.type === 'loop' && p.confidence >= 0.75)
    if (loopPatterns.length === 0) return steps

    const skipIndices = new Set<number>()
    const result: AutomationStep[] = []

    for (const pattern of loopPatterns) {
      pattern.stepIndices.forEach((idx) => skipIndices.add(idx))
    }

    let i = 0
    while (i < steps.length) {
      const loopPattern = loopPatterns.find((p) => p.stepIndices[0] === i)
      if (loopPattern) {
        // Determine body (first repetition length)
        const bodyLen = Math.floor(loopPattern.stepIndices.length / 2)
        const reps = Math.round(loopPattern.stepIndices.length / bodyLen)
        const bodySteps = steps.slice(i, i + bodyLen)
        result.push({
          id: uuidv4(),
          action: 'loop',
          label: `Loop ${reps} times`,
          params: { count: reps, steps: bodySteps }
        })
        i += loopPattern.stepIndices.length
      } else if (skipIndices.has(i)) {
        i++
      } else {
        result.push(steps[i])
        i++
      }
    }
    return result
  }

  applyVariables(steps: AutomationStep[], vars: ExtractedVariable[], autoOnly: boolean): AutomationStep[] {
    const toApply = autoOnly ? vars.filter((v) => v.autoApply) : vars
    if (toApply.length === 0) return steps

    return steps.map((step, idx) => {
      const matching = toApply.filter((v) => v.occurrences.includes(idx))
      if (matching.length === 0) return step

      const newStep = { ...step, params: { ...step.params } }
      for (const v of matching) {
        if (newStep.params?.url && String(newStep.params.url) === v.value) {
          newStep.params = { ...newStep.params, url: `{${v.name}}` }
        }
        if (newStep.params?.text && String(newStep.params.text) === v.value) {
          newStep.params = { ...newStep.params, text: `{${v.name}}` }
        }
      }
      return newStep
    })
  }
}
