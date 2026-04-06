import React from 'react'
import { Trophy } from 'lucide-react'

interface TopProfilesProps {
  profiles: any[]
}

function formatDuration(ms: number): string {
  if (!ms || ms <= 0) return '--'
  const minutes = Math.floor(ms / 60000)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
  } catch {
    return dateStr
  }
}

const RANK_COLORS = ['text-yellow-400', 'text-slate-300', 'text-amber-600']

export function TopProfiles({ profiles }: TopProfilesProps) {
  if (profiles.length === 0) {
    return (
      <div className="card">
        <h3 className="text-sm font-semibold text-white mb-4">Top Profiles (Last 30 Days)</h3>
        <div className="flex flex-col items-center justify-center py-6 text-slate-500">
          <Trophy className="w-8 h-8 mb-2 opacity-50" />
          <p className="text-sm">No profile usage data yet</p>
        </div>
      </div>
    )
  }

  const maxCount = Math.max(...profiles.map((p) => p.session_count), 1)

  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-white mb-4">Top Profiles (Last 30 Days)</h3>
      <div className="space-y-2.5">
        {profiles.map((p, idx) => {
          const barWidth = (p.session_count / maxCount) * 100
          return (
            <div key={p.profile_id} className="flex items-center gap-3">
              <span className={`w-5 text-xs font-bold text-center ${RANK_COLORS[idx] ?? 'text-slate-500'}`}>
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-white font-medium truncate">{p.profile_name}</span>
                  <div className="flex items-center gap-3 text-xs text-slate-400 shrink-0 ml-2">
                    <span>{p.session_count} sessions</span>
                    <span>{formatDuration(p.avg_duration)}</span>
                    <span>{formatDate(p.last_used)}</span>
                  </div>
                </div>
                <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-ghost-600/60 rounded-full transition-all"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
