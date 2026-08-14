import React from 'react'
import type { DetectionTestResult } from '../../types'

interface Props {
  result: DetectionTestResult
}

/**
 * Per-category pass-rate horizontal bar chart.
 *
 * Aggregates the test result's vectors by category and renders a compact
 * SVG bar chart so the user can see at a glance which attack surface areas
 * are fully protected vs partially failing.
 */
export function CategoryScoreChart({ result }: Props) {
  // Aggregate pass / total per category preserving CATEGORY_ORDER
  const CATEGORY_ORDER = ['Automation', 'Browser', 'Graphics', 'Audio', 'Hardware', 'Locale', 'Timing', 'API']

  // Only vectors that actually ran. A category made up of skipped checks would
  // otherwise render as a category that failed everything.
  const byCategory: Record<string, { passed: number; total: number }> = {}
  for (const v of result.vectors) {
    if (v.status === 'unavailable') continue
    const cat = v.category ?? 'Other'
    if (!byCategory[cat]) byCategory[cat] = { passed: 0, total: 0 }
    byCategory[cat].total += 1
    if (v.passed) byCategory[cat].passed += 1
  }

  // Sort: known categories first (in CATEGORY_ORDER), then any extras alphabetically
  const categories = [
    ...CATEGORY_ORDER.filter((c) => byCategory[c]),
    ...Object.keys(byCategory).filter((c) => !CATEGORY_ORDER.includes(c)).sort(),
  ]

  if (categories.length === 0) return null

  const BAR_H = 14
  const GAP   = 8
  const LABEL_W = 84
  const BAR_MAX_W = 160
  const COUNT_W = 32
  const totalH = categories.length * (BAR_H + GAP) - GAP + 2

  const colorFor = (pct: number) =>
    pct >= 1 ? '#22c55e' : pct >= 0.7 ? '#eab308' : '#ef4444'

  return (
    <div className="mt-4">
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">
        Score by category
      </p>
      <svg
        viewBox={`0 0 ${LABEL_W + BAR_MAX_W + COUNT_W + 8} ${totalH}`}
        className="w-full"
        style={{ height: totalH }}
      >
        {categories.map((cat, i) => {
          const { passed, total } = byCategory[cat]
          const pct = total > 0 ? passed / total : 0
          const barW = Math.round(pct * BAR_MAX_W)
          const y = i * (BAR_H + GAP)
          const color = colorFor(pct)

          return (
            <g key={cat}>
              {/* Category label */}
              <text
                x={LABEL_W - 6}
                y={y + BAR_H - 3}
                fill="#94a3b8"
                fontSize={10}
                textAnchor="end"
              >
                {cat}
              </text>
              {/* Background track */}
              <rect
                x={LABEL_W}
                y={y}
                width={BAR_MAX_W}
                height={BAR_H}
                rx={3}
                fill="#1e293b"
              />
              {/* Filled bar */}
              {barW > 0 && (
                <rect
                  x={LABEL_W}
                  y={y}
                  width={barW}
                  height={BAR_H}
                  rx={3}
                  fill={color}
                  opacity={0.85}
                />
              )}
              {/* Pass count label */}
              <text
                x={LABEL_W + BAR_MAX_W + 6}
                y={y + BAR_H - 3}
                fill={color}
                fontSize={10}
              >
                {passed}/{total}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
