/**
 * Trend bucketing for the detection dashboard.
 *
 * The case that matters is the legacy fallback: rows written before the score
 * was split carry only `overallScore`, which was the injection figure under a
 * misleading name. Plotting those under a "detection risk" heading would
 * reintroduce the exact conflation the split exists to prevent.
 */
import { describe, it, expect } from 'vitest'
import {
  buildTrendPoints,
  pickHeadline
} from '../../src/renderer/src/components/DetectionDashboard/trend'
import type { DetectionTestResult } from '../../src/shared/types'

const result = (over: Partial<DetectionTestResult> = {}): DetectionTestResult => ({
  id: `r-${Math.random()}`,
  profileId: 'p1',
  profileName: 'Profile 1',
  testedAt: '2026-08-13T10:00:00Z',
  overallScore: 90,
  vectors: [],
  status: 'passed',
  ...over
})

describe('buildTrendPoints', () => {
  it('averages several runs on the same day into one point', () => {
    const points = buildTrendPoints([
      result({ testedAt: '2026-08-13T01:00:00Z', injectionScore: 80, riskScore: 40 }),
      result({ testedAt: '2026-08-13T23:00:00Z', injectionScore: 90, riskScore: 60 })
    ])

    expect(points).toHaveLength(1)
    expect(points[0]).toEqual({ day: '2026-08-13', injection: 85, risk: 50 })
  })

  it('returns points in chronological order', () => {
    const points = buildTrendPoints([
      result({ testedAt: '2026-08-14T00:00:00Z' }),
      result({ testedAt: '2026-08-12T00:00:00Z' })
    ])
    expect(points.map((p) => p.day)).toEqual(['2026-08-12', '2026-08-14'])
  })

  it('filters to a single profile', () => {
    const points = buildTrendPoints(
      [
        result({ profileId: 'p1', injectionScore: 100 }),
        result({ profileId: 'p2', injectionScore: 0 })
      ],
      'p1'
    )
    expect(points[0].injection).toBe(100)
  })

  it('skips rows with no timestamp instead of crashing on them', () => {
    const points = buildTrendPoints([
      result({ testedAt: undefined as any }),
      result({ testedAt: '2026-08-13T00:00:00Z', injectionScore: 70 })
    ])
    expect(points).toHaveLength(1)
    expect(points[0].injection).toBe(70)
  })
})

describe('legacy rows', () => {
  it('reads overallScore as injection, never as risk', () => {
    const points = buildTrendPoints([result({ overallScore: 97 })])

    expect(points[0].injection).toBe(97)
    expect(points[0].risk).toBeNull()
  })

  it('averages risk over only the runs that produced one', () => {
    // One legacy row and one modern row on the same day. The legacy row must
    // not be counted as risk 0, which would halve the average.
    const points = buildTrendPoints([
      result({ testedAt: '2026-08-13T01:00:00Z', overallScore: 90 }),
      result({ testedAt: '2026-08-13T02:00:00Z', injectionScore: 90, riskScore: 60 })
    ])

    expect(points[0].risk).toBe(60)
    expect(points[0].injection).toBe(90)
  })
})

describe('pickHeadline', () => {
  it('leads with detection risk once any run produced one', () => {
    const headline = pickHeadline(buildTrendPoints([result({ injectionScore: 90, riskScore: 55 })]))

    expect(headline.key).toBe('risk')
    expect(headline.label).toBe('Detection risk')
    expect(headline.series).toEqual([55])
  })

  it('falls back to injection integrity for history with no risk scores', () => {
    const headline = pickHeadline(buildTrendPoints([result({ overallScore: 88 })]))

    expect(headline.key).toBe('injection')
    expect(headline.label).toBe('Injection integrity')
    expect(headline.series).toEqual([88])
  })

  it('excludes risk-less days from the risk series rather than plotting a zero', () => {
    const headline = pickHeadline(
      buildTrendPoints([
        result({ testedAt: '2026-08-12T00:00:00Z', overallScore: 90 }),
        result({ testedAt: '2026-08-13T00:00:00Z', injectionScore: 90, riskScore: 45 })
      ])
    )

    expect(headline.key).toBe('risk')
    expect(headline.series).toEqual([45])
  })

  it('produces an empty series for no history at all', () => {
    expect(pickHeadline([]).series).toEqual([])
  })
})
