/**
 * Phase 13.A — Unit tests for the WorkflowScheduler cron engine.
 *
 * Tests the `matchesCron` logic (internal) by verifying schedules that
 * should/shouldn't fire at given moments, plus the scheduler start/stop
 * lifecycle.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Minimal cron parser (mirrors the WorkflowScheduler implementation) ───────
// We extract the cron-matching algorithm for unit testing without spawning
// the full scheduler (which needs DB + AutomationEngine).

function matchesCron(cron: string, date: Date): boolean {
  const [minuteField, hourField, domField, monthField, dowField] = cron.split(' ')

  function matchField(field: string, value: number, min: number, max: number): boolean {
    if (field === '*') return true

    for (const part of field.split(',')) {
      // Step values: */5 or 1-5/2
      if (part.includes('/')) {
        const [rangeStr, stepStr] = part.split('/')
        const step = parseInt(stepStr, 10)
        let start = min
        let end = max
        if (rangeStr !== '*') {
          if (rangeStr.includes('-')) {
            const [s, e] = rangeStr.split('-').map(Number)
            start = s
            end = e
          } else {
            start = parseInt(rangeStr, 10)
          }
        }
        for (let v = start; v <= end; v += step) {
          if (v === value) return true
        }
        continue
      }
      // Ranges: 1-5
      if (part.includes('-')) {
        const [s, e] = part.split('-').map(Number)
        if (value >= s && value <= e) return true
        continue
      }
      // Exact value
      if (parseInt(part, 10) === value) return true
    }
    return false
  }

  const minute = date.getMinutes()
  const hour   = date.getHours()
  const dom    = date.getDate()
  const month  = date.getMonth() + 1
  const dow    = date.getDay()

  return (
    matchField(minuteField, minute, 0, 59) &&
    matchField(hourField,   hour,   0, 23) &&
    matchField(domField,    dom,    1, 31) &&
    matchField(monthField,  month,  1, 12) &&
    matchField(dowField,    dow,    0,  6)
  )
}

// Helper: build a date with specific fields
function makeDate(minute: number, hour: number, dom: number, month: number, dow: number): Date {
  // Use a fixed year; dow is set via a known date
  // We'll just create a date and override getMinutes etc via a wrapper
  const d = new Date(2024, month - 1, dom, hour, minute)
  return d
}

describe('Cron matching — wildcard', () => {
  it('* * * * * matches any date', () => {
    expect(matchesCron('* * * * *', new Date())).toBe(true)
  })
})

describe('Cron matching — exact values', () => {
  it('matches exact minute', () => {
    const d = makeDate(30, 10, 15, 6, 3)
    expect(matchesCron('30 * * * *', d)).toBe(true)
    expect(matchesCron('31 * * * *', d)).toBe(false)
  })

  it('matches exact hour', () => {
    const d = makeDate(0, 14, 1, 1, 1)
    expect(matchesCron('0 14 * * *', d)).toBe(true)
    expect(matchesCron('0 13 * * *', d)).toBe(false)
  })

  it('matches exact day-of-month', () => {
    const d = makeDate(0, 0, 15, 1, 1)
    expect(matchesCron('* * 15 * *', d)).toBe(true)
    expect(matchesCron('* * 16 * *', d)).toBe(false)
  })

  it('matches exact month', () => {
    const d = makeDate(0, 0, 1, 7, 1)
    expect(matchesCron('* * * 7 *', d)).toBe(true)
    expect(matchesCron('* * * 8 *', d)).toBe(false)
  })

  it('matches combined exact fields', () => {
    const d = makeDate(30, 9, 15, 3, 3)
    expect(matchesCron('30 9 15 3 *', d)).toBe(true)
    expect(matchesCron('30 9 14 3 *', d)).toBe(false)
  })
})

describe('Cron matching — comma lists', () => {
  it('minute comma list matches each value', () => {
    expect(matchesCron('0,15,30,45 * * * *', makeDate(0,  0, 1, 1, 1))).toBe(true)
    expect(matchesCron('0,15,30,45 * * * *', makeDate(15, 0, 1, 1, 1))).toBe(true)
    expect(matchesCron('0,15,30,45 * * * *', makeDate(30, 0, 1, 1, 1))).toBe(true)
    expect(matchesCron('0,15,30,45 * * * *', makeDate(45, 0, 1, 1, 1))).toBe(true)
    expect(matchesCron('0,15,30,45 * * * *', makeDate(10, 0, 1, 1, 1))).toBe(false)
  })

  it('hour comma list', () => {
    expect(matchesCron('0 6,12,18 * * *', makeDate(0, 6,  1, 1, 1))).toBe(true)
    expect(matchesCron('0 6,12,18 * * *', makeDate(0, 12, 1, 1, 1))).toBe(true)
    expect(matchesCron('0 6,12,18 * * *', makeDate(0, 9,  1, 1, 1))).toBe(false)
  })
})

describe('Cron matching — ranges', () => {
  it('minute range 0-5 matches values within range', () => {
    for (let m = 0; m <= 5; m++) {
      expect(matchesCron('0-5 * * * *', makeDate(m, 0, 1, 1, 1))).toBe(true)
    }
    expect(matchesCron('0-5 * * * *', makeDate(6, 0, 1, 1, 1))).toBe(false)
  })

  it('hour range 9-17 matches business hours', () => {
    for (let h = 9; h <= 17; h++) {
      expect(matchesCron('0 9-17 * * *', makeDate(0, h, 1, 1, 1))).toBe(true)
    }
    expect(matchesCron('0 9-17 * * *', makeDate(0, 8,  1, 1, 1))).toBe(false)
    expect(matchesCron('0 9-17 * * *', makeDate(0, 18, 1, 1, 1))).toBe(false)
  })
})

describe('Cron matching — step values', () => {
  it('*/15 matches 0, 15, 30, 45 for minutes', () => {
    expect(matchesCron('*/15 * * * *', makeDate(0,  0, 1, 1, 1))).toBe(true)
    expect(matchesCron('*/15 * * * *', makeDate(15, 0, 1, 1, 1))).toBe(true)
    expect(matchesCron('*/15 * * * *', makeDate(30, 0, 1, 1, 1))).toBe(true)
    expect(matchesCron('*/15 * * * *', makeDate(45, 0, 1, 1, 1))).toBe(true)
    expect(matchesCron('*/15 * * * *', makeDate(7,  0, 1, 1, 1))).toBe(false)
  })

  it('*/2 matches every even minute', () => {
    expect(matchesCron('*/2 * * * *', makeDate(0,  0, 1, 1, 1))).toBe(true)
    expect(matchesCron('*/2 * * * *', makeDate(2,  0, 1, 1, 1))).toBe(true)
    expect(matchesCron('*/2 * * * *', makeDate(1,  0, 1, 1, 1))).toBe(false)
  })

  it('*/6 for hours matches 0,6,12,18', () => {
    expect(matchesCron('0 */6 * * *', makeDate(0, 0,  1, 1, 1))).toBe(true)
    expect(matchesCron('0 */6 * * *', makeDate(0, 6,  1, 1, 1))).toBe(true)
    expect(matchesCron('0 */6 * * *', makeDate(0, 12, 1, 1, 1))).toBe(true)
    expect(matchesCron('0 */6 * * *', makeDate(0, 18, 1, 1, 1))).toBe(true)
    expect(matchesCron('0 */6 * * *', makeDate(0, 5,  1, 1, 1))).toBe(false)
  })
})

describe('WorkflowScheduler — lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('start() and stop() do not throw', async () => {
    vi.resetModules()
    vi.doMock('../../src/main/database', () => ({
      Database: {
        getInstance: () => ({
          getAllSchedules: vi.fn(() => []),
          updateSchedule: vi.fn()
        })
      }
    }))
    vi.doMock('../../src/main/automation', () => ({
      AutomationEngine: {
        getInstance: () => ({ executeWorkflow: vi.fn(), isRunning: vi.fn(() => false) })
      }
    }))
    vi.doMock('../../src/main/browser-manager', () => ({
      BrowserManager: { getInstance: () => ({ isRunning: vi.fn(() => false) }) }
    }))
    vi.doMock('../../src/main/fingerprint/presets', () => ({
      resolveFingerprint: vi.fn()
    }))

    const { WorkflowScheduler } = await import('../../src/main/scheduler')
    const scheduler = WorkflowScheduler.getInstance()
    expect(() => scheduler.start()).not.toThrow()
    expect(() => scheduler.stop()).not.toThrow()
  })
})
