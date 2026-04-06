import React from 'react'
import { Clock, Globe, FileText } from 'lucide-react'

interface RecentSessionsProps {
  sessions: any[]
  onProfileClick?: (profileId: string) => void
}

function formatDuration(ms: number): string {
  if (ms <= 0) return '--'
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return dateStr
  }
}

const STATUS_BADGE: Record<string, string> = {
  active:    'bg-green-900/50 text-green-400',
  completed: 'bg-slate-700 text-slate-400',
  crashed:   'bg-red-900/50 text-red-400'
}

export function RecentSessions({ sessions, onProfileClick }: RecentSessionsProps) {
  if (sessions.length === 0) {
    return (
      <div className="card">
        <h3 className="text-sm font-semibold text-white mb-4">Recent Sessions</h3>
        <div className="flex flex-col items-center justify-center py-8 text-slate-500">
          <Clock className="w-8 h-8 mb-2 opacity-50" />
          <p className="text-sm">No sessions recorded yet</p>
          <p className="text-xs text-slate-600 mt-1">Launch a profile to start tracking sessions</p>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-white mb-4">Recent Sessions</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-500 border-b border-slate-700">
              <th className="pb-2 text-left font-medium">Profile</th>
              <th className="pb-2 text-left font-medium">Started</th>
              <th className="pb-2 text-left font-medium">Duration</th>
              <th className="pb-2 text-center font-medium">Pages</th>
              <th className="pb-2 text-left font-medium">Proxy</th>
              <th className="pb-2 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr
                key={s.id}
                className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors cursor-pointer"
                onClick={() => onProfileClick?.(s.profile_id)}
              >
                <td className="py-2.5 pr-3">
                  <span className="text-white font-medium">{s.profile_name}</span>
                </td>
                <td className="py-2.5 pr-3 text-slate-400">
                  {formatDate(s.started_at)}
                </td>
                <td className="py-2.5 pr-3 text-slate-400">
                  {formatDuration(s.duration_ms)}
                </td>
                <td className="py-2.5 text-center text-slate-400">
                  {s.pages_visited}
                </td>
                <td className="py-2.5 pr-3 text-slate-500 text-xs">
                  {s.proxy_used ? (
                    <span className="flex items-center gap-1">
                      <Globe className="w-3 h-3" />
                      {s.proxy_used}
                    </span>
                  ) : (
                    <span className="text-slate-600">Direct</span>
                  )}
                </td>
                <td className="py-2.5">
                  <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[s.status] ?? STATUS_BADGE.completed}`}>
                    {s.status === 'active' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    )}
                    {s.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
