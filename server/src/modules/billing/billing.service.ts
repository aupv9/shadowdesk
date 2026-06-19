import { v4 as uuid } from 'uuid'
import { getDatabase } from '../../config/database'
import { badRequest, notFound } from '../../utils/errors'
import { env } from '../../config/env'
import type { BillingOverview, PricingPlan, CheckoutSession, Invoice, UsageMeter } from '../../types'

/**
 * Billing — STUB implementation.
 *
 * No real payment provider is wired up. Subscriptions are tracked in the
 * local `subscriptions` table and checkout/portal return placeholder URLs.
 * The contract matches the desktop client so the UI is fully functional;
 * swapping in Stripe later means replacing the provider calls here plus a
 * `POST /billing/webhook` handler, without changing the public API.
 */

const STORAGE_LIMIT_BYTES = 5 * 1024 * 1024 * 1024

const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'Get started with core anti-detect features.',
    price_monthly: 0,
    price_yearly: 0,
    currency: 'usd',
    features: { profiles: 'Up to 5 profiles', sync: false, support: 'Community' },
    limits: {
      max_profiles: 5,
      max_team_members: 1,
      max_workflows: 5,
      cloud_sync: false,
      api_access: false,
      priority_support: false
    }
  },
  {
    id: 'pro',
    name: 'Professional',
    description: 'For power users and growing teams.',
    price_monthly: 2900,
    price_yearly: 29000,
    currency: 'usd',
    features: { profiles: 'Up to 500 profiles', sync: true, api: true, support: 'Priority' },
    limits: {
      max_profiles: 500,
      max_team_members: 15,
      max_workflows: 100,
      cloud_sync: true,
      api_access: true,
      priority_support: true
    },
    popular: true
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Unlimited scale with dedicated support.',
    price_monthly: 9900,
    price_yearly: 99000,
    currency: 'usd',
    features: { profiles: 'Unlimited', sync: true, api: true, support: 'Dedicated' },
    limits: {
      max_profiles: -1,
      max_team_members: -1,
      max_workflows: -1,
      cloud_sync: true,
      api_access: true,
      priority_support: true
    }
  }
]

const PROMO_CODES: Record<string, number> = { WELCOME20: 20, SEA50: 50 }

export class BillingService {
  getPlans(): PricingPlan[] {
    return PRICING_PLANS
  }

  async getOverview(userId: string): Promise<BillingOverview> {
    const db = getDatabase()
    const sub = await db('subscriptions').where({ user_id: userId }).first()

    if (!sub || sub.status === 'none') {
      return {
        subscription_id: null,
        plan_id: null,
        plan_name: null,
        status: 'none',
        current_period_start: null,
        current_period_end: null,
        cancel_at_period_end: false,
        trial_end: null,
        payment_method: null,
        upcoming_invoice: null
      }
    }

    const plan = PRICING_PLANS.find((p) => p.id === sub.plan_id)
    return {
      subscription_id: sub.id,
      plan_id: sub.plan_id,
      plan_name: sub.plan_name ?? plan?.name ?? null,
      status: sub.status,
      current_period_start: sub.current_period_start,
      current_period_end: sub.current_period_end,
      cancel_at_period_end: Boolean(sub.cancel_at_period_end),
      trial_end: sub.trial_end ?? null,
      payment_method: null,
      upcoming_invoice: null
    }
  }

  async checkout(userId: string, planId: string, interval: 'monthly' | 'yearly'): Promise<CheckoutSession> {
    await this.upsertSubscription(userId, planId, interval)
    const sessionId = `cs_stub_${uuid()}`
    return {
      checkout_url: `${env.APP_URL}/billing/mock-checkout?session=${sessionId}`,
      session_id: sessionId
    }
  }

  async portal(userId: string): Promise<{ portal_url: string }> {
    return { portal_url: `${env.APP_URL}/billing/mock-portal?u=${encodeURIComponent(userId)}` }
  }

  async changePlan(userId: string, planId: string, interval: 'monthly' | 'yearly'): Promise<BillingOverview> {
    await this.upsertSubscription(userId, planId, interval)
    return this.getOverview(userId)
  }

  async cancel(userId: string): Promise<BillingOverview> {
    const db = getDatabase()
    await db('subscriptions').where({ user_id: userId }).update({ cancel_at_period_end: true, updated_at: new Date() })
    return this.getOverview(userId)
  }

  async resume(userId: string): Promise<BillingOverview> {
    const db = getDatabase()
    await db('subscriptions').where({ user_id: userId }).update({ cancel_at_period_end: false, updated_at: new Date() })
    return this.getOverview(userId)
  }

  async listInvoices(
    userId: string,
    opts: { page: number; limit: number; status?: string }
  ): Promise<{ invoices: Invoice[]; total: number }> {
    const db = getDatabase()
    const scoped = () => {
      const q = db('invoices').where({ user_id: userId })
      return opts.status ? q.andWhere({ status: opts.status }) : q
    }
    const rows = await scoped().orderBy('created_at', 'desc').limit(opts.limit).offset((opts.page - 1) * opts.limit)
    const totalRow = await scoped().count({ count: '*' }).first()
    return { invoices: rows.map((r) => this.formatInvoice(r)), total: Number(totalRow?.count ?? 0) }
  }

  async getInvoice(userId: string, id: string): Promise<Invoice> {
    const db = getDatabase()
    const row = await db('invoices').where({ id, user_id: userId }).first()
    if (!row) throw notFound('Invoice not found')
    return this.formatInvoice(row)
  }

  async getUsage(userId: string): Promise<UsageMeter[]> {
    const db = getDatabase()
    const cpCount = await db('cloud_profiles').where({ user_id: userId }).count({ c: '*' }).first()
    const cpSize = await db('cloud_profiles').where({ user_id: userId }).sum({ s: 'size_bytes' }).first()

    const since = new Date(Date.now() - 30 * 86400000)
    const apiRow = await db('api_key_usage')
      .join('api_keys', 'api_key_usage.api_key_id', 'api_keys.id')
      .where('api_keys.user_id', userId)
      .andWhere('api_key_usage.created_at', '>=', since)
      .count({ c: '*' })
      .first()

    const sub = await db('subscriptions').where({ user_id: userId }).first()
    const plan = PRICING_PLANS.find((p) => p.id === (sub?.plan_id ?? 'free')) ?? PRICING_PLANS[0]

    return [
      {
        meter_id: 'cloud_profiles',
        name: 'Cloud Profiles',
        current_usage: Number(cpCount?.c ?? 0),
        limit: plan.limits.max_profiles < 0 ? null : plan.limits.max_profiles,
        unit: 'profiles',
        reset_at: null
      },
      {
        meter_id: 'api_requests',
        name: 'API Requests (30d)',
        current_usage: Number(apiRow?.c ?? 0),
        limit: plan.limits.api_access ? null : 0,
        unit: 'requests',
        reset_at: null
      },
      {
        meter_id: 'cloud_storage',
        name: 'Cloud Storage',
        current_usage: Number(cpSize?.s ?? 0),
        limit: STORAGE_LIMIT_BYTES,
        unit: 'bytes',
        reset_at: null
      }
    ]
  }

  applyPromo(code: string): { success: boolean; discount_pct?: number; message: string } {
    const pct = PROMO_CODES[code.toUpperCase()]
    if (pct) return { success: true, discount_pct: pct, message: `Promo applied: ${pct}% off` }
    return { success: false, message: 'Invalid or expired promo code' }
  }

  private async upsertSubscription(userId: string, planId: string, interval: 'monthly' | 'yearly'): Promise<void> {
    const db = getDatabase()
    const plan = PRICING_PLANS.find((p) => p.id === planId)
    if (!plan) throw badRequest('Unknown plan', 'unknown_plan')

    const now = new Date()
    const periodEnd = new Date(now.getTime() + (interval === 'yearly' ? 365 : 30) * 86400000)
    const existing = await db('subscriptions').where({ user_id: userId }).first()

    const record = {
      plan_id: planId,
      plan_name: plan.name,
      status: 'active',
      interval,
      current_period_start: now,
      current_period_end: periodEnd,
      cancel_at_period_end: false,
      updated_at: now
    }

    if (existing) {
      await db('subscriptions').where({ user_id: userId }).update(record)
    } else {
      await db('subscriptions').insert({ id: uuid(), user_id: userId, created_at: now, ...record })
    }
  }

  private formatInvoice(row: any): Invoice {
    return {
      id: row.id,
      number: row.number,
      status: row.status,
      amount_due: row.amount_due ?? 0,
      amount_paid: row.amount_paid ?? 0,
      currency: row.currency ?? 'usd',
      created_at: row.created_at,
      paid_at: row.paid_at ?? null,
      pdf_url: row.pdf_url ?? null,
      hosted_url: row.hosted_url ?? null
    }
  }
}

export const billingService = new BillingService()
