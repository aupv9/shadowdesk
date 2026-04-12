import { shell } from 'electron'
import { apiRequest } from './api-client'

/**
 * Phase 2 — Billing & Subscription Service
 *
 * Integrates with the Common SaaS API's billing endpoints to provide:
 * - Stripe checkout session creation (redirects to Stripe-hosted page)
 * - Customer portal for managing payment methods & subscriptions
 * - Invoice listing and download
 * - Subscription upgrade/downgrade
 * - Usage-based billing meter reads
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface BillingOverview {
  subscription_id: string | null
  plan_id: string | null
  plan_name: string | null
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid' | 'none'
  current_period_start: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  trial_end: string | null
  payment_method: PaymentMethodSummary | null
  upcoming_invoice: UpcomingInvoice | null
}

export interface PaymentMethodSummary {
  type: 'card' | 'bank_transfer' | 'paypal'
  last4?: string
  brand?: string
  exp_month?: number
  exp_year?: number
}

export interface UpcomingInvoice {
  amount_due: number
  currency: string
  next_payment_date: string
  line_items: Array<{
    description: string
    quantity: number
    unit_amount: number
    amount: number
  }>
}

export interface Invoice {
  id: string
  number: string
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible'
  amount_due: number
  amount_paid: number
  currency: string
  created_at: string
  paid_at: string | null
  pdf_url: string | null
  hosted_url: string | null
}

export interface CheckoutSession {
  checkout_url: string
  session_id: string
}

export interface PricingPlan {
  id: string
  name: string
  description: string
  price_monthly: number
  price_yearly: number
  currency: string
  features: Record<string, unknown>
  limits: {
    max_profiles: number
    max_team_members: number
    max_workflows: number
    cloud_sync: boolean
    api_access: boolean
    priority_support: boolean
  }
  popular?: boolean
}

export interface UsageMeter {
  meter_id: string
  name: string
  current_usage: number
  limit: number | null
  unit: string
  reset_at: string | null
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Fetch full billing overview for the authenticated user. */
export async function getBillingOverview(): Promise<BillingOverview> {
  return apiRequest<BillingOverview>('/billing/overview')
}

/** List available pricing plans. */
export async function getPricingPlans(): Promise<PricingPlan[]> {
  return apiRequest<PricingPlan[]>('/billing/plans')
}

/**
 * Create a Stripe checkout session and return the URL.
 * Opens the URL in the user's default browser.
 */
export async function createCheckoutSession(planId: string, interval: 'monthly' | 'yearly'): Promise<CheckoutSession> {
  const session = await apiRequest<CheckoutSession>('/billing/checkout', {
    method: 'POST',
    body: { plan_id: planId, interval }
  })
  return session
}

/**
 * Open the Stripe checkout URL in the user's default browser.
 * Call createCheckoutSession first to get the URL.
 */
export async function openCheckout(planId: string, interval: 'monthly' | 'yearly'): Promise<string> {
  const session = await createCheckoutSession(planId, interval)
  await shell.openExternal(session.checkout_url)
  return session.session_id
}

/** Create a Stripe Customer Portal session and open it. */
export async function openCustomerPortal(): Promise<string> {
  const result = await apiRequest<{ portal_url: string }>('/billing/portal', {
    method: 'POST'
  })
  await shell.openExternal(result.portal_url)
  return result.portal_url
}

/** Change subscription plan (upgrade/downgrade). */
export async function changePlan(planId: string, interval: 'monthly' | 'yearly'): Promise<BillingOverview> {
  return apiRequest<BillingOverview>('/billing/subscription/change', {
    method: 'POST',
    body: { plan_id: planId, interval }
  })
}

/** Cancel subscription (at period end). */
export async function cancelSubscription(): Promise<BillingOverview> {
  return apiRequest<BillingOverview>('/billing/subscription/cancel', {
    method: 'POST'
  })
}

/** Resume a canceled subscription (before period end). */
export async function resumeSubscription(): Promise<BillingOverview> {
  return apiRequest<BillingOverview>('/billing/subscription/resume', {
    method: 'POST'
  })
}

/** Fetch invoices with pagination. */
export async function listInvoices(params?: {
  page?: number
  limit?: number
  status?: string
}): Promise<{ invoices: Invoice[]; total: number }> {
  const query = new URLSearchParams()
  if (params?.page) query.set('page', String(params.page))
  if (params?.limit) query.set('limit', String(params.limit))
  if (params?.status) query.set('status', params.status)
  const qs = query.toString()

  return apiRequest<{ invoices: Invoice[]; total: number }>(
    `/billing/invoices${qs ? `?${qs}` : ''}`
  )
}

/** Open an invoice PDF or hosted page in the browser. */
export async function openInvoice(invoiceId: string): Promise<void> {
  const invoice = await apiRequest<Invoice>(`/billing/invoices/${invoiceId}`)
  const url = invoice.hosted_url ?? invoice.pdf_url
  if (url) {
    await shell.openExternal(url)
  }
}

/** Fetch current usage meters (profiles, API calls, sync storage). */
export async function getUsageMeters(): Promise<UsageMeter[]> {
  return apiRequest<UsageMeter[]>('/billing/usage')
}

/** Apply a promo/coupon code to the current subscription. */
export async function applyPromoCode(code: string): Promise<{ success: boolean; discount_pct?: number; message: string }> {
  return apiRequest('/billing/promo', {
    method: 'POST',
    body: { code }
  })
}
