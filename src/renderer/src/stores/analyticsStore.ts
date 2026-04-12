import { create } from 'zustand'
import type { AnalyticsDashboardData } from '../types'

interface AnalyticsState {
  data: AnalyticsDashboardData | null
  loading: boolean
  error: string | null

  fetchDashboard: () => Promise<void>
  fetchRemoteDashboard: () => Promise<void>
  reportUsage: (activeSessions: number) => Promise<void>
  trackFeature: (feature: string, action: string, metadata?: Record<string, unknown>) => void
}

export const useAnalyticsStore = create<AnalyticsState>((set) => ({
  data: null,
  loading: false,
  error: null,

  fetchDashboard: async () => {
    set({ loading: true, error: null })
    try {
      const data = await window.api.analytics.dashboard()
      set({ data, loading: false })
    } catch (err: any) {
      set({ error: err.message, loading: false })
    }
  },

  fetchRemoteDashboard: async () => {
    set({ loading: true, error: null })
    try {
      const data = await window.api.analytics.dashboardRemote()
      set({ data, loading: false })
    } catch (err: any) {
      set({ error: err.message, loading: false })
    }
  },

  reportUsage: async (activeSessions: number) => {
    try {
      await window.api.analytics.reportUsage(activeSessions)
    } catch {
      // Best-effort
    }
  },

  trackFeature: (feature: string, action: string, metadata?: Record<string, unknown>) => {
    try {
      window.api.analytics.trackFeature(feature, action, metadata)
    } catch {
      // Best-effort
    }
  }
}))
