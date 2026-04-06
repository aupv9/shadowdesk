import React, { useEffect, useState } from 'react'
import {
  LayoutGrid, Activity, BarChart3, Shield, RefreshCw
} from 'lucide-react'
import { Header } from '../Layout/Header'
import { StatCard } from './StatCard'
import { ActivityChart } from './ActivityChart'
import { DetectionTrend } from './DetectionTrend'
import { RecentSessions } from './RecentSessions'
import { TopProfiles } from './TopProfiles'
import { SystemHealth } from './SystemHealth'
import { ProfileAnalytics } from './ProfileAnalytics'
import { useDashboardStore } from '../../stores/dashboardStore'

export function DashboardPage() {
  const {
    overview,
    loadingOverview,
    fetchOverview,
    selectedProfileId,
    setSelectedProfileId
  } = useDashboardStore()

  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    fetchOverview()
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchOverview()
    setRefreshing(false)
  }

  if (selectedProfileId) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Profile Analytics" subtitle="Detailed analytics for a specific profile" />
        <div className="flex-1 overflow-y-auto p-6">
          <ProfileAnalytics
            profileId={selectedProfileId}
            onBack={() => setSelectedProfileId(null)}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Dashboard"
        subtitle="Overview of your browser profiles, sessions, and detection status"
        actions={
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        {loadingOverview && !overview ? (
          <div className="flex items-center justify-center h-64 text-slate-500 text-sm">
            Loading dashboard...
          </div>
        ) : overview ? (
          <div className="space-y-6">
            {/* Overview Cards */}
            <div className="grid grid-cols-4 gap-4">
              <StatCard
                icon={LayoutGrid}
                label="Total Profiles"
                value={overview.totalProfiles}
                color="blue"
              />
              <StatCard
                icon={Activity}
                label="Active Sessions"
                value={overview.activeSessions}
                color="green"
              />
              <StatCard
                icon={BarChart3}
                label="Sessions (30d)"
                value={overview.sessionsLast30Days}
                color="yellow"
              />
              <StatCard
                icon={Shield}
                label="Avg Detection Score"
                value={overview.avgDetectionScore > 0 ? `${overview.avgDetectionScore}%` : 'N/A'}
                color={overview.avgDetectionScore >= 80 ? 'green' : overview.avgDetectionScore >= 60 ? 'yellow' : 'red'}
              />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-2 gap-4">
              <ActivityChart data={overview.perDayCounts} />
              <DetectionTrend data={overview.detectionTrend} />
            </div>

            {/* Bottom Row: Recent Sessions + Sidebar */}
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-4">
                <RecentSessions
                  sessions={overview.recentSessions}
                  onProfileClick={(id) => setSelectedProfileId(id)}
                />
              </div>
              <div className="space-y-4">
                <TopProfiles profiles={overview.topProfiles} />
                <SystemHealth
                  proxyHealth={overview.proxyHealth}
                  activeSessions={overview.activeSessions}
                  dbSizeBytes={overview.dbSizeBytes}
                  lastSync={overview.lastSync}
                  appVersion={overview.appVersion}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-64 text-slate-500 text-sm">
            Failed to load dashboard data. Click Refresh to try again.
          </div>
        )}
      </div>
    </div>
  )
}
