import React from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

type ColorVariant = 'blue' | 'green' | 'yellow' | 'red'
type Trend = 'up' | 'down' | 'neutral'

interface StatCardProps {
  icon: React.ElementType
  label: string
  value: string | number
  color?: ColorVariant
  trend?: Trend
  trendLabel?: string
}

const COLOR_MAP: Record<ColorVariant, { bg: string; icon: string }> = {
  blue:   { bg: 'bg-blue-500/20',   icon: 'text-blue-400' },
  green:  { bg: 'bg-green-500/20',  icon: 'text-green-400' },
  yellow: { bg: 'bg-yellow-500/20', icon: 'text-yellow-400' },
  red:    { bg: 'bg-red-500/20',    icon: 'text-red-400' }
}

const TREND_MAP: Record<Trend, { icon: React.ElementType; color: string }> = {
  up:      { icon: TrendingUp,   color: 'text-green-400' },
  down:    { icon: TrendingDown, color: 'text-red-400' },
  neutral: { icon: Minus,        color: 'text-slate-500' }
}

export function StatCard({ icon: Icon, label, value, color = 'blue', trend, trendLabel }: StatCardProps) {
  const colors = COLOR_MAP[color]
  const trendInfo = trend ? TREND_MAP[trend] : null

  return (
    <div className="card">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg ${colors.bg} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${colors.icon}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-2xl font-bold text-white">{value}</div>
          <div className="text-xs text-slate-400">{label}</div>
        </div>
        {trendInfo && (
          <div className={`flex items-center gap-1 ${trendInfo.color}`}>
            <trendInfo.icon className="w-3.5 h-3.5" />
            {trendLabel && <span className="text-xs">{trendLabel}</span>}
          </div>
        )}
      </div>
    </div>
  )
}
