import React, { useState } from 'react'

interface TrendPoint {
  id: string
  profileName: string
  score: number
  testedAt: string
}

interface DetectionTrendProps {
  data: TrendPoint[]
}

export function DetectionTrend({ data }: DetectionTrendProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  if (data.length === 0) {
    return (
      <div className="card">
        <h3 className="text-sm font-semibold text-white mb-4">Detection Score Trend</h3>
        <div className="flex items-center justify-center h-40 text-sm text-slate-500">
          No detection tests yet. Run a test from the Detection page.
        </div>
      </div>
    )
  }

  // Reverse to show oldest first (left to right)
  const points = [...data].reverse()

  const width = 500
  const height = 160
  const padX = 40
  const padY = 20
  const plotW = width - padX * 2
  const plotH = height - padY * 2

  const xStep = points.length > 1 ? plotW / (points.length - 1) : plotW / 2

  const coords = points.map((p, i) => ({
    x: padX + i * xStep,
    y: padY + plotH - (p.score / 100) * plotH,
    ...p
  }))

  const polylinePoints = coords.map((c) => `${c.x},${c.y}`).join(' ')

  const scoreColor = (score: number) => {
    if (score >= 80) return '#4ade80'
    if (score >= 60) return '#facc15'
    return '#f87171'
  }

  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-white mb-4">Detection Score Trend (Last 10 Tests)</h3>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
        {/* Color zone backgrounds */}
        <rect x={padX} y={padY} width={plotW} height={plotH * 0.2}
              fill="#f8717120" rx="2" />
        <rect x={padX} y={padY + plotH * 0.2} width={plotW} height={plotH * 0.2}
              fill="#facc1510" rx="2" />
        <rect x={padX} y={padY + plotH * 0.4} width={plotW} height={plotH * 0.6}
              fill="#4ade8008" rx="2" />

        {/* Y-axis labels */}
        <text x={padX - 6} y={padY + 4} textAnchor="end" className="fill-slate-500" fontSize="9">100</text>
        <text x={padX - 6} y={padY + plotH * 0.2 + 4} textAnchor="end" className="fill-slate-500" fontSize="9">80</text>
        <text x={padX - 6} y={padY + plotH * 0.4 + 4} textAnchor="end" className="fill-slate-500" fontSize="9">60</text>
        <text x={padX - 6} y={padY + plotH + 4} textAnchor="end" className="fill-slate-500" fontSize="9">0</text>

        {/* Grid lines */}
        <line x1={padX} y1={padY + plotH * 0.2} x2={padX + plotW} y2={padY + plotH * 0.2}
              stroke="#334155" strokeWidth="0.5" />
        <line x1={padX} y1={padY + plotH * 0.4} x2={padX + plotW} y2={padY + plotH * 0.4}
              stroke="#334155" strokeWidth="0.5" />

        {/* Polyline */}
        <polyline
          points={polylinePoints}
          fill="none"
          stroke="#818cf8"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {coords.map((c, i) => (
          <g key={c.id}>
            <circle
              cx={c.x}
              cy={c.y}
              r={hoveredIdx === i ? 5 : 3.5}
              fill={scoreColor(c.score)}
              stroke="#0f172a"
              strokeWidth="1.5"
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              className="cursor-pointer"
            />
            {hoveredIdx === i && (
              <>
                <rect
                  x={c.x - 50}
                  y={c.y - 32}
                  width="100"
                  height="22"
                  rx="4"
                  fill="#1e293b"
                  stroke="#334155"
                  strokeWidth="0.5"
                />
                <text
                  x={c.x}
                  y={c.y - 18}
                  textAnchor="middle"
                  className="fill-white"
                  fontSize="9"
                  fontWeight="600"
                >
                  {c.profileName}: {c.score}%
                </text>
              </>
            )}
          </g>
        ))}

        {/* X-axis date labels */}
        {coords.map((c, i) => {
          // Only show every other label if crowded
          if (coords.length > 6 && i % 2 !== 0 && i !== coords.length - 1) return null
          const dateStr = new Date(c.testedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          return (
            <text
              key={`label-${c.id}`}
              x={c.x}
              y={height - 2}
              textAnchor="middle"
              className="fill-slate-500"
              fontSize="8"
            >
              {dateStr}
            </text>
          )
        })}
      </svg>
    </div>
  )
}
