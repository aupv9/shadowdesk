/**
 * Unit tests for AutomationEngine exported utility functions.
 *
 * Tests pure functions and the CircuitBreaker class without requiring
 * Electron, browser, or database dependencies.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock heavy dependencies before importing automation ──────────────────────

vi.mock('electron', () => ({ app: { getPath: vi.fn(() => '/tmp') } }))
vi.mock('uuid', () => ({ v4: () => 'test-uuid' }))
vi.mock('../../src/main/database', () => ({
  Database: { getInstance: () => ({ getWorkflow: vi.fn(), addWorkflowRun: vi.fn() }) }
}))
vi.mock('../../src/main/browser-manager', () => ({
  BrowserManager: { getInstance: () => ({ isRunning: vi.fn(() => false), getActivePage: vi.fn() }) }
}))
vi.mock('../../src/main/settings', () => ({
  getSettings: () => ({})
}))
vi.mock('../../src/main/captcha', () => ({
  getSolver: vi.fn()
}))
vi.mock('../../src/main/vault', () => ({
  getVault: vi.fn()
}))
vi.mock('../../src/main/platform-hardener', () => ({
  validatePreFlight: vi.fn(),
  analyzeRuntimeSignal: vi.fn()
}))
vi.mock('../../src/main/ai-assistant', () => ({
  generateRecoverySteps: vi.fn()
}))

import {
  inferVariableType,
  coerceVariable,
  typedVarsToStringMap,
  initializeTypedVariables,
  setTypedVariable,
  categorizeError,
  CircuitBreaker,
  calculateRetryDelay,
  jsonPathGet,
  applyTransforms
} from '../../src/main/automation'

import type { TypedVariable, VariableDefinition } from '../../src/shared/types'

// ─── 1. inferVariableType ───────────────────────────────────────────────────

describe('inferVariableType', () => {
  it('returns "string" for null', () => {
    expect(inferVariableType(null)).toBe('string')
  })

  it('returns "string" for undefined', () => {
    expect(inferVariableType(undefined)).toBe('string')
  })

  it('returns "boolean" for boolean values', () => {
    expect(inferVariableType(true)).toBe('boolean')
    expect(inferVariableType(false)).toBe('boolean')
  })

  it('returns "number" for numeric values', () => {
    expect(inferVariableType(42)).toBe('number')
    expect(inferVariableType(3.14)).toBe('number')
  })

  it('returns "array" for arrays', () => {
    expect(inferVariableType([1, 2, 3])).toBe('array')
    expect(inferVariableType([])).toBe('array')
  })

  it('returns "object" for plain objects', () => {
    expect(inferVariableType({ a: 1 })).toBe('object')
    expect(inferVariableType({})).toBe('object')
  })

  it('returns "number" for numeric string "123"', () => {
    expect(inferVariableType('123')).toBe('number')
  })

  it('returns "array" for JSON array string "[1,2]"', () => {
    expect(inferVariableType('[1,2]')).toBe('array')
  })

  it('returns "object" for JSON object string \'{"a":1}\'', () => {
    expect(inferVariableType('{"a":1}')).toBe('object')
  })

  it('returns "string" for a plain string', () => {
    expect(inferVariableType('hello world')).toBe('string')
  })
})

// ─── 2. coerceVariable ─────────────────────────────────────────────────────

describe('coerceVariable', () => {
  it('returns empty string for null coerced to string', () => {
    expect(coerceVariable(null, 'string')).toBe('')
  })

  it('returns 0 for null coerced to number', () => {
    expect(coerceVariable(null, 'number')).toBe(0)
  })

  it('returns false for null coerced to boolean', () => {
    expect(coerceVariable(null, 'boolean')).toBe(false)
  })

  it('returns empty array for null coerced to array', () => {
    expect(coerceVariable(null, 'array')).toEqual([])
  })

  it('returns empty object for null coerced to object', () => {
    expect(coerceVariable(null, 'object')).toEqual({})
  })

  it('coerces string "42" to number 42', () => {
    expect(coerceVariable('42', 'number')).toBe(42)
  })

  it('coerces string "true" to boolean true', () => {
    expect(coerceVariable('true', 'boolean')).toBe(true)
  })

  it('coerces string "false" to boolean false', () => {
    expect(coerceVariable('false', 'boolean')).toBe(false)
  })

  it('coerces number to string', () => {
    expect(coerceVariable(99, 'string')).toBe('99')
  })

  it('wraps a string in an array when coerced to array', () => {
    expect(coerceVariable('hello', 'array')).toEqual(['hello'])
  })

  it('parses a JSON array string when coerced to array', () => {
    expect(coerceVariable('[1,2,3]', 'array')).toEqual([1, 2, 3])
  })

  it('parses a JSON object string when coerced to object', () => {
    expect(coerceVariable('{"a":1}', 'object')).toEqual({ a: 1 })
  })

  it('wraps non-parseable string as { value } when coerced to object', () => {
    expect(coerceVariable('hello', 'object')).toEqual({ value: 'hello' })
  })
})

// ─── 3. typedVarsToStringMap ────────────────────────────────────────────────

describe('typedVarsToStringMap', () => {
  it('converts typed vars map to string record', () => {
    const vars = new Map<string, TypedVariable>([
      ['name', { value: 'Alice', type: 'string' }],
      ['count', { value: 42, type: 'number' }],
    ])
    const result = typedVarsToStringMap(vars)
    expect(result).toEqual({ name: 'Alice', count: '42' })
  })

  it('handles null/undefined values as empty string', () => {
    const vars = new Map<string, TypedVariable>([
      ['a', { value: null, type: 'string' }],
      ['b', { value: undefined, type: 'string' }],
    ])
    const result = typedVarsToStringMap(vars)
    expect(result.a).toBe('')
    expect(result.b).toBe('')
  })

  it('stringifies objects and arrays', () => {
    const vars = new Map<string, TypedVariable>([
      ['obj', { value: { x: 1 }, type: 'object' }],
      ['arr', { value: [1, 2], type: 'array' }],
    ])
    const result = typedVarsToStringMap(vars)
    expect(result.obj).toBe('{"x":1}')
    expect(result.arr).toBe('[1,2]')
  })
})

// ─── 4. initializeTypedVariables ────────────────────────────────────────────

describe('initializeTypedVariables', () => {
  it('applies defaults from definitions', () => {
    const defs: VariableDefinition[] = [
      { name: 'url', type: 'string', default: 'https://example.com' },
      { name: 'count', type: 'number', default: 10 },
    ]
    const { typedVars, stringVars } = initializeTypedVariables(defs, undefined, undefined, {})
    expect(typedVars.get('url')?.value).toBe('https://example.com')
    expect(typedVars.get('count')?.value).toBe(10)
    expect(stringVars.url).toBe('https://example.com')
    expect(stringVars.count).toBe('10')
  })

  it('legacy vars override defaults', () => {
    const defs: VariableDefinition[] = [
      { name: 'url', type: 'string', default: 'https://default.com' },
    ]
    const legacy = { url: 'https://override.com' }
    const { typedVars } = initializeTypedVariables(defs, legacy, undefined, {})
    expect(typedVars.get('url')?.value).toBe('https://override.com')
  })

  it('runtime vars override legacy vars', () => {
    const defs: VariableDefinition[] = [
      { name: 'url', type: 'string', default: 'https://default.com' },
    ]
    const legacy = { url: 'https://legacy.com' }
    const runtime = { url: 'https://runtime.com' }
    const { typedVars } = initializeTypedVariables(defs, legacy, runtime, {})
    expect(typedVars.get('url')?.value).toBe('https://runtime.com')
  })

  it('built-ins added for missing keys only', () => {
    const defs: VariableDefinition[] = [
      { name: 'url', type: 'string', default: 'https://keep.com' },
    ]
    const builtIns = { url: 'https://builtin.com', timestamp: '2024-01-01' }
    const { typedVars } = initializeTypedVariables(defs, undefined, undefined, builtIns)
    // url keeps its definition default, not the built-in
    expect(typedVars.get('url')?.value).toBe('https://keep.com')
    // timestamp is added from built-ins since it was missing
    expect(typedVars.get('timestamp')?.value).toBe('2024-01-01')
  })
})

// ─── 5. setTypedVariable ────────────────────────────────────────────────────

describe('setTypedVariable', () => {
  it('sets a typed variable and updates the string map', () => {
    const typedVars = new Map<string, TypedVariable>()
    const stringVars: Record<string, string> = {}
    setTypedVariable(typedVars, stringVars, 'result', 'hello', 'step1')
    expect(typedVars.get('result')?.value).toBe('hello')
    expect(typedVars.get('result')?.type).toBe('string')
    expect(typedVars.get('result')?.sourceStep).toBe('step1')
    expect(stringVars.result).toBe('hello')
  })

  it('uses explicit saveAsType over inferred type', () => {
    const typedVars = new Map<string, TypedVariable>()
    const stringVars: Record<string, string> = {}
    setTypedVariable(typedVars, stringVars, 'count', '42', 'step2', 'number')
    expect(typedVars.get('count')?.value).toBe(42)
    expect(typedVars.get('count')?.type).toBe('number')
  })
})

// ─── 6. categorizeError ─────────────────────────────────────────────────────

describe('categorizeError', () => {
  it('returns "timeout" for timeout messages', () => {
    expect(categorizeError('Request timed out after 30000ms')).toBe('timeout')
    expect(categorizeError('timeout exceeded')).toBe('timeout')
  })

  it('returns "network" for ECONNREFUSED', () => {
    expect(categorizeError('connect ECONNREFUSED 127.0.0.1:3000')).toBe('network')
  })

  it('returns "network" for net::ERR_ patterns', () => {
    expect(categorizeError('net::ERR_CONNECTION_RESET')).toBe('network')
  })

  it('returns "selector" for "not found" messages', () => {
    expect(categorizeError('Element not found for selector #btn')).toBe('selector')
  })

  it('returns "selector" for "no element" messages', () => {
    expect(categorizeError('no element matches selector .item')).toBe('selector')
  })

  it('returns "navigation" for navigation errors', () => {
    expect(categorizeError('Navigation to url failed')).toBe('navigation')
  })

  it('returns "captcha" for captcha/recaptcha mentions', () => {
    expect(categorizeError('Captcha challenge detected')).toBe('captcha')
    expect(categorizeError('reCAPTCHA verification required')).toBe('captcha')
  })

  it('returns "unknown" for unrecognized errors', () => {
    expect(categorizeError('something completely different happened')).toBe('unknown')
  })
})

// ─── 7. CircuitBreaker ──────────────────────────────────────────────────────

describe('CircuitBreaker', () => {
  const defaultConfig = {
    failureThreshold: 3,
    successThreshold: 2,
    resetTimeoutMs: 1000,
    halfOpenMaxAttempts: 3,
  }

  it('starts in CLOSED state', () => {
    const cb = new CircuitBreaker(defaultConfig)
    expect(cb.getState().status).toBe('CLOSED')
    expect(cb.canExecute()).toBe(true)
  })

  it('opens after reaching the failure threshold', () => {
    const cb = new CircuitBreaker(defaultConfig)
    cb.recordFailure() // 1
    cb.recordFailure() // 2
    expect(cb.getState().status).toBe('CLOSED')
    const tripped = cb.recordFailure() // 3 — threshold reached
    expect(tripped).toBe(true)
    expect(cb.getState().status).toBe('OPEN')
    expect(cb.canExecute()).toBe(false)
  })

  it('transitions to HALF_OPEN after reset timeout elapses', () => {
    const cb = new CircuitBreaker({ ...defaultConfig, resetTimeoutMs: 50 })
    cb.recordFailure()
    cb.recordFailure()
    cb.recordFailure() // opens

    // Before timeout: still OPEN
    expect(cb.canExecute()).toBe(false)

    // Simulate time passing by manipulating the internal state via rapid check.
    // We use a real wait here since the timeout is very short.
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(cb.canExecute()).toBe(true) // should transition to HALF_OPEN
        expect(cb.getState().status).toBe('HALF_OPEN')
        resolve()
      }, 60)
    })
  })

  it('resets to CLOSED on enough successes in HALF_OPEN', () => {
    const cb = new CircuitBreaker({ ...defaultConfig, resetTimeoutMs: 10 })
    cb.recordFailure()
    cb.recordFailure()
    cb.recordFailure() // opens

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        cb.canExecute() // triggers HALF_OPEN transition
        expect(cb.getState().status).toBe('HALF_OPEN')

        cb.recordSuccess() // 1 of 2
        expect(cb.getState().status).toBe('HALF_OPEN')
        cb.recordSuccess() // 2 of 2 — meets successThreshold
        expect(cb.getState().status).toBe('CLOSED')
        resolve()
      }, 20)
    })
  })

  it('getState() returns correct tripCount', () => {
    const cb = new CircuitBreaker(defaultConfig)
    expect(cb.getState().tripCount).toBe(0)
    cb.recordFailure()
    cb.recordFailure()
    cb.recordFailure()
    expect(cb.getState().tripCount).toBe(1)
  })

  it('isOpen() reflects current state', () => {
    const cb = new CircuitBreaker(defaultConfig)
    expect(cb.isOpen()).toBe(false)
    cb.recordFailure()
    cb.recordFailure()
    cb.recordFailure()
    expect(cb.isOpen()).toBe(true)
  })
})

// ─── 8. calculateRetryDelay ─────────────────────────────────────────────────

describe('calculateRetryDelay', () => {
  it('returns base delay for fixed backoff', () => {
    expect(calculateRetryDelay(1000, 0, 'fixed')).toBe(1000)
    expect(calculateRetryDelay(1000, 5, 'fixed')).toBe(1000)
  })

  it('scales linearly with attempt number for linear backoff', () => {
    expect(calculateRetryDelay(1000, 0, 'linear')).toBe(1000)   // 1000 * (0+1)
    expect(calculateRetryDelay(1000, 1, 'linear')).toBe(2000)   // 1000 * (1+1)
    expect(calculateRetryDelay(1000, 2, 'linear')).toBe(3000)   // 1000 * (2+1)
  })

  it('doubles each attempt for exponential backoff', () => {
    expect(calculateRetryDelay(1000, 0, 'exponential')).toBe(1000)  // 1000 * 2^0
    expect(calculateRetryDelay(1000, 1, 'exponential')).toBe(2000)  // 1000 * 2^1
    expect(calculateRetryDelay(1000, 2, 'exponential')).toBe(4000)  // 1000 * 2^2
  })

  it('respects max delay cap', () => {
    expect(calculateRetryDelay(1000, 10, 'exponential', false, 5000)).toBe(5000)
  })

  it('adds jitter when enabled (result varies but stays within range)', () => {
    const baseDelay = 1000
    const results = new Set<number>()
    for (let i = 0; i < 20; i++) {
      results.add(calculateRetryDelay(baseDelay, 0, 'fixed', true))
    }
    // With jitter, delay should be in range [750, 1250] (+-25%)
    for (const r of results) {
      expect(r).toBeGreaterThanOrEqual(750)
      expect(r).toBeLessThanOrEqual(1250)
    }
    // Jitter should produce at least some variation (probabilistic but very likely with 20 attempts)
    expect(results.size).toBeGreaterThan(1)
  })
})

// ─── 9. jsonPathGet ─────────────────────────────────────────────────────────

describe('jsonPathGet', () => {
  const data = {
    a: {
      b: {
        c: 42
      }
    },
    items: ['first', 'second', 'third'],
    nested: { list: [{ id: 1 }, { id: 2 }] }
  }

  it('gets nested values with dot notation: a.b.c', () => {
    expect(jsonPathGet(data, 'a.b.c')).toBe(42)
  })

  it('supports $ prefix: $.a.b.c', () => {
    expect(jsonPathGet(data, '$.a.b.c')).toBe(42)
  })

  it('returns undefined for missing paths', () => {
    expect(jsonPathGet(data, 'a.b.missing')).toBeUndefined()
    expect(jsonPathGet(data, 'x.y.z')).toBeUndefined()
  })

  it('handles array indices with bracket notation', () => {
    expect(jsonPathGet(data, 'items[0]')).toBe('first')
    expect(jsonPathGet(data, 'items[2]')).toBe('third')
  })

  it('returns the full object for $ path', () => {
    expect(jsonPathGet(data, '$')).toBe(data)
  })

  it('returns entire array for [*] wildcard', () => {
    expect(jsonPathGet(data, 'items[*]')).toEqual(['first', 'second', 'third'])
  })
})

// ─── 10. applyTransforms ───────────────────────────────────────────────────

describe('applyTransforms', () => {
  it('returns raw value when transform is undefined', () => {
    expect(applyTransforms('hello', undefined)).toBe('hello')
  })

  it('trims whitespace with "trim"', () => {
    expect(applyTransforms('  hello  ', 'trim')).toBe('hello')
  })

  it('converts to uppercase with "upper"', () => {
    expect(applyTransforms('hello', 'upper')).toBe('HELLO')
  })

  it('converts to uppercase with "uppercase" alias', () => {
    expect(applyTransforms('hello', 'uppercase')).toBe('HELLO')
  })

  it('converts to lowercase with "lower"', () => {
    expect(applyTransforms('HELLO', 'lower')).toBe('hello')
  })

  it('converts to lowercase with "lowercase" alias', () => {
    expect(applyTransforms('HELLO', 'lowercase')).toBe('hello')
  })

  it('applies array of transforms in order', () => {
    expect(applyTransforms('  Hello World  ', ['trim', 'lower'])).toBe('hello world')
  })

  it('applies "number" transform to convert numeric string', () => {
    expect(applyTransforms('42.5', 'number')).toBe('42.5')
  })

  it('returns empty string for non-numeric with "number" transform', () => {
    expect(applyTransforms('abc', 'number')).toBe('')
  })

  it('applies "length" transform', () => {
    expect(applyTransforms('hello', 'length')).toBe('5')
  })
})
