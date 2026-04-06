import { create } from 'zustand'

interface DashboardOverview {
  totalProfiles: number
  activeSessions: number
  sessionsLast30Days: number
  avgDetectionScore: number
  totalDetectionTests: number
  perDayCounts: { date: string; count: number }[]
  recentSessions: any[]
  topProfiles: any[]
  detectionTrend: { id: string; profileName: string; score: number; testedAt: string }[]
  proxyHealth: { total: number; healthy: number; unhealthy: number; untested: number }
  dbSizeBytes: number
  lastSync: any
  appVersion: string
}

interface SessionRecord {
  id: string
  profile_id: string
  profile_name: string
  started_at: string
  ended_at: string | null
  duration_ms: number
  pages_visited: number
  proxy_used: string | null
  status: 'active' | 'completed' | 'crashed'
}

interface SessionStats {
  totalSessions: number
  activeSessions: number
  totalDuration: number
  avgDuration: number
  sessionsLast30Days: number
  perDayCounts: { date: string; count: number }[]
}

interface DashboardState {
  overview: DashboardOverview | null
  sessions: SessionRecord[]
  stats: SessionStats | null
  detectionTrend: { id: string; profileName: string; score: number; testedAt: string }[]
  loadingOverview: boolean
  loadingSessions: boolean
  error: string | null
  selectedProfileId: string | null

  fetchOverview: () => Promise<void>
  fetchSessions: (filters?: { profileId?: string; limit?: number }) => Promise<void>
  fetchStats: () => Promise<void>
  fetchDetectionTrend: () => Promise<void>
  refreshAll: () => Promise<void>
  setSelectedProfileId: (id: string | null) => void
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  overview: null,
  sessions: [],
  stats: null,
  detectionTrend: [],
  loadingOverview: false,
  loadingSessions: false,
  error: null,
  selectedProfileId: null,

  fetchOverview: async () => {
    set({ loadingOverview: true, error: null })
    try {
      const overview = await window.api.dashboard.overview()
      set({
        overview,
        detectionTrend: overview.detectionTrend,
        loadingOverview: false
      })
    } catch (e: any) {
      set({ error: e.message, loadingOverview: false })
    }
  },

  fetchSessions: async (filters) => {
    set({ loadingSessions: true, error: null })
    try {
      const sessions = await window.api.sessions.list(filters)
      set({ sessions, loadingSessions: false })
    } catch (e: any) {
      set({ error: e.message, loadingSessions: false })
    }
  },

  fetchStats: async () => {
    try {
      const stats = await window.api.sessions.getStats()
      set({ stats })
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  fetchDetectionTrend: async () => {
    try {
      const results = await window.api.detection.results()
      const trend = results.slice(0, 10).map((r: any) => ({
        id: r.id,
        profileName: r.profileName,
        score: r.overallScore,
        testedAt: r.testedAt
      }))
      set({ detectionTrend: trend })
    } catch (e: any) {
      set({ error: e.message })
    }
  },

  refreshAll: async () => {
    const { fetchOverview, fetchSessions } = get()
    await Promise.all([fetchOverview(), fetchSessions()])
  },

  setSelectedProfileId: (id) => {
    set({ selectedProfileId: id })
  }
}))
