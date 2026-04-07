import React, { useMemo, useState } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { DetectionTestResult } from '../../types'

interface Props {
  results: DetectionTestResult[]
}

/**
 * Phase 11.1 — Health score trending dashboard.
 *
 * Renders a small inline SVG chart of the average detection score over time.
 * Users can optionally filter to a single profile. The chart auto-buckets the
 * results by day so that batch testing in a single session does not skew the
 * trend line.
 */
export function HealthTrendChart({ results }: Props) {
  const [profileFilter, setProfileFilter] = useState<string>('all')

  const profiles = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of results) map.set(r.profileId, r.profileName)
    return Array.from(map.entries())
  }, [results])

  // Filter + bucket by day
  const points = useMemo(() => {
    const filtered = profileFilter === 'all'
      ? results
      : results.filter((r) => r.profileId === profileFilter)

    const byDay = new Map<string, { total: number; count: number }>()
    for (const r of filtered) {
      const day = r.testedAt.slice(0, 10) // YYYY-MM-DD
      const existing = byDay.get(day) ?? { total: 0, count: 0 }
      existing.total += r.overallScore
      existing.count += 1
      byDay.set(day, existing)
    }

    return Array.from(byDay.entries())
      .map(([day, agg]) => ({ day, score: Math.round(agg.total / agg.count) }))
      .sort((a, b) => a.day.localeCompare(b.day))
  }, [results, profileFilter])

  if (points.length === 0) {
    return (
      <div className="card mb-4">
        <h3 className="text-sm font-semibold text-white mb-2">Health Trend</h3>
        <p className="text-xs text-slate-500">Run a few detection tests to see how your average score trends over time.</p>
      </div>
    )
  }

  // Compute trend delta (first vs last)
  const first = points[0].score
  const last = points[points.length - 1].score
  const delta = last - first
  const trendIcon = delta > 2 ? <TrendingUp className="w-4 h-4 text-green-400" />
                  : delta < -2 ? <TrendingDown className="w-4 h-4 text-red-400" />
                  : <Minus className="w-4 h-4 text-slate-500" />

  // SVG geometry
  const W = 600
  const H = 140
  const PAD = { left: 32, right: 12, top: 12, bottom: 24 }
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom

  const xFor = (i: number) =>
    points.length === 1
      ? PAD.left + innerW / 2
      : PAD.left + (i / (points.length - 1)) * innerW

  const yFor = (score: number) => PAD.top + innerH - (score / 100) * innerH

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(1)} ${yFor(p.score).toFixed(1)}`)
    .join(' ')

  // Area fill (path closed to baseline)
  const areaD =
    pathD +
    ` L ${xFor(points.length - 1).toFixed(1)} ${(PAD.top + innerH).toFixed(1)}` +
    ` L ${xFor(0).toFixed(1)} ${(PAD.top + innerH).toFixed(1)} Z`

  const lineColor = last >= 90 ? '#22c55e' : last >= 70 ? '#eab308' : '#ef4444'
  const fillColor = last >= 90 ? 'rgba(34,197,94,0.18)' : last >= 70 ? 'rgba(234,179,8,0.18)' : 'rgba(239,68,68,0.18)'

  // Y-axis grid lines at 0/50/100
  const gridY = [0, 50, 100]

  return (
    <div className="card mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-white">Health Trend</h3>
          {trendIcon}
          <span className={`text-xs ${delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : 'text-slate-500'}`}>
            {delta > 0 ? '+' : ''}{delta}% over {points.length} day{points.length !== 1 ? 's' : ''}
          </span>
        </div>
        {profiles.length > 1 && (
          <select
            value={profileFilter}
            onChange={(e) => setProfileFilter(e.target.value)}
            className="text-xs bg-slate-800 border border-slate-700 text-slate-300 rounded px-2 py-1 focus:outline-none"
          >
            <option value="all">All profiles</option>
            {profiles.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        )}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-32" preserveAspectRatio="none">
        {/* Grid lines */}
        {gridY.map((g) => {
          const y = yFor(g)
          return (
            <g key={g}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y}
                y2={y}
                stroke="#1e293b"
                strokeWidth={1}
                strokeDasharray="2 3"
              />
              <text x={4} y={y + 3} fill="#475569" fontSize={9}>{g}</text>
            </g>
          )
        })}

        {/* Area */}
        <path d={areaD} fill={fillColor} />
        {/* Line */}
        <path d={pathD} fill="none" stroke={lineColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

        {/* Points */}
        {points.map((p, i) => (
          <g key={p.day}>
            <circle
              cx={xFor(i)}
              cy={yFor(p.score)}
              r={3}
              fill="#0f172a"
              stroke={lineColor}
              strokeWidth={1.5}
            />
            <title>{`${p.day}: ${p.score}%`}</title>
          </g>
        ))}

        {/* X-axis labels: first, middle, last */}
        {points.length > 0 && (
          <>
            <text x={xFor(0)} y={H - 6} fill="#64748b" fontSize={9} textAnchor="start">
              {points[0].day.slice(5)}
            </text>
            {points.length > 2 && (
              <text x={xFor(Math.floor(points.length / 2))} y={H - 6} fill="#64748b" fontSize={9} textAnchor="middle">
                {points[Math.floor(points.length / 2)].day.slice(5)}
              </text>
            )}
            {points.length > 1 && (
              <text x={xFor(points.length - 1)} y={H - 6} fill="#64748b" fontSize={9} textAnchor="end">
                {points[points.length - 1].day.slice(5)}
              </text>
            )}
          </>
        )}
      </svg>
    </div>
  )
}
