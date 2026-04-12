import React, { useEffect } from 'react'
import {
  BarChart3, Users, Shield, Globe, TrendingUp,
  Activity, RefreshCw, Wifi, WifiOff
} from 'lucide-react'
import { useAnalyticsStore } from '../../stores/analyticsStore'

export function AnalyticsDashboardPage() {
  const { data, loading, error, fetchDashboard } = useAnalyticsStore()

  useEffect(() => {
    fetchDashboard()
  }, [])

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-indigo-400" />
            Analytics Dashboard
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Usage metrics, detection scores and profile insights
          </p>
        </div>
        <button
          onClick={fetchDashboard}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={<Users className="w-5 h-5 text-blue-400" />}
          label="Total Profiles"
          value={data?.total_profiles ?? 0}
          color="blue"
        />
        <StatCard
          icon={<Activity className="w-5 h-5 text-green-400" />}
          label="Active Sessions"
          value={data?.active_sessions ?? 0}
          color="green"
        />
        <StatCard
          icon={<Shield className="w-5 h-5 text-purple-400" />}
          label="Avg Detection Score"
          value={data?.avg_detection_score != null
            ? `${Math.round(data.avg_detection_score)}%`
            : 'N/A'
          }
          color="purple"
        />
        <StatCard
          icon={<Globe className="w-5 h-5 text-amber-400" />}
          label="Proxy Health"
          value={data ? `${data.proxy_health.healthy}/${data.proxy_health.healthy + data.proxy_health.unhealthy + data.proxy_health.untested}` : '0/0'}
          color="amber"
        />
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Detection Score Trend */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
          <h3 className="text-white font-medium mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-purple-400" />
            Detection Score Trend (30 days)
          </h3>
          {data?.detection_trend && data.detection_trend.length > 0 ? (
            <div className="space-y-2">
              {data.detection_trend.slice(-10).map((d) => (
                <div key={d.date} className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 w-20">{d.date}</span>
                  <div className="flex-1 bg-slate-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        d.score >= 90 ? 'bg-green-500' :
                        d.score >= 70 ? 'bg-amber-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(d.score, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-300 w-10 text-right">{Math.round(d.score)}%</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-sm">No detection test data yet</p>
          )}
        </div>

        {/* Profile Creation Trend */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
          <h3 className="text-white font-medium mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-400" />
            Profile Creation (30 days)
          </h3>
          {data?.profile_creation_trend && data.profile_creation_trend.length > 0 ? (
            <div className="space-y-2">
              {data.profile_creation_trend.slice(-10).map((d) => (
                <div key={d.date} className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 w-20">{d.date}</span>
                  <div className="flex-1 bg-slate-700 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-blue-500"
                      style={{ width: `${Math.min(d.count * 10, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-300 w-10 text-right">{d.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-sm">No profile creation data yet</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Top Presets */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
          <h3 className="text-white font-medium mb-4">Top Fingerprint Presets</h3>
          {data?.top_presets && data.top_presets.length > 0 ? (
            <div className="space-y-3">
              {data.top_presets.map((p, i) => (
                <div key={p.preset} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 w-5">{i + 1}.</span>
                    <span className="text-sm text-slate-300 font-mono">{p.preset || 'custom'}</span>
                  </div>
                  <span className="text-xs bg-slate-700 px-2 py-0.5 rounded text-slate-300">
                    {p.count} profiles
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-sm">No preset data</p>
          )}
        </div>

        {/* Proxy Health Breakdown */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
          <h3 className="text-white font-medium mb-4">Proxy Health</h3>
          {data ? (
            <div className="space-y-4">
              <ProxyHealthRow
                icon={<Wifi className="w-4 h-4 text-green-400" />}
                label="Healthy"
                count={data.proxy_health.healthy}
                total={data.proxy_health.healthy + data.proxy_health.unhealthy + data.proxy_health.untested}
                color="green"
              />
              <ProxyHealthRow
                icon={<WifiOff className="w-4 h-4 text-red-400" />}
                label="Unhealthy"
                count={data.proxy_health.unhealthy}
                total={data.proxy_health.healthy + data.proxy_health.unhealthy + data.proxy_health.untested}
                color="red"
              />
              <ProxyHealthRow
                icon={<Globe className="w-4 h-4 text-slate-400" />}
                label="Untested"
                count={data.proxy_health.untested}
                total={data.proxy_health.healthy + data.proxy_health.unhealthy + data.proxy_health.untested}
                color="slate"
              />
            </div>
          ) : (
            <p className="text-slate-500 text-sm">Loading...</p>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, color }: {
  icon: React.ReactNode
  label: string
  value: string | number
  color: string
}) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs text-slate-400">{label}</span></div>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  )
}

function ProxyHealthRow({ icon, label, count, total, color }: {
  icon: React.ReactNode
  label: string
  count: number
  total: number
  color: string
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      {icon}
      <span className="text-sm text-slate-300 w-20">{label}</span>
      <div className="flex-1 bg-slate-700 rounded-full h-2">
        <div
          className={`h-2 rounded-full ${
            color === 'green' ? 'bg-green-500' :
            color === 'red' ? 'bg-red-500' : 'bg-slate-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-slate-400 w-12 text-right">{count} ({pct}%)</span>
    </div>
  )
}
