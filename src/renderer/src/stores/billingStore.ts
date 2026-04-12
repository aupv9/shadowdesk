import { create } from 'zustand'
import type { BillingOverview, BillingPricingPlan, BillingInvoice, UsageMeter } from '../types'

interface BillingState {
  overview: BillingOverview | null
  plans: BillingPricingPlan[]
  invoices: BillingInvoice[]
  invoiceTotal: number
  usageMeters: UsageMeter[]
  loading: boolean
  error: string | null

  fetchOverview: () => Promise<void>
  fetchPlans: () => Promise<void>
  fetchInvoices: (params?: { page?: number; limit?: number; status?: string }) => Promise<void>
  fetchUsage: () => Promise<void>
  checkout: (planId: string, interval: 'monthly' | 'yearly') => Promise<string>
  openPortal: () => Promise<string>
  changePlan: (planId: string, interval: 'monthly' | 'yearly') => Promise<void>
  cancelSubscription: () => Promise<void>
  resumeSubscription: () => Promise<void>
  applyPromo: (code: string) => Promise<{ success: boolean; discount_pct?: number; message: string }>
}

export const useBillingStore = create<BillingState>((set) => ({
  overview: null,
  plans: [],
  invoices: [],
  invoiceTotal: 0,
  usageMeters: [],
  loading: false,
  error: null,

  fetchOverview: async () => {
    set({ loading: true, error: null })
    try {
      const overview = await window.api.billing.overview()
      set({ overview, loading: false })
    } catch (err: any) {
      set({ error: err.message, loading: false })
    }
  },

  fetchPlans: async () => {
    try {
      const plans = await window.api.billing.plans()
      set({ plans })
    } catch (err: any) {
      set({ error: err.message })
    }
  },

  fetchInvoices: async (params) => {
    try {
      const result = await window.api.billing.invoices(params)
      set({ invoices: result.invoices, invoiceTotal: result.total })
    } catch (err: any) {
      set({ error: err.message })
    }
  },

  fetchUsage: async () => {
    try {
      const usageMeters = await window.api.billing.usage()
      set({ usageMeters })
    } catch (err: any) {
      set({ error: err.message })
    }
  },

  checkout: async (planId, interval) => {
    return window.api.billing.checkout(planId, interval)
  },

  openPortal: async () => {
    return window.api.billing.portal()
  },

  changePlan: async (planId, interval) => {
    set({ loading: true })
    try {
      const overview = await window.api.billing.changePlan(planId, interval)
      set({ overview, loading: false })
    } catch (err: any) {
      set({ error: err.message, loading: false })
      throw err
    }
  },

  cancelSubscription: async () => {
    set({ loading: true })
    try {
      const overview = await window.api.billing.cancel()
      set({ overview, loading: false })
    } catch (err: any) {
      set({ error: err.message, loading: false })
      throw err
    }
  },

  resumeSubscription: async () => {
    set({ loading: true })
    try {
      const overview = await window.api.billing.resume()
      set({ overview, loading: false })
    } catch (err: any) {
      set({ error: err.message, loading: false })
      throw err
    }
  },

  applyPromo: async (code) => {
    return window.api.billing.promo(code)
  }
}))
