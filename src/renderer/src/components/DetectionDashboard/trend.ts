/**
 * Day-bucketing for the detection trend chart.
 *
 * Pulled out of the component because the interesting part is not the SVG:
 * it is deciding which of the two scores leads, and folding in rows written
 * before the split that only carry `overallScore`. That fallback is where a
 * silent misreading would live — showing a legacy injection figure under a
 * "detection risk" heading would be exactly the conflation the split exists
 * to prevent.
 */
import type { DetectionTestResult } from '../../types'

export interface TrendPoint {
  /** YYYY-MM-DD */
  day: string
  injection: number
  /** Null when no run that day produced a risk score. */
  risk: number | null
}

/**
 * Averages each day's runs into one point per series.
 *
 * Bucketing by day keeps a batch run of 50 profiles from swamping the line.
 */
export function buildTrendPoints(
  results: DetectionTestResult[],
  profileFilter: string = 'all'
): TrendPoint[] {
  const filtered =
    profileFilter === 'all' ? results : results.filter((r) => r.profileId === profileFilter)

  const byDay = new Map<string, { inj: number; injN: number; risk: number; riskN: number }>()

  for (const r of filtered) {
    // Legacy/snake_case rows predating the DB mapper can lack testedAt.
    if (!r.testedAt || typeof r.testedAt !== 'string') continue
    const day = r.testedAt.slice(0, 10)
    const agg = byDay.get(day) ?? { inj: 0, injN: 0, risk: 0, riskN: 0 }

    agg.inj += r.injectionScore ?? r.overallScore
    agg.injN += 1
    if (typeof r.riskScore === 'number') {
      agg.risk += r.riskScore
      agg.riskN += 1
    }
    byDay.set(day, agg)
  }

  return Array.from(byDay.entries())
    .map(([day, a]) => ({
      day,
      injection: Math.round(a.inj / a.injN),
      risk: a.riskN > 0 ? Math.round(a.risk / a.riskN) : null
    }))
    .sort((a, b) => a.day.localeCompare(b.day))
}

export interface TrendHeadline {
  key: 'risk' | 'injection'
  label: string
  series: number[]
}

/**
 * Detection risk leads whenever any run produced one; injection integrity is
 * the fallback for history that predates the split.
 */
export function pickHeadline(points: TrendPoint[]): TrendHeadline {
  const withRisk = points.filter((p) => p.risk !== null)
  return withRisk.length > 0
    ? { key: 'risk', label: 'Detection risk', series: withRisk.map((p) => p.risk!) }
    : { key: 'injection', label: 'Injection integrity', series: points.map((p) => p.injection) }
}
