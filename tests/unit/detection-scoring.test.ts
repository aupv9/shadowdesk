/**
 * Weighted scoring and the severity model.
 *
 * The regression these lock down: under the old `passedCount / total` mean a
 * profile could leak `navigator.webdriver`, pass everything else, and be
 * reported as "passed" at 97/100.
 */
import { describe, it, expect } from 'vitest'
import {
  severityFor,
  normalizeVector,
  scoreVectors,
  statusFor,
  splitScores
} from '../../src/main/detection/scoring'
import type { DetectionVectorResult, VectorSource } from '../../src/shared/types'

const v = (
  name: string,
  passed: boolean,
  over: Partial<DetectionVectorResult> = {}
): DetectionVectorResult => ({ name, category: 'Automation', passed, ...over })

/** n low-severity passing vectors, to stand in for "everything else is fine". */
const filler = (n: number) =>
  Array.from({ length: n }, (_, i) => v(`WebGPU API presence`, true, { name: `filler-${i}`, severity: 'low' }))

describe('severity assignment', () => {
  it('marks hard automation tells fatal', () => {
    expect(severityFor('navigator.webdriver')).toBe('fatal')
    expect(severityFor('Headless browser signals')).toBe('fatal')
    expect(severityFor('Worker navigator.webdriver')).toBe('fatal')
  })

  it('marks optional API surface low', () => {
    expect(severityFor('WebGPU API presence')).toBe('low')
    expect(severityFor('SharedArrayBuffer + Atomics')).toBe('low')
  })

  it('resolves the runtime-named browser-consistency vector by prefix', () => {
    expect(severityFor('Browser consistency (Edge)')).toBe('high')
  })

  it('defaults an unrecognised vector to medium rather than ignoring it', () => {
    expect(severityFor('Some Vector Added Next Year')).toBe('medium')
  })
})

describe('normalizeVector', () => {
  it('fills severity, source and status on a legacy vector', () => {
    const n = normalizeVector(v('navigator.webdriver', false))
    expect(n.severity).toBe('fatal')
    expect(n.source).toBe('injection')
    expect(n.status).toBe('fail')
  })

  it('leaves explicit values alone', () => {
    const n = normalizeVector(
      v('anything', false, { severity: 'low', source: 'probe', status: 'unavailable' })
    )
    expect(n.severity).toBe('low')
    expect(n.source).toBe('probe')
    expect(n.status).toBe('unavailable')
  })
})

describe('weighted scoring', () => {
  it('flags a fatal failure even when everything else passes', () => {
    const vectors = [v('navigator.webdriver', false), ...filler(44)]
    const breakdown = scoreVectors(vectors)

    expect(breakdown.hasFatalFailure).toBe(true)
    expect(statusFor(breakdown)).toBe('failed')
  })

  it('is the exact case the old unweighted mean got wrong', () => {
    const vectors = [v('navigator.webdriver', false), ...filler(44)]
    const oldScore = Math.round((vectors.filter((x) => x.passed).length / vectors.length) * 100)

    expect(oldScore).toBe(98) // what the previous implementation reported
    expect(statusFor(scoreVectors(vectors))).toBe('failed')
  })

  it('weighs a fatal vector above a low one', () => {
    const fatalFails = scoreVectors([v('navigator.webdriver', false), v('WebGPU API presence', true)])
    const lowFails = scoreVectors([v('navigator.webdriver', true), v('WebGPU API presence', false)])

    expect(fatalFails.score).toBeLessThan(lowFails.score)
  })

  it('passes a clean sweep', () => {
    const breakdown = scoreVectors([v('navigator.webdriver', true), ...filler(10)])
    expect(breakdown.score).toBe(100)
    expect(statusFor(breakdown)).toBe('passed')
  })
})

describe('unavailable vectors', () => {
  it('are excluded from the score rather than counted as failures', () => {
    const withUnavailable = scoreVectors([
      v('navigator.webdriver', true),
      v('Canvas fingerprint', false, { status: 'unavailable' })
    ])
    const without = scoreVectors([v('navigator.webdriver', true)])

    expect(withUnavailable.score).toBe(without.score)
    expect(withUnavailable.unavailableCount).toBe(1)
  })

  it('never turn a passing report into a failing one', () => {
    const breakdown = scoreVectors([
      v('navigator.webdriver', true),
      v('Headless browser signals', false, { status: 'unavailable' })
    ])
    expect(breakdown.hasFatalFailure).toBe(false)
    expect(statusFor(breakdown)).toBe('passed')
  })

  it('yields a neutral score when nothing could run', () => {
    const breakdown = scoreVectors([v('Canvas fingerprint', false, { status: 'unavailable' })])
    expect(breakdown.countedCount).toBe(0)
    expect(breakdown.score).toBe(100)
  })
})

describe('splitScores', () => {
  const mixed = (source: VectorSource) => [
    v('navigator.webdriver', true, { source: 'injection' }),
    v('Coherence: WebGL renderer vs claimed OS [R2]', false, { source, severity: 'fatal' })
  ]

  it('keeps injection integrity and detection risk apart', () => {
    const { injection, risk } = splitScores(mixed('coherence'))

    expect(injection.score).toBe(100) // the engine is working
    expect(risk?.hasFatalFailure).toBe(true) // but the profile contradicts itself
  })

  it('omits the risk score when only layer-0 vectors ran', () => {
    const { injection, risk } = splitScores([v('navigator.webdriver', true)])
    expect(injection.score).toBe(100)
    expect(risk).toBeUndefined()
  })

  it('treats probe and canary evidence as risk, not injection', () => {
    for (const source of ['probe', 'canary'] as VectorSource[]) {
      expect(splitScores(mixed(source)).risk).toBeDefined()
    }
  })
})
