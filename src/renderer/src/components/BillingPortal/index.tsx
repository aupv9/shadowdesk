import React, { useEffect, useState } from 'react'
import {
  CreditCard, Receipt, Package, ExternalLink,
  RefreshCw, CheckCircle, AlertTriangle, XCircle,
  Zap, BarChart3, Tag
} from 'lucide-react'
import { useBillingStore } from '../../stores/billingStore'
import { useToastStore } from '../../stores/toastStore'

const STATUS_BADGE: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  active:    { label: 'Active',    color: 'bg-green-500/20 text-green-400',  icon: CheckCircle },
  trialing:  { label: 'Trial',     color: 'bg-blue-500/20 text-blue-400',   icon: Zap },
  past_due:  { label: 'Past Due',  color: 'bg-amber-500/20 text-amber-400', icon: AlertTriangle },
  canceled:  { label: 'Canceled',  color: 'bg-red-500/20 text-red-400',     icon: XCircle },
  unpaid:    { label: 'Unpaid',    color: 'bg-red-500/20 text-red-400',     icon: AlertTriangle },
  none:      { label: 'No Plan',   color: 'bg-slate-500/20 text-slate-400', icon: Package }
}

type TabId = 'overview' | 'plans' | 'invoices' | 'usage'

export function BillingPortal() {
  const [tab, setTab] = useState<TabId>('overview')
  const store = useBillingStore()
  const pushToast = useToastStore((s) => s.push)

  useEffect(() => {
    store.fetchOverview()
    store.fetchPlans()
    store.fetchUsage()
  }, [])

  const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Overview',  icon: CreditCard },
    { id: 'plans',    label: 'Plans',     icon: Package },
    { id: 'invoices', label: 'Invoices',  icon: Receipt },
    { id: 'usage',    label: 'Usage',     icon: BarChart3 }
  ]

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-emerald-400" />
            Billing & Subscription
          </h1>
          <p className="text-slate-400 text-sm mt-1">Manage your plan, payment methods and invoices</p>
        </div>
        <button
          onClick={() => store.openPortal().then(() => pushToast('Opened billing portal', 'success')).catch(() => pushToast('Failed to open portal', 'error'))}
          className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm"
        >
          <ExternalLink className="w-4 h-4" />
          Manage Payment
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-800/50 p-1 rounded-lg w-fit">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); if (t.id === 'invoices') store.fetchInvoices() }}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm transition-colors ${
              tab === t.id ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {store.error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {store.error}
        </div>
      )}

      {tab === 'overview' && <OverviewTab />}
      {tab === 'plans' && <PlansTab />}
      {tab === 'invoices' && <InvoicesTab />}
      {tab === 'usage' && <UsageTab />}
    </div>
  )
}

function OverviewTab() {
  const { overview, loading } = useBillingStore()
  const pushToast = useToastStore((s) => s.push)
  const store = useBillingStore()
  const [promoCode, setPromoCode] = useState('')

  if (loading && !overview) {
    return <div className="text-slate-400">Loading billing information...</div>
  }

  const status = STATUS_BADGE[overview?.status ?? 'none']
  const StatusIcon = status?.icon ?? Package

  return (
    <div className="space-y-6">
      {/* Subscription Status */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <h3 className="text-white font-medium mb-4">Current Subscription</h3>
        <div className="grid grid-cols-3 gap-6">
          <div>
            <p className="text-xs text-slate-400 mb-1">Plan</p>
            <p className="text-lg font-semibold text-white">{overview?.plan_name ?? 'Free'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">Status</p>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${status?.color}`}>
              <StatusIcon className="w-3 h-3" />
              {status?.label}
            </span>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">Period</p>
            <p className="text-sm text-slate-300">
              {overview?.current_period_end
                ? `Renews ${new Date(overview.current_period_end).toLocaleDateString()}`
                : 'N/A'
              }
            </p>
          </div>
        </div>

        {overview?.cancel_at_period_end && (
          <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 text-sm flex items-center justify-between">
            <span>Your subscription will be canceled at the end of the current period</span>
            <button
              onClick={() => store.resumeSubscription().then(() => pushToast('Subscription resumed', 'success'))}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs"
            >
              Resume
            </button>
          </div>
        )}
      </div>

      {/* Payment Method */}
      {overview?.payment_method && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h3 className="text-white font-medium mb-3">Payment Method</h3>
          <div className="flex items-center gap-3">
            <CreditCard className="w-8 h-8 text-slate-400" />
            <div>
              <p className="text-sm text-white">
                {overview.payment_method.brand?.toUpperCase() ?? 'Card'} ending in {overview.payment_method.last4}
              </p>
              <p className="text-xs text-slate-400">
                Expires {overview.payment_method.exp_month}/{overview.payment_method.exp_year}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Upcoming Invoice */}
      {overview?.upcoming_invoice && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h3 className="text-white font-medium mb-3">Next Invoice</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-white">
                {formatCurrency(overview.upcoming_invoice.amount_due, overview.upcoming_invoice.currency)}
              </p>
              <p className="text-xs text-slate-400">
                Due {new Date(overview.upcoming_invoice.next_payment_date).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Promo Code */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <h3 className="text-white font-medium mb-3 flex items-center gap-2">
          <Tag className="w-4 h-4 text-purple-400" />
          Promo Code
        </h3>
        <div className="flex gap-2">
          <input
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value)}
            placeholder="Enter promo code"
            className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
          />
          <button
            onClick={async () => {
              if (!promoCode.trim()) return
              try {
                const res = await store.applyPromo(promoCode.trim())
                pushToast(res.message, res.success ? 'success' : 'error')
                if (res.success) { setPromoCode(''); store.fetchOverview() }
              } catch { pushToast('Failed to apply code', 'error') }
            }}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}

function PlansTab() {
  const { plans, overview, loading } = useBillingStore()
  const store = useBillingStore()
  const pushToast = useToastStore((s) => s.push)
  const [interval, setInterval_] = useState<'monthly' | 'yearly'>('monthly')

  return (
    <div className="space-y-6">
      {/* Interval Toggle */}
      <div className="flex justify-center gap-2 bg-slate-800/50 p-1 rounded-lg w-fit mx-auto">
        <button
          onClick={() => setInterval_('monthly')}
          className={`px-4 py-2 rounded-md text-sm ${interval === 'monthly' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}
        >
          Monthly
        </button>
        <button
          onClick={() => setInterval_('yearly')}
          className={`px-4 py-2 rounded-md text-sm ${interval === 'yearly' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}
        >
          Yearly <span className="text-emerald-400 text-xs ml-1">Save 20%</span>
        </button>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-3 gap-4">
        {plans.map((plan) => {
          const isCurrent = plan.id === overview?.plan_id
          const price = interval === 'monthly' ? plan.price_monthly : plan.price_yearly
          return (
            <div
              key={plan.id}
              className={`relative bg-slate-800/50 border rounded-xl p-6 ${
                plan.popular ? 'border-emerald-500' : 'border-slate-700'
              } ${isCurrent ? 'ring-2 ring-emerald-400/50' : ''}`}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-emerald-600 text-white text-xs rounded-full">
                  Most Popular
                </span>
              )}
              <h3 className="text-lg font-bold text-white">{plan.name}</h3>
              <p className="text-xs text-slate-400 mt-1 mb-4">{plan.description}</p>
              <p className="text-3xl font-bold text-white mb-1">
                {formatCurrency(price, plan.currency)}
                <span className="text-sm font-normal text-slate-400">/{interval === 'monthly' ? 'mo' : 'yr'}</span>
              </p>

              <ul className="mt-4 space-y-2 text-sm text-slate-300 mb-6">
                <li>Up to {plan.limits.max_profiles} profiles</li>
                <li>Up to {plan.limits.max_team_members} team members</li>
                <li>{plan.limits.cloud_sync ? 'Cloud sync included' : 'No cloud sync'}</li>
                <li>{plan.limits.api_access ? 'API access' : 'No API access'}</li>
                {plan.limits.priority_support && <li>Priority support</li>}
              </ul>

              {isCurrent ? (
                <button disabled className="w-full py-2 bg-slate-700 text-slate-400 rounded-lg text-sm">
                  Current Plan
                </button>
              ) : (
                <button
                  onClick={async () => {
                    try {
                      if (overview?.subscription_id) {
                        await store.changePlan(plan.id, interval)
                        pushToast('Plan updated successfully', 'success')
                      } else {
                        await store.checkout(plan.id, interval)
                        pushToast('Checkout opened in browser', 'success')
                      }
                    } catch {
                      pushToast('Failed to change plan', 'error')
                    }
                  }}
                  disabled={loading}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm"
                >
                  {overview?.subscription_id ? 'Switch Plan' : 'Get Started'}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function InvoicesTab() {
  const { invoices, invoiceTotal, loading } = useBillingStore()
  const store = useBillingStore()

  useEffect(() => { store.fetchInvoices() }, [])

  const statusColor: Record<string, string> = {
    paid:    'text-green-400',
    open:    'text-blue-400',
    draft:   'text-slate-400',
    void:    'text-red-400',
    uncollectible: 'text-red-400'
  }

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl">
      <div className="p-4 border-b border-slate-700 flex items-center justify-between">
        <h3 className="text-white font-medium">Invoice History ({invoiceTotal})</h3>
        <button
          onClick={() => store.fetchInvoices()}
          className="text-slate-400 hover:text-white"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      {invoices.length === 0 ? (
        <p className="p-6 text-slate-500 text-sm text-center">No invoices yet</p>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="text-xs text-slate-400 border-b border-slate-700">
              <th className="text-left p-3">Number</th>
              <th className="text-left p-3">Date</th>
              <th className="text-left p-3">Status</th>
              <th className="text-right p-3">Amount</th>
              <th className="text-right p-3"></th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                <td className="p-3 text-sm text-slate-300">{inv.number}</td>
                <td className="p-3 text-sm text-slate-400">{new Date(inv.created_at).toLocaleDateString()}</td>
                <td className={`p-3 text-sm ${statusColor[inv.status] ?? 'text-slate-400'}`}>{inv.status}</td>
                <td className="p-3 text-sm text-white text-right">{formatCurrency(inv.amount_due, inv.currency)}</td>
                <td className="p-3 text-right">
                  <button
                    onClick={() => window.api.billing.openInvoice(inv.id)}
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    <ExternalLink className="w-3 h-3 inline" /> View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function UsageTab() {
  const { usageMeters } = useBillingStore()

  return (
    <div className="space-y-4">
      {usageMeters.length === 0 ? (
        <p className="text-slate-500 text-sm">No usage data available</p>
      ) : (
        usageMeters.map((m) => {
          const pct = m.limit ? Math.round((m.current_usage / m.limit) * 100) : 0
          const isWarning = pct > 80
          return (
            <div key={m.meter_id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
              <div className="flex justify-between mb-2">
                <span className="text-sm text-white">{m.name}</span>
                <span className={`text-sm ${isWarning ? 'text-amber-400' : 'text-slate-300'}`}>
                  {m.current_usage} / {m.limit ?? 'unlimited'} {m.unit}
                </span>
              </div>
              {m.limit && (
                <div className="bg-slate-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${isWarning ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
              )}
              {m.reset_at && (
                <p className="text-xs text-slate-500 mt-1">
                  Resets {new Date(m.reset_at).toLocaleDateString()}
                </p>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0
  }).format(amount / 100) // Stripe amounts are in cents
}
