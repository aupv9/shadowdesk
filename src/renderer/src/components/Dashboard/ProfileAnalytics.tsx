import React, { useEffect, useState } from 'react'
import { ArrowLeft, Clock, Shield, Activity } from 'lucide-react'

interface ProfileAnalyticsProps {
  profileId: string
  onBack: () => void
}

function formatDuration(ms: number): string {
  if (!ms || ms <= 0) return '--'
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

export function ProfileAnalytics({ profileId, onBack }: ProfileAnalyticsProps) {
  const [sessions, setSessions] = useState<any[]>([])
  const [detectionResults, setDetectionResults] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [profileId])

  const loadData = async () => {
    setLoading(true)
    try {
      const [sessionData, detectionData] = await Promise.all([
        window.api.sessions.getByProfile(profileId, 20),
        window.api.detection.results(profileId)
      ])
      setSessions(sessionData)
      setDetectionResults(detectionData.slice(0, 10))
    } catch (err) {
      console.error('Failed to load profile analytics:', err)
    } finally {
      setLoading(false)
    }
  }

  const totalUsageMs = sessions.reduce((sum, s) => sum + (s.duration_ms || 0), 0)
  const profileName = sessions.length > 0 ? sessions[0].profile_name : 'Unknown Profile'

  const scoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400'
    if (score >= 60) return 'text-yellow-400'
    return 'text-red-400'
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-slate-400" />
        </button>
        <div>
          <h3 className="text-sm font-semibold text-white">{profileName}</h3>
          <p className="text-xs text-slate-500">Profile Analytics</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-500 text-sm">
          Loading analytics...
        </div>
      ) : (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="card">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-ghost-400" />
                <div>
                  <div className="text-lg font-bold text-white">{sessions.length}</div>
                  <div className="text-xs text-slate-400">Total Sessions</div>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400" />
                <div>
                  <div className="text-lg font-bold text-white">{formatDuration(totalUsageMs)}</div>
                  <div className="text-xs text-slate-400">Total Usage</div>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-green-400" />
                <div>
                  <div className={`text-lg font-bold ${detectionResults.length > 0 ? scoreColor(detectionResults[0].overallScore) : 'text-slate-500'}`}>
                    {detectionResults.length > 0 ? `${detectionResults[0].overallScore}%` : 'N/A'}
                  </div>
                  <div className="text-xs text-slate-400">Latest Score</div>
                </div>
              </div>
            </div>
          </div>

          {/* Detection Score History */}
          {detectionResults.length > 0 && (
            <div className="card">
              <h4 className="text-xs font-semibold text-white mb-3">Detection Score History</h4>
              <div className="space-y-1.5">
                {detectionResults.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 bg-slate-800/50 rounded-lg px-3 py-2">
                    <div className={`text-sm font-bold w-10 text-center ${scoreColor(r.overallScore)}`}>
                      {r.overallScore}%
                    </div>
                    <div className="flex-1 text-xs text-slate-400">
                      {formatDate(r.testedAt)}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      r.status === 'passed' ? 'bg-green-900/40 text-green-400' :
                      r.status === 'warning' ? 'bg-yellow-900/40 text-yellow-400' :
                      'bg-red-900/40 text-red-400'
                    }`}>
                      {r.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Last 5 Sessions */}
          <div className="card">
            <h4 className="text-xs font-semibold text-white mb-3">Recent Sessions</h4>
            {sessions.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No sessions recorded</p>
            ) : (
              <div className="space-y-1.5">
                {sessions.slice(0, 5).map((s) => (
                  <div key={s.id} className="flex items-center gap-3 bg-slate-800/50 rounded-lg px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-slate-300">{formatDate(s.started_at)}</div>
                      <div className="text-[10px] text-slate-500">
                        {formatDuration(s.duration_ms)} | {s.pages_visited} pages | {s.proxy_used ?? 'Direct'}
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[s.status] ?? STATUS_BADGE.completed}`}>
                      {s.status === 'active' && (
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block mr-1" />
                      )}
                      {s.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
