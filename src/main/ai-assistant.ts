/**
 * Phase 16 — AI-Assisted Automation
 *
 * Central service for all LLM-powered features:
 *   16.A  Natural Language Workflow Builder  — generateWorkflow, explainStep, fixStep
 *   16.B  AI Detection Advisor               — analyzeDetection
 *   16.C  Smart Selector Healing             — healSelector
 *   16.D  Behaviour Pattern Library          — getBehaviorArchetypes (static catalog)
 *
 * Architecture:
 *   Renderer ──IPC──▶ Main Process ──HTTPS──▶ Anthropic API
 *   API key lives in settings.json (main process only, never forwarded to renderer).
 *
 * Rate limiting: max `settings.ai.maxCallsPerSession` LLM calls per session.
 * Uses claude-sonnet-4-6 for generation tasks, claude-haiku-4-5 for low-latency tasks.
 */

import Anthropic from '@anthropic-ai/sdk'
import { v4 as uuidv4 } from 'uuid'
import { getSettings, updateSettings } from './settings'
import type {
  AutomationStep,
  AiUsageStatus,
  AiRecommendation,
  AiDetectionAdvice,
  AiWorkflowResult,
  AiSelectorHealResult,
  BehaviorArchetype,
  DetectionVectorResult
} from '../shared/types'

// ── Built-in Behaviour Archetypes (Phase 16.D) ────────────────────────────────

const BEHAVIOR_ARCHETYPES: BehaviorArchetype[] = [
  {
    id: 'casual-browser',
    name: 'Casual Browser',
    description: 'Relaxed, slow-paced browsing. Reads pages thoroughly, pauses frequently.',
    typingWpm: [30, 50],
    mouseSpeed: 0.7,
    scrollStep: 120,
    actionPause: [1500, 4000],
    idleDrift: true,
    icon: 'Coffee',
    tags: ['slow', 'human', 'reader']
  },
  {
    id: 'speed-typer',
    name: 'Speed Typer',
    description: 'Fast, confident typing with minimal pauses. Experienced user.',
    typingWpm: [90, 130],
    mouseSpeed: 1.4,
    scrollStep: 200,
    actionPause: [300, 800],
    idleDrift: false,
    icon: 'Zap',
    tags: ['fast', 'confident', 'experienced']
  },
  {
    id: 'mobile-user',
    name: 'Mobile User',
    description: 'Short sessions, thumb-friendly scrolling, hesitant taps. Typical smartphone usage.',
    typingWpm: [20, 40],
    mouseSpeed: 0.9,
    scrollStep: 300,
    actionPause: [800, 2500],
    idleDrift: true,
    icon: 'Smartphone',
    tags: ['mobile', 'touch', 'short-session']
  },
  {
    id: 'power-user',
    name: 'Power User',
    description: 'Efficient, keyboard-heavy. Uses shortcuts, scans rather than reads.',
    typingWpm: [70, 100],
    mouseSpeed: 1.6,
    scrollStep: 400,
    actionPause: [200, 600],
    idleDrift: false,
    icon: 'Terminal',
    tags: ['keyboard', 'shortcuts', 'efficient']
  },
  {
    id: 'cautious-reader',
    name: 'Cautious Reader',
    description: 'Reads everything before clicking. Long pauses, precise mouse movements.',
    typingWpm: [25, 45],
    mouseSpeed: 0.5,
    scrollStep: 80,
    actionPause: [3000, 8000],
    idleDrift: true,
    icon: 'Eye',
    tags: ['careful', 'methodical', 'slow']
  },
  {
    id: 'business-professional',
    name: 'Business Professional',
    description: 'Focused task execution. Minimal distraction, direct navigation.',
    typingWpm: [55, 75],
    mouseSpeed: 1.1,
    scrollStep: 150,
    actionPause: [500, 1500],
    idleDrift: false,
    icon: 'Briefcase',
    tags: ['focused', 'business', 'direct']
  },
  {
    id: 'young-social',
    name: 'Young Social User',
    description: 'Rapid scrolling, frequent taps, short dwell times. Social media native.',
    typingWpm: [60, 90],
    mouseSpeed: 1.3,
    scrollStep: 500,
    actionPause: [200, 700],
    idleDrift: false,
    icon: 'MessageCircle',
    tags: ['social', 'young', 'fast-scroll']
  },
  {
    id: 'elderly-user',
    name: 'Elderly User',
    description: 'Slow, deliberate movements. Frequent pauses, careful with clicks.',
    typingWpm: [15, 30],
    mouseSpeed: 0.4,
    scrollStep: 60,
    actionPause: [4000, 10000],
    idleDrift: true,
    icon: 'UserCheck',
    tags: ['slow', 'careful', 'deliberate']
  },
  {
    id: 'gamer',
    name: 'Gamer',
    description: 'Reflexive, precise mouse control. Quick decisive clicks, minimal reading.',
    typingWpm: [80, 120],
    mouseSpeed: 2.0,
    scrollStep: 250,
    actionPause: [150, 500],
    idleDrift: false,
    icon: 'Gamepad2',
    tags: ['precise', 'fast', 'reflexive']
  },
  {
    id: 'researcher',
    name: 'Researcher',
    description: 'Multi-tab browsing, deep reading, frequent copy-paste. Academic pattern.',
    typingWpm: [50, 70],
    mouseSpeed: 0.8,
    scrollStep: 100,
    actionPause: [2000, 6000],
    idleDrift: true,
    icon: 'BookOpen',
    tags: ['academic', 'reader', 'multi-tab']
  },
  // ── Phase 17 — SEA Regional Archetypes ─────────────────────────────────
  {
    id: 'sea-mobile-shopper',
    name: 'SEA Mobile Shopper',
    description:
      'Vietnam / Thailand / Indonesia smartphone shopper. Rapid vertical scroll, hesitant tap-to-buy, flash-sale-aware.',
    typingWpm: [28, 48],
    mouseSpeed: 1.0,
    scrollStep: 320,
    actionPause: [700, 2200],
    idleDrift: true,
    icon: 'ShoppingBag',
    tags: ['sea', 'mobile', 'shopper', 'shopee', 'lazada']
  },
  {
    id: 'sea-live-commerce-viewer',
    name: 'SEA Live Commerce Viewer',
    description:
      'TikTok / Shopee Live viewer profile — long dwell, occasional comment burst, rare taps.',
    typingWpm: [35, 60],
    mouseSpeed: 0.8,
    scrollStep: 100,
    actionPause: [3000, 12000],
    idleDrift: true,
    icon: 'Video',
    tags: ['sea', 'live', 'tiktok', 'dwell', 'social']
  },
  {
    id: 'sea-bank-customer',
    name: 'SEA Bank Customer',
    description:
      'Cautious VNPay / bank portal user. Slow, careful typing — reads every field before moving on.',
    typingWpm: [25, 40],
    mouseSpeed: 0.6,
    scrollStep: 90,
    actionPause: [2500, 6500],
    idleDrift: true,
    icon: 'Landmark',
    tags: ['sea', 'payment', 'vnpay', 'banking', 'cautious']
  }
]

// ── Session rate-limit counter ────────────────────────────────────────────────

let sessionCallCount = 0

function incrementCall(): void {
  sessionCallCount++
  // Persist to settings so the UI can display it
  const s = getSettings()
  updateSettings({ ai: { ...s.ai } } as any)
}

function checkRateLimit(): void {
  const s = getSettings()
  const max = s.ai?.maxCallsPerSession ?? 20
  if (sessionCallCount >= max) {
    throw new Error(
      `AI rate limit reached — ${max} calls per session. Restart the app to reset.`
    )
  }
}

// ── Anthropic client factory ──────────────────────────────────────────────────

function getClient(): Anthropic {
  const s = getSettings()
  const key = s.ai?.apiKey ?? ''
  if (!key) {
    throw new Error('AI API key is not configured — add your Anthropic API key in Settings → AI Assistant.')
  }
  if (!s.ai?.enabled) {
    throw new Error('AI features are disabled — enable them in Settings → AI Assistant.')
  }
  return new Anthropic({ apiKey: key })
}

// ── 16.A: Natural Language Workflow Builder ───────────────────────────────────

const WORKFLOW_SYSTEM_PROMPT = `You are an expert web automation assistant for ShadowDesk anti-detect browser.
Generate automation workflows as JSON arrays of steps.

Each step must have:
- id: unique string (use step-1, step-2, etc.)
- action: one of: navigate, click, type, wait, waitForSelector, screenshot, extractText, scroll, select, keyPress, evaluate, conditional, loop, hover, rightClick, doubleClick, waitForNavigation, setAttribute, httpRequest, upload, download, solveCaptcha, injectCaptchaToken, useCredential
- label: short human-readable description
- params: object with action-specific parameters

Common params:
- navigate: { url, waitUntil? }
- click: { selector, timeout? }
- type: { selector, text, delay?, clear? }
- wait: { ms }
- waitForSelector: { selector, visible?, timeout? }
- extractText: { selector, saveAs? }
- scroll: { x?, y? }

Respond with valid JSON only:
{
  "summary": "Brief description of what the workflow does",
  "steps": [...],
  "notes": "Optional caveats or assumptions"
}

Use CSS selectors. Prefer IDs, then data attributes, then semantic selectors.
Never use brittle positional selectors like nth-child unless no alternative exists.`

export async function generateWorkflow(
  prompt: string,
  pageHtml?: string
): Promise<AiWorkflowResult> {
  checkRateLimit()
  const client = getClient()

  const userContent = pageHtml
    ? `Task: ${prompt}\n\nCurrent page HTML snapshot (first 8000 chars):\n${pageHtml.slice(0, 8000)}`
    : `Task: ${prompt}`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: WORKFLOW_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }]
  })
  incrementCall()

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Model did not return valid JSON for workflow generation')

  const parsed = JSON.parse(jsonMatch[0])

  // Ensure each step has a unique id
  const steps: AutomationStep[] = (parsed.steps ?? []).map((s: any, i: number) => ({
    id: s.id ?? `step-${i + 1}-${uuidv4().slice(0, 8)}`,
    action: s.action,
    label: s.label,
    params: s.params ?? {}
  }))

  return {
    summary: parsed.summary ?? 'Generated workflow',
    steps,
    notes: parsed.notes
  }
}

export async function explainStep(step: AutomationStep): Promise<string> {
  checkRateLimit()
  const client = getClient()

  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 256,
    system: 'You are a web automation expert. Explain automation steps in plain English for non-technical users. Be concise (1-2 sentences).',
    messages: [
      {
        role: 'user',
        content: `Explain this automation step: ${JSON.stringify(step, null, 2)}`
      }
    ]
  })
  incrementCall()

  return response.content[0].type === 'text'
    ? response.content[0].text.trim()
    : 'Could not generate explanation.'
}

export async function fixStep(step: AutomationStep, errorMessage: string): Promise<AutomationStep> {
  checkRateLimit()
  const client = getClient()

  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 512,
    system: `You are a web automation debugger. Given a failing step and its error, return a corrected step as JSON.
Respond ONLY with a valid JSON object matching the AutomationStep shape:
{ "id": string, "action": string, "label": string, "params": object }`,
    messages: [
      {
        role: 'user',
        content: `Failing step:\n${JSON.stringify(step, null, 2)}\n\nError: ${errorMessage}\n\nReturn the fixed step as JSON.`
      }
    ]
  })
  incrementCall()

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Model did not return a valid step fix')

  const fixed = JSON.parse(jsonMatch[0])
  return {
    id: step.id,
    action: fixed.action ?? step.action,
    label: fixed.label ?? step.label,
    params: fixed.params ?? step.params,
    retries: step.retries,
    retryDelay: step.retryDelay
  }
}

// ── 16.B: AI Detection Advisor ────────────────────────────────────────────────

const DETECTION_SYSTEM_PROMPT = `You are a browser fingerprint security expert specialising in anti-detect technology.
Given a list of detection vector results, analyse which vectors are failing or suspicious and explain exactly how to fix them.

Respond with valid JSON only:
{
  "overallSummary": "1-2 sentence assessment",
  "riskLevel": "low" | "medium" | "high",
  "recommendations": [
    {
      "title": "Short fix title",
      "explanation": "Why this vector looks suspicious and how to fix it",
      "priority": 1,
      "fieldPath": "optional.field.path",
      "suggestedValue": "optional suggested value"
    }
  ]
}

Priority 1 = most critical. Return at most 5 recommendations, ordered by priority.`

export async function analyzeDetection(
  vectors: DetectionVectorResult[],
  overallScore: number
): Promise<AiDetectionAdvice> {
  checkRateLimit()
  const client = getClient()

  const failedVectors = vectors.filter((v) => !v.passed)
  const summary = `Overall score: ${overallScore}/100. ${failedVectors.length} vectors failing out of ${vectors.length}.`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: DETECTION_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `${summary}\n\nVector results:\n${JSON.stringify(vectors, null, 2)}`
      }
    ]
  })
  incrementCall()

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Model did not return valid JSON for detection analysis')

  const parsed = JSON.parse(jsonMatch[0])
  return {
    overallSummary: parsed.overallSummary ?? 'Analysis complete.',
    riskLevel: parsed.riskLevel ?? 'medium',
    recommendations: (parsed.recommendations ?? []).slice(0, 5).map((r: any): AiRecommendation => ({
      title: r.title ?? 'Fix recommendation',
      explanation: r.explanation ?? '',
      priority: r.priority ?? 2,
      fieldPath: r.fieldPath,
      suggestedValue: r.suggestedValue
    }))
  }
}

// ── 16.C: Smart Selector Healing ──────────────────────────────────────────────

export async function healSelector(
  originalSelector: string,
  pageHtml: string,
  context?: string
): Promise<AiSelectorHealResult> {
  checkRateLimit()
  const client = getClient()

  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 512,
    system: `You are a CSS selector debugging expert. Given a broken selector and the current page DOM, suggest a working replacement.
Respond with valid JSON only:
{
  "suggestedSelector": "new CSS selector",
  "confidence": "high" | "medium" | "low",
  "reasoning": "Why the original broke and why the new one works"
}`,
    messages: [
      {
        role: 'user',
        content: [
          `Broken selector: ${originalSelector}`,
          context ? `Context: ${context}` : '',
          `Page HTML (first 6000 chars):\n${pageHtml.slice(0, 6000)}`
        ].filter(Boolean).join('\n\n')
      }
    ]
  })
  incrementCall()

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Model did not return a valid selector suggestion')

  const parsed = JSON.parse(jsonMatch[0])
  return {
    originalSelector,
    suggestedSelector: parsed.suggestedSelector ?? originalSelector,
    confidence: parsed.confidence ?? 'medium',
    reasoning: parsed.reasoning ?? ''
  }
}

// ── 16.D: Behaviour Pattern Library ──────────────────────────────────────────

export function getBehaviorArchetypes(): BehaviorArchetype[] {
  return BEHAVIOR_ARCHETYPES
}

export function getBehaviorArchetype(id: string): BehaviorArchetype | undefined {
  return BEHAVIOR_ARCHETYPES.find((a) => a.id === id)
}

// ── Status / admin ────────────────────────────────────────────────────────────

export function getAiStatus(): AiUsageStatus {
  const s = getSettings()
  return {
    callsUsed: sessionCallCount,
    callsMax: s.ai?.maxCallsPerSession ?? 20,
    configured: !!(s.ai?.apiKey),
    enabled: s.ai?.enabled ?? false
  }
}

export function setAiApiKey(apiKey: string): void {
  const s = getSettings()
  updateSettings({ ai: { ...s.ai, apiKey } })
}

export function setAiEnabled(enabled: boolean): void {
  const s = getSettings()
  updateSettings({ ai: { ...s.ai, enabled } })
}

export function resetSessionCallCount(): void {
  sessionCallCount = 0
}
