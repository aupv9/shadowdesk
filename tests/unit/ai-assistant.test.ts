import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Helper: build a mock Anthropic messages.create response ────────────────

function makeLlmResponse(jsonPayload: unknown): any {
  return {
    content: [{ type: 'text', text: JSON.stringify(jsonPayload) }]
  }
}

// ── Mock factories (reset per test via vi.doMock inside freshModule) ───────

const mockCreate = vi.fn()

async function freshModule(settingsOverrides: Record<string, any> = {}) {
  vi.resetModules()

  const defaultAi = {
    apiKey: 'test-key',
    enabled: true,
    maxCallsPerSession: 100
  }

  const mergedAi = { ...defaultAi, ...settingsOverrides }

  vi.doMock('@anthropic-ai/sdk', () => {
    return {
      default: class Anthropic {
        messages = { create: mockCreate }
      }
    }
  })

  vi.doMock('../../src/main/settings', () => ({
    getSettings: vi.fn(() => ({ ai: mergedAi })),
    updateSettings: vi.fn()
  }))

  // uuid — provide deterministic stub so test assertions are stable
  vi.doMock('uuid', () => ({
    v4: () => 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
  }))

  const mod = await import('../../src/main/ai-assistant')
  // Always start with a clean session counter
  mod.resetSessionCallCount()
  return mod
}

// ── 1. getBehaviorArchetypes ────────────────────────────────────────────────

describe('getBehaviorArchetypes', () => {
  it('returns an array of 13 archetypes', async () => {
    const { getBehaviorArchetypes } = await freshModule()
    const archetypes = getBehaviorArchetypes()
    expect(archetypes).toHaveLength(13)
  })

  it('each archetype has all required fields', async () => {
    const { getBehaviorArchetypes } = await freshModule()
    const requiredKeys = [
      'id', 'name', 'description', 'typingWpm', 'mouseSpeed',
      'scrollStep', 'actionPause', 'idleDrift', 'icon', 'tags'
    ]
    for (const a of getBehaviorArchetypes()) {
      for (const key of requiredKeys) {
        expect(a).toHaveProperty(key)
      }
    }
  })

  it('contains the casual-browser archetype', async () => {
    const { getBehaviorArchetypes } = await freshModule()
    const ids = getBehaviorArchetypes().map((a) => a.id)
    expect(ids).toContain('casual-browser')
  })

  it('contains SEA regional archetypes', async () => {
    const { getBehaviorArchetypes } = await freshModule()
    const ids = getBehaviorArchetypes().map((a) => a.id)
    expect(ids).toContain('sea-mobile-shopper')
    expect(ids).toContain('sea-live-commerce-viewer')
    expect(ids).toContain('sea-bank-customer')
  })
})

// ── 2. getBehaviorArchetype ─────────────────────────────────────────────────

describe('getBehaviorArchetype', () => {
  it('returns the archetype matching the given id', async () => {
    const { getBehaviorArchetype } = await freshModule()
    const arch = getBehaviorArchetype('speed-typer')
    expect(arch).toBeDefined()
    expect(arch!.name).toBe('Speed Typer')
  })

  it('returns undefined for an unknown id', async () => {
    const { getBehaviorArchetype } = await freshModule()
    expect(getBehaviorArchetype('does-not-exist')).toBeUndefined()
  })
})

// ── 3. getAiStatus ──────────────────────────────────────────────────────────

describe('getAiStatus', () => {
  it('returns status with all required fields', async () => {
    const { getAiStatus } = await freshModule()
    const status = getAiStatus()
    expect(status).toHaveProperty('callsUsed')
    expect(status).toHaveProperty('callsMax')
    expect(status).toHaveProperty('configured')
    expect(status).toHaveProperty('enabled')
  })

  it('configured is true when apiKey is set', async () => {
    const { getAiStatus } = await freshModule()
    expect(getAiStatus().configured).toBe(true)
  })

  it('configured is false when apiKey is empty', async () => {
    const { getAiStatus } = await freshModule({ apiKey: '' })
    expect(getAiStatus().configured).toBe(false)
  })

  it('enabled reflects the settings value', async () => {
    const mod = await freshModule({ enabled: false })
    expect(mod.getAiStatus().enabled).toBe(false)
  })
})

// ── 4. resetSessionCallCount ────────────────────────────────────────────────

describe('resetSessionCallCount', () => {
  it('resets callsUsed to 0', async () => {
    const mod = await freshModule()
    // Make an LLM call to bump the counter
    mockCreate.mockResolvedValueOnce(makeLlmResponse({ summary: 'ok', steps: [] }))
    await mod.generateWorkflow('test prompt')
    expect(mod.getAiStatus().callsUsed).toBeGreaterThan(0)

    mod.resetSessionCallCount()
    expect(mod.getAiStatus().callsUsed).toBe(0)
  })
})

// ── 5. generateWorkflow ─────────────────────────────────────────────────────

describe('generateWorkflow', () => {
  beforeEach(() => {
    mockCreate.mockReset()
  })

  it('returns steps array and summary from the LLM response', async () => {
    const mod = await freshModule()
    mockCreate.mockResolvedValueOnce(
      makeLlmResponse({
        summary: 'Login to example.com',
        steps: [
          { id: 'step-1', action: 'navigate', label: 'Go to site', params: { url: 'https://example.com' } },
          { id: 'step-2', action: 'click', label: 'Click login', params: { selector: '#login' } }
        ],
        notes: 'Assumes login page is loaded'
      })
    )

    const result = await mod.generateWorkflow('Log in to example.com')
    expect(result.summary).toBe('Login to example.com')
    expect(result.steps).toHaveLength(2)
    expect(result.notes).toBe('Assumes login page is loaded')
  })

  it('assigns unique ids to steps that lack one', async () => {
    const mod = await freshModule()
    mockCreate.mockResolvedValueOnce(
      makeLlmResponse({
        summary: 'Workflow',
        steps: [
          { action: 'navigate', label: 'Go', params: { url: 'https://example.com' } },
          { action: 'click', label: 'Click', params: { selector: '#btn' } }
        ]
      })
    )

    const result = await mod.generateWorkflow('some prompt')
    expect(result.steps[0].id).toMatch(/^step-1-/)
    expect(result.steps[1].id).toMatch(/^step-2-/)
    // Ids are distinct
    expect(result.steps[0].id).not.toBe(result.steps[1].id)
  })

  it('throws when the LLM returns non-JSON', async () => {
    const mod = await freshModule()
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Sorry, I cannot help with that.' }]
    })

    await expect(mod.generateWorkflow('bad prompt')).rejects.toThrow(
      'Model did not return valid JSON'
    )
  })
})

// ── 6. explainStep ──────────────────────────────────────────────────────────

describe('explainStep', () => {
  beforeEach(() => {
    mockCreate.mockReset()
  })

  it('returns a plain-text explanation', async () => {
    const mod = await freshModule()
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'This step clicks the login button on the page.' }]
    })

    const explanation = await mod.explainStep({
      id: 'step-1',
      action: 'click',
      label: 'Click login',
      params: { selector: '#login' }
    })

    expect(explanation).toBe('This step clicks the login button on the page.')
  })
})

// ── 7. fixStep ──────────────────────────────────────────────────────────────

describe('fixStep', () => {
  beforeEach(() => {
    mockCreate.mockReset()
  })

  it('returns a corrected step preserving the original id', async () => {
    const mod = await freshModule()
    mockCreate.mockResolvedValueOnce(
      makeLlmResponse({
        id: 'ignored-id',
        action: 'click',
        label: 'Click login (fixed)',
        params: { selector: 'button.login-btn' }
      })
    )

    const original = {
      id: 'step-42',
      action: 'click' as const,
      label: 'Click login',
      params: { selector: '#login' }
    }

    const fixed = await mod.fixStep(original, 'Element not found: #login')
    expect(fixed.id).toBe('step-42') // preserves original id
    expect(fixed.label).toBe('Click login (fixed)')
    expect(fixed.params.selector).toBe('button.login-btn')
  })
})

// ── 8. analyzeDetection ─────────────────────────────────────────────────────

describe('analyzeDetection', () => {
  beforeEach(() => {
    mockCreate.mockReset()
  })

  it('returns recommendations with riskLevel', async () => {
    const mod = await freshModule()
    mockCreate.mockResolvedValueOnce(
      makeLlmResponse({
        overallSummary: 'WebGL renderer mismatch detected',
        riskLevel: 'high',
        recommendations: [
          {
            title: 'Fix WebGL renderer',
            explanation: 'Renderer string does not match UA.',
            priority: 1,
            fieldPath: 'webgl.renderer',
            suggestedValue: 'ANGLE (Intel, Mesa Intel HD 620)'
          }
        ]
      })
    )

    const vectors = [
      { vectorId: 'webgl-renderer', name: 'WebGL Renderer', passed: false, score: 20, details: 'mismatch' }
    ]

    const advice = await mod.analyzeDetection(vectors as any, 65)
    expect(advice.riskLevel).toBe('high')
    expect(advice.recommendations).toHaveLength(1)
    expect(advice.recommendations[0].title).toBe('Fix WebGL renderer')
    expect(advice.overallSummary).toContain('WebGL')
  })
})

// ── 9. healSelector ─────────────────────────────────────────────────────────

describe('healSelector', () => {
  beforeEach(() => {
    mockCreate.mockReset()
  })

  it('returns suggestedSelector and confidence', async () => {
    const mod = await freshModule()
    mockCreate.mockResolvedValueOnce(
      makeLlmResponse({
        suggestedSelector: 'button[data-testid="submit"]',
        confidence: 'high',
        reasoning: 'The original ID was removed; data-testid is more stable.'
      })
    )

    const result = await mod.healSelector(
      '#submit-btn',
      '<html><body><button data-testid="submit">Submit</button></body></html>'
    )

    expect(result.originalSelector).toBe('#submit-btn')
    expect(result.suggestedSelector).toBe('button[data-testid="submit"]')
    expect(result.confidence).toBe('high')
    expect(result.reasoning).toContain('data-testid')
  })
})

// ── 10. generateRecoverySteps ───────────────────────────────────────────────

describe('generateRecoverySteps', () => {
  beforeEach(() => {
    mockCreate.mockReset()
  })

  it('returns recovery steps with reasoning and confidence', async () => {
    const mod = await freshModule()
    mockCreate.mockResolvedValueOnce(
      makeLlmResponse({
        steps: [
          { id: 'recovery-1', action: 'wait', label: 'Wait for page', params: { ms: 2000 } },
          { id: 'recovery-2', action: 'waitForSelector', label: 'Wait for element', params: { selector: '#login', timeout: 10000 } }
        ],
        reasoning: 'Element may not have loaded yet; adding wait and retry.',
        confidence: 'high'
      })
    )

    const failedStep = { id: 's1', action: 'click' as const, label: 'Click', params: { selector: '#login' } }
    const errorCtx = {
      stepId: 's1',
      action: 'click' as const,
      errorMessage: 'Element not found',
      errorCategory: 'selector' as const,
      timestamp: new Date().toISOString(),
      attempt: 1
    }

    const result = await mod.generateRecoverySteps(failedStep, errorCtx)
    expect(result.steps).toHaveLength(2)
    expect(result.reasoning).toContain('wait')
    expect(result.confidence).toBe('high')
  })

  it('filters out unsafe actions from LLM response', async () => {
    const mod = await freshModule()
    mockCreate.mockResolvedValueOnce(
      makeLlmResponse({
        steps: [
          { id: 'r1', action: 'wait', label: 'Wait', params: { ms: 1000 } },
          { id: 'r2', action: 'upload', label: 'Upload file', params: { path: '/etc/passwd' } },
          { id: 'r3', action: 'download', label: 'Download malware', params: { url: 'http://evil.com' } }
        ],
        reasoning: 'Mixed safe and unsafe steps',
        confidence: 'medium'
      })
    )

    const failedStep = { id: 's1', action: 'click' as const, label: 'Click', params: {} }
    const errorCtx = {
      stepId: 's1',
      action: 'click' as const,
      errorMessage: 'fail',
      errorCategory: 'selector' as const,
      timestamp: new Date().toISOString(),
      attempt: 1
    }

    const result = await mod.generateRecoverySteps(failedStep, errorCtx)
    // Only the safe 'wait' action should survive
    expect(result.steps).toHaveLength(1)
    expect(result.steps[0].action).toBe('wait')
  })
})

// ── 11. Rate limiting ───────────────────────────────────────────────────────

describe('Rate limiting', () => {
  beforeEach(() => {
    mockCreate.mockReset()
  })

  it('throws when max calls reached', async () => {
    const mod = await freshModule({ maxCallsPerSession: 1 })

    // First call succeeds
    mockCreate.mockResolvedValueOnce(
      makeLlmResponse({ summary: 'ok', steps: [] })
    )
    await mod.generateWorkflow('first call')

    // Second call should be rate-limited (before even hitting the API)
    await expect(mod.generateWorkflow('second call')).rejects.toThrow(
      'AI rate limit reached'
    )
  })
})

// ── 12. Error handling ──────────────────────────────────────────────────────

describe('Error handling', () => {
  beforeEach(() => {
    mockCreate.mockReset()
  })

  it('throws when API key is not configured', async () => {
    const mod = await freshModule({ apiKey: '' })
    await expect(mod.generateWorkflow('test')).rejects.toThrow(
      'AI API key is not configured'
    )
  })

  it('throws when AI is disabled', async () => {
    const mod = await freshModule({ apiKey: 'test-key', enabled: false })
    await expect(mod.generateWorkflow('test')).rejects.toThrow(
      'AI features are disabled'
    )
  })

  it('throws when healSelector gets non-JSON response', async () => {
    const mod = await freshModule()
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'I do not understand the request.' }]
    })
    await expect(
      mod.healSelector('#gone', '<html></html>')
    ).rejects.toThrow('Model did not return a valid selector suggestion')
  })

  it('throws when generateRecoverySteps gets no valid steps', async () => {
    const mod = await freshModule()
    mockCreate.mockResolvedValueOnce(
      makeLlmResponse({
        steps: [],
        reasoning: 'empty',
        confidence: 'low'
      })
    )
    const failedStep = { id: 's1', action: 'click' as const, label: 'Click', params: {} }
    const errorCtx = {
      stepId: 's1',
      action: 'click' as const,
      errorMessage: 'fail',
      errorCategory: 'unknown' as const,
      timestamp: new Date().toISOString(),
      attempt: 1
    }
    await expect(
      mod.generateRecoverySteps(failedStep, errorCtx)
    ).rejects.toThrow('AI generated no valid recovery steps')
  })
})
