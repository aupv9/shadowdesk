import React, { useEffect, useState } from 'react'
import {
  User, LogOut, Key, Cloud, CloudOff, Upload, Download, Shield,
  RefreshCw, AlertTriangle, Check, Crown, Lock, Eye, EyeOff,
  ArrowRight, Clock, History, ChevronDown, ChevronRight, X
} from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { useLicenseStore } from '../../stores/licenseStore'
import { useSyncStore } from '../../stores/syncStore'
import { useProfileStore } from '../../stores/profileStore'
import type { SyncStatus, LicensePlan, SyncConflict } from '../../types'
import { PLAN_LIMITS } from '../../types'
import { SyncSetupModal, isSyncSetupCompleted } from './SyncSetupModal'

const PRICING_URL = 'https://ghost-browser.app/pricing'

const REMEMBERED_EMAIL_KEY = 'ghostbrowser.account.rememberedEmail'

// C6 — Per-user dismissal flag for the first-run restore prompt. The user
// id is included so each account on a shared machine gets its own
// "remind me" state. Once a user clicks "Not now" we suppress the prompt
// permanently for that account.
const RESTORE_PROMPT_DISMISSED_KEY = (userId: string): string =>
  `ghostbrowser.sync.restorePromptDismissed.${userId}`

function isRestorePromptDismissed(userId: string): boolean {
  try { return localStorage.getItem(RESTORE_PROMPT_DISMISSED_KEY(userId)) === '1' }
  catch { return false }
}

function dismissRestorePrompt(userId: string): void {
  try { localStorage.setItem(RESTORE_PROMPT_DISMISSED_KEY(userId), '1') }
  catch { /* ignore */ }
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`bg-slate-700/60 animate-pulse rounded ${className}`} />
}

function LicenseSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-16" />
      </div>
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-12" />
        </div>
        <Skeleton className="h-2 w-full" />
      </div>
      <div className="space-y-2 pt-2">
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  )
}

function ManifestSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-3 w-3/4" />
      <Skeleton className="h-3 w-2/3" />
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="h-3 w-3/5" />
    </div>
  )
}

// ── B2 — License expiry banner ──────────────────────────────────────────────
//
// Three states:
//   active + ≤7 days     → amber "Renew soon"
//   grace (past expiry)  → red "Expired — grace period ends in N days"
//   expired (post-grace) → red "Expired — fell back to free plan"
function ExpiryBanner({
  status,
  email
}: {
  status: { status: 'active' | 'grace' | 'expired' | 'free'; days_until_expiry: number; in_grace_period: boolean }
  email?: string | null
}) {
  if (status.status === 'free') return null
  if (status.status === 'active' && status.days_until_expiry > 7) return null

  const renewUrl = email
    ? `${PRICING_URL}?email=${encodeURIComponent(email)}&intent=renew`
    : PRICING_URL

  if (status.status === 'active') {
    return (
      <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
        <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-amber-300">
            Your license expires in {status.days_until_expiry} day{status.days_until_expiry === 1 ? '' : 's'}
          </p>
          <p className="text-xs text-amber-400/80 mt-0.5">
            Renew now to avoid interruption to cloud sync and paid limits.
          </p>
        </div>
        <button
          onClick={() => window.open(renewUrl, '_blank', 'noopener,noreferrer')}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors flex items-center gap-1"
        >
          Renew <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    )
  }

  if (status.status === 'grace') {
    const graceLeft = 7 + status.days_until_expiry // days_until_expiry is negative
    return (
      <div className="flex items-start gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
        <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-red-300">
            License expired — {graceLeft} day{graceLeft === 1 ? '' : 's'} left in grace period
          </p>
          <p className="text-xs text-red-400/80 mt-0.5">
            Paid features still work. After the grace period ends you'll fall back to the free plan.
          </p>
        </div>
        <button
          onClick={() => window.open(renewUrl, '_blank', 'noopener,noreferrer')}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors flex items-center gap-1"
        >
          Renew <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    )
  }

  // expired
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
      <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-medium text-red-300">License expired</p>
        <p className="text-xs text-red-400/80 mt-0.5">
          Your paid plan ended and you've been moved back to the free plan limits.
          Reactivate to restore profiles and cloud sync.
        </p>
      </div>
      <button
        onClick={() => window.open(renewUrl, '_blank', 'noopener,noreferrer')}
        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors flex items-center gap-1"
      >
        Reactivate <ArrowRight className="w-3 h-3" />
      </button>
    </div>
  )
}

// ── B1 — Plan comparison grid + upgrade CTAs ───────────────────────────────
const PLAN_DETAILS: Record<LicensePlan, { label: string; price: string; description: string; highlight?: boolean }> = {
  free:         { label: 'Free',         price: '$0',     description: 'Get started — 5 profiles, no cloud sync' },
  starter:      { label: 'Starter',      price: '$9/mo',  description: 'For solo operators — 50 profiles, cloud sync', highlight: true },
  professional: { label: 'Professional', price: '$29/mo', description: 'For small teams — 500 profiles, 15 seats' },
  enterprise:   { label: 'Enterprise',   price: 'Contact', description: 'Unlimited everything + priority support' }
}

function PlanComparison({
  currentPlan,
  email
}: {
  currentPlan: LicensePlan
  email?: string | null
}) {
  const openPricing = (target: LicensePlan): void => {
    const params = new URLSearchParams({ plan: target })
    if (email) params.set('email', email)
    window.open(`${PRICING_URL}?${params.toString()}`, '_blank', 'noopener,noreferrer')
  }

  const plans: LicensePlan[] = ['free', 'starter', 'professional', 'enterprise']
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      {plans.map((plan) => {
        const detail = PLAN_DETAILS[plan]
        const limits = PLAN_LIMITS[plan]
        const isCurrent = plan === currentPlan
        return (
          <div
            key={plan}
            className={`relative rounded-lg p-3 border ${
              isCurrent
                ? 'bg-ghost-600/10 border-ghost-500/40'
                : detail.highlight
                  ? 'bg-slate-800/60 border-slate-700/60 hover:border-slate-600'
                  : 'bg-slate-800/40 border-slate-700/40 hover:border-slate-600'
            } transition-colors`}
          >
            {isCurrent && (
              <div className="absolute -top-2 left-3 px-1.5 py-0.5 rounded-full bg-ghost-600 text-[10px] font-semibold text-white uppercase tracking-wide">
                Current
              </div>
            )}
            <div className="flex items-baseline justify-between mb-1">
              <h3 className="text-sm font-semibold text-white">{detail.label}</h3>
              <span className="text-xs text-slate-400">{detail.price}</span>
            </div>
            <p className="text-xs text-slate-500 mb-3 leading-relaxed">{detail.description}</p>
            <ul className="space-y-1 text-xs text-slate-400 mb-3">
              <li className="flex items-center gap-1.5">
                <Check className="w-3 h-3 text-green-400 shrink-0" />
                {limits.profiles === -1 ? 'Unlimited' : limits.profiles} profiles
              </li>
              <li className="flex items-center gap-1.5">
                <Check className="w-3 h-3 text-green-400 shrink-0" />
                {limits.members === -1 ? 'Unlimited' : limits.members} team seat{limits.members === 1 ? '' : 's'}
              </li>
              <li className="flex items-center gap-1.5">
                {limits.sync ? (
                  <Check className="w-3 h-3 text-green-400 shrink-0" />
                ) : (
                  <Lock className="w-3 h-3 text-slate-600 shrink-0" />
                )}
                Cloud sync
              </li>
            </ul>
            {!isCurrent && (
              <button
                onClick={() => openPricing(plan)}
                className="w-full text-xs font-medium px-2 py-1.5 rounded-lg bg-slate-700/60 text-slate-200 hover:bg-ghost-600/30 hover:text-ghost-300 transition-colors flex items-center justify-center gap-1"
              >
                {plan === 'free' ? 'Downgrade' : 'Upgrade'} <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── C6: First-run restore prompt ─────────────────────────────────────────────
//
// Modal shown when the user signs in on a fresh install (no local profiles)
// but the cloud already holds a backup. Offers to pull-restore in one tap so
// they don't have to find the Cloud Sync card themselves. The encryption
// password is collected here so the call site doesn't need to pre-populate
// `syncPassword` in the Account form.
function RestorePromptModal({
  remoteCount,
  onRestore,
  onDismiss
}: {
  remoteCount: number
  onRestore: (password: string) => Promise<void>
  onDismiss: () => void
}) {
  const [password, setPassword] = useState('')
  const [busy, setBusy]         = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const handleRestore = async (): Promise<void> => {
    if (!password) return
    setBusy(true)
    setError(null)
    try {
      await onRestore(password)
    } catch (e: any) {
      setError(e?.message ?? 'Restore failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Cloud className="w-5 h-5 text-ghost-400" />
            Restore from Cloud
          </h2>
          <button
            onClick={onDismiss}
            className="p-1 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
            aria-label="Dismiss restore prompt"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <p className="text-sm text-slate-300 leading-relaxed">
            We found <strong className="text-white">{remoteCount}</strong> profile{remoteCount === 1 ? '' : 's'} in
            your cloud backup but none on this machine. Restore them now?
          </p>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Encryption password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Same password you used when pushing"
              className="input w-full"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleRestore() }}
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-500/10 text-red-400 text-xs">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-800 flex items-center gap-2">
          <button
            onClick={onDismiss}
            disabled={busy}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            Not now
          </button>
          <button
            onClick={handleRestore}
            disabled={busy || !password}
            className="flex-1 btn-primary flex items-center justify-center gap-2 text-sm disabled:opacity-40"
          >
            {busy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Restore
          </button>
        </div>
      </div>
    </div>
  )
}

// ── C4: Conflict drawer ──────────────────────────────────────────────────────
//
// Side drawer that lists profiles a pull operation skipped because the
// local version was more recently modified. Surfaces the timestamps so the
// user can decide whether to push (override cloud) or accept the cloud copy
// by re-pulling after editing the local profile.
function ConflictDrawer({
  conflicts,
  onClose
}: {
  conflicts: SyncConflict[]
  onClose: () => void
}) {
  const formatDate = (iso: string | null): string =>
    iso ? new Date(iso).toLocaleString() : '—'

  return (
    <div className="fixed inset-0 z-50 flex">
      <div
        className="flex-1 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="w-full max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              Skipped on Pull
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {conflicts.length} profile{conflicts.length === 1 ? '' : 's'} kept local because the cloud copy is older
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
            aria-label="Close conflicts drawer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <ul className="space-y-3">
            {conflicts.map((c) => (
              <li
                key={c.profile_id}
                className="rounded-lg bg-slate-800/60 border border-slate-700/60 p-3"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-sm font-medium text-white truncate">
                    {c.profile_name}
                  </span>
                  <span className="text-[10px] font-mono text-slate-600 shrink-0">
                    {c.profile_id.slice(0, 8)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-slate-500 uppercase tracking-wide text-[10px]">Local</div>
                    <div className="text-green-400">{formatDate(c.local_updated_at)}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 uppercase tracking-wide text-[10px]">Cloud</div>
                    <div className="text-slate-400">{formatDate(c.remote_updated_at)}</div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="px-5 py-4 border-t border-slate-800">
          <p className="text-xs text-slate-500 leading-relaxed">
            To overwrite the cloud copies with your local versions, run
            <strong className="text-slate-300"> Push to Cloud</strong>.
          </p>
        </div>
      </div>
    </div>
  )
}

const PLAN_LABELS: Record<string, { label: string; color: string }> = {
  free:         { label: 'Free',         color: 'text-slate-400' },
  starter:      { label: 'Starter',      color: 'text-blue-400' },
  professional: { label: 'Professional', color: 'text-purple-400' },
  enterprise:   { label: 'Enterprise',   color: 'text-amber-400' }
}

const SYNC_STATUS_LABELS: Record<SyncStatus, { label: string; color: string }> = {
  idle:     { label: 'Up to date',  color: 'text-green-400' },
  syncing:  { label: 'Syncing...',  color: 'text-blue-400' },
  error:    { label: 'Sync error',  color: 'text-red-400' },
  offline:  { label: 'Offline',     color: 'text-slate-500' },
  disabled: { label: 'Disabled',    color: 'text-slate-500' }
}

export function AccountPage() {
  const auth = useAuthStore()
  const license = useLicenseStore()
  const sync = useSyncStore()
  const profileStore = useProfileStore()

  const [authTab, setAuthTab] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState(() => {
    try { return localStorage.getItem(REMEMBERED_EMAIL_KEY) ?? '' } catch { return '' }
  })
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberEmail, setRememberEmail] = useState(() => {
    try { return !!localStorage.getItem(REMEMBERED_EMAIL_KEY) } catch { return false }
  })
  const [authError, setAuthError] = useState<string | null>(null)

  const [licenseKey, setLicenseKey] = useState('')
  const [activatingLicense, setActivatingLicense] = useState(false)
  const [licenseError, setLicenseError] = useState<string | null>(null)

  const [syncPassword, setSyncPassword] = useState('')
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [syncSetupIntent, setSyncSetupIntent] = useState<'push' | 'pull' | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [pullConflicts, setPullConflicts] = useState<SyncConflict[] | null>(null)
  const [showRestorePrompt, setShowRestorePrompt] = useState(false)

  // Change-password form state (only used when authenticated)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changePasswordError, setChangePasswordError] = useState<string | null>(null)
  const [changePasswordSuccess, setChangePasswordSuccess] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)

  useEffect(() => {
    auth.checkAuth()
    license.fetchLicense()
    license.fetchUsage()
    license.fetchStatus()
  }, [])

  useEffect(() => {
    if (auth.authenticated) {
      sync.fetchStatus()
      sync.fetchManifest()
      sync.fetchHistory()
      sync.fetchDaemonEnabled()
      // Make sure profileStore is hydrated so the C6 restore-prompt
      // logic can compare local vs remote counts accurately.
      profileStore.fetchProfiles()
      // Force a fresh license check on sign-in so plan upgrades land
      // immediately instead of waiting for the next app restart.
      license.refreshLicense()
    }
  }, [auth.authenticated])

  // ── C6: First-run restore prompt ──────────────────────────────────────
  // Triggers exactly once per (user, machine) when:
  //   - signed in
  //   - no local profiles
  //   - cloud manifest has at least one profile
  //   - user hasn't dismissed the prompt before
  // The dismissal flag is keyed on user id so multiple accounts on the
  // same machine don't share state.
  useEffect(() => {
    if (!auth.authenticated || !auth.user?.id) return
    if (!sync.manifestLoaded) return
    if (profileStore.loading) return
    if (profileStore.profiles.length > 0) return
    if (!sync.manifest || sync.manifest.profile_ids.length === 0) return
    if (isRestorePromptDismissed(auth.user.id)) return
    setShowRestorePrompt(true)
  }, [
    auth.authenticated,
    auth.user?.id,
    sync.manifestLoaded,
    sync.manifest,
    profileStore.profiles.length,
    profileStore.loading
  ])

  // Auto-refresh license on window focus and every 30 minutes while open.
  // Skips when not authenticated — there's nothing to fetch.
  useEffect(() => {
    if (!auth.authenticated) return

    const refresh = (): void => {
      // Throttle to at most one refresh per minute regardless of trigger.
      const last = useLicenseStore.getState().lastRefreshedAt ?? 0
      if (Date.now() - last < 60_000) return
      license.refreshLicense()
      license.fetchUsage()
    }

    window.addEventListener('focus', refresh)
    const interval = window.setInterval(refresh, 30 * 60 * 1000)
    return () => {
      window.removeEventListener('focus', refresh)
      window.clearInterval(interval)
    }
  }, [auth.authenticated])

  // Listen for sync status updates
  useEffect(() => {
    const cleanup = window.api.sync.onStatus(sync.updateState)
    return cleanup
  }, [])

  const persistRememberedEmail = (value: string): void => {
    try {
      if (rememberEmail && value) {
        localStorage.setItem(REMEMBERED_EMAIL_KEY, value)
      } else {
        localStorage.removeItem(REMEMBERED_EMAIL_KEY)
      }
    } catch { /* localStorage may be disabled */ }
  }

  // A6: Translate common API failure modes into actionable copy. The IPC
  // surfaces backend errors as plain Error objects whose `message` is the
  // server's response text — we sniff for HTTP status codes and rate-limit
  // hints since the IPC layer doesn't expose status separately.
  const friendlyAuthError = (err: any): string => {
    const msg = String(err?.message ?? err ?? 'Login failed')
    if (/429|rate.?limit|too many/i.test(msg)) {
      return 'Too many sign-in attempts. Please wait a minute and try again.'
    }
    if (/401|unauthorized|invalid (credentials|email|password)/i.test(msg)) {
      return 'Invalid email or password.'
    }
    if (/network|fetch|ECONN|timeout/i.test(msg)) {
      return 'Network error — check your connection and try again.'
    }
    return msg
  }

  const handleLogin = async () => {
    setAuthError(null)
    try {
      await auth.login(email, password)
      persistRememberedEmail(email)
      // Keep email visible if remembered, clear it otherwise.
      if (!rememberEmail) setEmail('')
      setPassword('')
      license.fetchLicense()
      license.fetchUsage()
    } catch (e: any) {
      setAuthError(friendlyAuthError(e))
    }
  }

  const handleRegister = async () => {
    setAuthError(null)
    try {
      await auth.register(email, password, name)
      persistRememberedEmail(email)
      if (!rememberEmail) setEmail('')
      setPassword('')
      setName('')
      license.fetchLicense()
    } catch (e: any) {
      setAuthError(friendlyAuthError(e))
    }
  }

  const handleChangePassword = async () => {
    setChangePasswordError(null)
    setChangePasswordSuccess(false)
    if (!currentPassword || !newPassword) {
      setChangePasswordError('Both current and new passwords are required')
      return
    }
    if (newPassword.length < 8) {
      setChangePasswordError('New password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setChangePasswordError('New password and confirmation do not match')
      return
    }
    if (newPassword === currentPassword) {
      setChangePasswordError('New password must differ from the current one')
      return
    }
    setChangingPassword(true)
    try {
      await auth.updatePassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setChangePasswordSuccess(true)
      // Hide the form after a brief success state so the user sees confirmation.
      setTimeout(() => {
        setShowChangePassword(false)
        setChangePasswordSuccess(false)
      }, 1500)
    } catch (e: any) {
      setChangePasswordError(e.message ?? 'Failed to update password')
    } finally {
      setChangingPassword(false)
    }
  }

  const handleActivateLicense = async () => {
    if (!licenseKey.trim()) return
    setActivatingLicense(true)
    setLicenseError(null)
    try {
      await license.activateLicense(licenseKey.trim())
      setLicenseKey('')
    } catch (e: any) {
      setLicenseError(e.message)
    } finally {
      setActivatingLicense(false)
    }
  }

  // C2: Trigger the first-time wizard if the user hasn't acknowledged the
  // zero-knowledge warning yet. Otherwise run the sync directly.
  const requestSync = (intent: 'push' | 'pull'): void => {
    if (!isSyncSetupCompleted()) {
      setSyncSetupIntent(intent)
      return
    }
    if (!syncPassword) {
      setSyncMessage('Enter your encryption password first.')
      return
    }
    if (intent === 'push') void runPush(syncPassword)
    else                    void runPull(syncPassword)
  }

  const runPush = async (password: string) => {
    setSyncMessage(null)
    try {
      await sync.push(password)
      await sync.fetchManifest()
      setSyncMessage('Profiles pushed to cloud successfully')
    } catch (e: any) {
      setSyncMessage(e.message)
    }
  }

  const runPull = async (password: string) => {
    setSyncMessage(null)
    try {
      const result = await sync.pull(password)
      await sync.fetchManifest()
      const summary = `Pulled ${result.imported} profile${result.imported === 1 ? '' : 's'} from cloud`
      if (result.conflicts.length > 0) {
        setSyncMessage(`${summary} · ${result.conflicts.length} skipped (local newer)`)
        setPullConflicts(result.conflicts)
      } else {
        setSyncMessage(summary)
      }
    } catch (e: any) {
      setSyncMessage(e.message)
    }
  }

  const handleSyncPush = () => requestSync('push')
  const handleSyncPull = () => requestSync('pull')

  // Background sync daemon toggle. Enabling requires the encryption
  // password (held in main-process memory only — never persisted).
  const handleToggleDaemon = async (): Promise<void> => {
    setSyncMessage(null)
    if (sync.daemonEnabled) {
      try {
        await sync.disableDaemon()
        setSyncMessage('Background sync disabled')
      } catch (e: any) {
        setSyncMessage(e?.message ?? 'Failed to disable background sync')
      }
      return
    }
    if (!syncPassword) {
      setSyncMessage('Enter your encryption password before enabling background sync.')
      return
    }
    try {
      await sync.enableDaemon(syncPassword)
      setSyncMessage('Background sync enabled — will push pending changes every 5 minutes')
    } catch (e: any) {
      setSyncMessage(e?.message ?? 'Failed to enable background sync')
    }
  }

  const plan = license.license?.plan ?? 'free'
  const planInfo = PLAN_LABELS[plan] ?? PLAN_LABELS.free
  const maxProfiles = license.license?.max_profiles ?? 5
  const usedProfiles = license.usage.profiles
  const usagePercent = maxProfiles === -1 ? 0 : Math.min(100, Math.round((usedProfiles / maxProfiles) * 100))
  const syncEnabled = license.license?.cloud_sync_enabled ?? false
  const syncStatusInfo = SYNC_STATUS_LABELS[sync.state.status] ?? SYNC_STATUS_LABELS.idle

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-slate-800">
        <h1 className="text-lg font-semibold text-white">Account</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 w-full max-w-5xl mx-auto">
        {/* ── B2: License expiry banner (rendered above all cards) ── */}
        {auth.authenticated && license.status && (
          <ExpiryBanner status={license.status} email={auth.user?.email} />
        )}

        {/* ── Auth Section ─────────────────────────────────────────── */}
        <div className="card">
          {!auth.authenticated ? (
            <>
              {/* F3: ARIA-tab list with left/right arrow navigation */}
              <div
                role="tablist"
                aria-label="Authentication mode"
                className="flex gap-2 mb-4"
                onKeyDown={(e) => {
                  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                    e.preventDefault()
                    setAuthTab(authTab === 'login' ? 'register' : 'login')
                  }
                }}
              >
                <button
                  role="tab"
                  aria-selected={authTab === 'login'}
                  tabIndex={authTab === 'login' ? 0 : -1}
                  onClick={() => setAuthTab('login')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    authTab === 'login'
                      ? 'bg-ghost-600/20 text-ghost-400'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Sign In
                </button>
                <button
                  role="tab"
                  aria-selected={authTab === 'register'}
                  tabIndex={authTab === 'register' ? 0 : -1}
                  onClick={() => setAuthTab('register')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    authTab === 'register'
                      ? 'bg-ghost-600/20 text-ghost-400'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Create Account
                </button>
              </div>

              {authError && (
                <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-red-500/10 text-red-400 text-sm">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {authError}
                </div>
              )}

              <div className="space-y-3">
                {authTab === 'register' && (
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      className="input w-full"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="input w-full"
                    autoComplete="email"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm text-slate-400">Password</label>
                    {authTab === 'login' && (
                      <a
                        href="https://ghost-browser.app/forgot-password"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-ghost-400 hover:text-ghost-300 transition-colors"
                      >
                        Forgot password?
                      </a>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="input w-full pr-10"
                      autoComplete={authTab === 'login' ? 'current-password' : 'new-password'}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') authTab === 'login' ? handleLogin() : handleRegister()
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-slate-300 transition-colors"
                      title={showPassword ? 'Hide password' : 'Show password'}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                {authTab === 'login' && (
                  <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberEmail}
                      onChange={(e) => {
                        const checked = e.target.checked
                        setRememberEmail(checked)
                        // If unchecking, drop the stored value immediately so the
                        // next visit starts blank — don't wait until next login.
                        if (!checked) {
                          try { localStorage.removeItem(REMEMBERED_EMAIL_KEY) } catch { /* ignore */ }
                        }
                      }}
                      className="accent-ghost-600"
                    />
                    Remember my email on this device
                  </label>
                )}
                <button
                  onClick={authTab === 'login' ? handleLogin : handleRegister}
                  disabled={auth.loading}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  {auth.loading && <RefreshCw className="w-4 h-4 animate-spin" />}
                  {authTab === 'login' ? 'Sign In' : 'Create Account'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-ghost-600/20 flex items-center justify-center">
                    <User className="w-5 h-5 text-ghost-400" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">{auth.user?.name}</div>
                    <div className="text-xs text-slate-400">{auth.user?.email}</div>
                  </div>
                </div>
                <button
                  onClick={() => auth.logout()}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>

              {/* ── Change Password ─────────────────────────────────── */}
              <div className="mt-4 pt-4 border-t border-slate-700/60">
                {!showChangePassword ? (
                  <button
                    onClick={() => {
                      setShowChangePassword(true)
                      setChangePasswordError(null)
                      setChangePasswordSuccess(false)
                    }}
                    className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    <Key className="w-3.5 h-3.5" />
                    Change password
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-white flex items-center gap-2">
                        <Key className="w-4 h-4" />
                        Change Password
                      </h3>
                      <button
                        onClick={() => {
                          setShowChangePassword(false)
                          setCurrentPassword('')
                          setNewPassword('')
                          setConfirmPassword('')
                          setChangePasswordError(null)
                          setChangePasswordSuccess(false)
                        }}
                        className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>

                    {changePasswordError && (
                      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-500/10 text-red-400 text-xs">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        {changePasswordError}
                      </div>
                    )}
                    {changePasswordSuccess && (
                      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-green-500/10 text-green-400 text-xs">
                        <Check className="w-3.5 h-3.5 shrink-0" />
                        Password updated successfully
                      </div>
                    )}

                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Current password</label>
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="input w-full"
                        autoComplete="current-password"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">New password</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="input w-full"
                        autoComplete="new-password"
                        placeholder="At least 8 characters"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Confirm new password</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="input w-full"
                        autoComplete="new-password"
                        onKeyDown={(e) => { if (e.key === 'Enter') handleChangePassword() }}
                      />
                    </div>
                    <button
                      onClick={handleChangePassword}
                      disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
                      className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
                    >
                      {changingPassword && <RefreshCw className="w-4 h-4 animate-spin" />}
                      Update Password
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── License + Sync grid (side-by-side on xl screens) ───── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* ── License Section ──────────────────────────────────────── */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Crown className="w-4 h-4" />
              License & Plan
            </h2>
            {auth.authenticated && (
              <button
                onClick={() => { license.refreshLicense(); license.fetchUsage() }}
                disabled={license.refreshing}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-50"
                title="Refresh license from server"
              >
                <RefreshCw className={`w-3 h-3 ${license.refreshing ? 'animate-spin' : ''}`} />
                {license.refreshing ? 'Refreshing…' : 'Refresh'}
              </button>
            )}
          </div>

          {license.loading && !license.license ? (
            <LicenseSkeleton />
          ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Current Plan</span>
              <span className={`text-sm font-medium ${planInfo.color}`}>{planInfo.label}</span>
            </div>

            <div>
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="text-slate-400">Profiles</span>
                <span className="text-slate-300">
                  {usedProfiles} / {maxProfiles === -1 ? 'Unlimited' : maxProfiles}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-700 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    usagePercent > 90 ? 'bg-red-500' : usagePercent > 70 ? 'bg-amber-500' : 'bg-ghost-600'
                  }`}
                  style={{ width: `${maxProfiles === -1 ? 0 : usagePercent}%` }}
                />
              </div>
            </div>

            {plan !== 'free' && license.license && (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Valid Until</span>
                  <span className="text-slate-300">
                    {new Date(license.license.valid_until).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Cloud Sync</span>
                  <span className={syncEnabled ? 'text-green-400' : 'text-slate-500'}>
                    {syncEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-slate-700">
              <label className="block text-sm text-slate-400 mb-1.5">Activate License Key</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={licenseKey}
                  onChange={(e) => setLicenseKey(e.target.value)}
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  className="input flex-1 font-mono"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleActivateLicense() }}
                />
                <button
                  onClick={handleActivateLicense}
                  disabled={activatingLicense || !licenseKey.trim()}
                  className="btn-primary flex items-center gap-2 text-sm"
                >
                  {activatingLicense ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                  Activate
                </button>
              </div>
              {licenseError && (
                <p className="text-xs text-red-400 mt-1">{licenseError}</p>
              )}
            </div>

            {plan !== 'free' && (
              <button
                onClick={() => license.deactivateLicense()}
                className="text-xs text-slate-500 hover:text-red-400 transition-colors"
              >
                Deactivate license from this machine
              </button>
            )}
          </div>
          )}
        </div>

        {/* ── Cloud Sync Section ───────────────────────────────────── */}
        <div className="card">
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            {syncEnabled ? <Cloud className="w-4 h-4" /> : <CloudOff className="w-4 h-4" />}
            Cloud Sync
          </h2>

          {!syncEnabled ? (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-800">
              <Lock className="w-5 h-5 text-slate-500 shrink-0" />
              <div>
                <p className="text-sm text-slate-300">Upgrade to enable Cloud Sync</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  E2E encrypted profile backup — available on Starter plan and above
                </p>
              </div>
            </div>
          ) : !auth.authenticated ? (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-800">
              <Shield className="w-5 h-5 text-slate-500 shrink-0" />
              <p className="text-sm text-slate-400">Sign in to use Cloud Sync</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Status</span>
                <span className={`text-sm font-medium ${syncStatusInfo.color}`}>
                  {syncStatusInfo.label}
                </span>
              </div>

              {sync.state.last_synced_at && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Last synced</span>
                  <span className="text-slate-300">
                    {new Date(sync.state.last_synced_at).toLocaleString()}
                  </span>
                </div>
              )}

              {sync.state.pending_changes > 0 && (
                <div className="flex items-center gap-2 text-sm text-amber-400">
                  <AlertTriangle className="w-4 h-4" />
                  {sync.state.pending_changes} pending changes
                </div>
              )}

              {/* ── Remote manifest snapshot ────────────────────────── */}
              <div className="rounded-lg bg-slate-800/60 border border-slate-700/60 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
                    <Cloud className="w-3.5 h-3.5" />
                    Remote Backup
                  </div>
                  <button
                    onClick={() => sync.fetchManifest()}
                    className="text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1"
                    title="Refresh manifest"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Refresh
                  </button>
                </div>
                {sync.manifestLoading && !sync.manifestLoaded ? (
                  <ManifestSkeleton />
                ) : sync.manifest ? (
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Profiles in cloud</span>
                      <span className="text-slate-200 font-medium">
                        {sync.manifest.profile_ids.length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Last modified</span>
                      <span className="text-slate-300">
                        {new Date(sync.manifest.last_modified).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Manifest version</span>
                      <span className="text-slate-300">v{sync.manifest.version}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Integrity</span>
                      <span
                        className="text-slate-400 font-mono text-xs"
                        title={sync.manifest.checksum}
                      >
                        {sync.manifest.checksum.slice(0, 12)}…
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    No backup found in the cloud yet — push to create one.
                  </p>
                )}
              </div>

              {/* ── C3: Sync history (collapsible) ────────────────── */}
              <div className="rounded-lg bg-slate-800/60 border border-slate-700/60">
                <button
                  type="button"
                  onClick={() => {
                    const next = !historyOpen
                    setHistoryOpen(next)
                    if (next) sync.fetchHistory()
                  }}
                  className="w-full flex items-center justify-between p-3 text-left"
                  aria-expanded={historyOpen}
                >
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
                    <History className="w-3.5 h-3.5" />
                    Sync History
                    {sync.history.length > 0 && (
                      <span className="text-slate-600 normal-case tracking-normal">
                        ({sync.history.length})
                      </span>
                    )}
                  </div>
                  {historyOpen
                    ? <ChevronDown className="w-4 h-4 text-slate-500" />
                    : <ChevronRight className="w-4 h-4 text-slate-500" />}
                </button>
                {historyOpen && (
                  <div className="px-3 pb-3 border-t border-slate-700/60">
                    {sync.historyLoading && !sync.historyLoaded ? (
                      <div className="py-3 text-xs text-slate-500 flex items-center gap-2">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        Loading history…
                      </div>
                    ) : sync.history.length === 0 ? (
                      <p className="py-3 text-xs text-slate-500">
                        No sync activity yet — push or pull to populate this log.
                      </p>
                    ) : (
                      <ul className="divide-y divide-slate-700/60 max-h-64 overflow-y-auto">
                        {sync.history.map((entry) => {
                          const isPush = entry.direction === 'push'
                          const isError = entry.status === 'error'
                          return (
                            <li key={entry.id} className="py-2 flex items-start gap-2.5 text-xs">
                              <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                                isError
                                  ? 'bg-red-500/10 text-red-400'
                                  : isPush
                                    ? 'bg-blue-500/10 text-blue-400'
                                    : 'bg-green-500/10 text-green-400'
                              }`}>
                                {isError
                                  ? <X className="w-3 h-3" />
                                  : isPush
                                    ? <Upload className="w-3 h-3" />
                                    : <Download className="w-3 h-3" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-slate-200 font-medium capitalize">
                                    {entry.direction}
                                    <span className="text-slate-500 font-normal ml-1.5">
                                      · {entry.profile_count} profile{entry.profile_count === 1 ? '' : 's'}
                                    </span>
                                  </span>
                                  <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide ${
                                    isError
                                      ? 'bg-red-500/15 text-red-300'
                                      : 'bg-green-500/15 text-green-300'
                                  }`}>
                                    {entry.status}
                                  </span>
                                </div>
                                <div className="text-slate-500 mt-0.5">
                                  {new Date(entry.synced_at).toLocaleString()}
                                </div>
                                {isError && entry.error_message && (
                                  <div className="text-red-400/80 mt-1 leading-snug break-words">
                                    {entry.error_message}
                                  </div>
                                )}
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Encryption Password</label>
                <input
                  type="password"
                  value={syncPassword}
                  onChange={(e) => setSyncPassword(e.target.value)}
                  placeholder="Enter your sync encryption password"
                  className="input w-full"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Your profiles are encrypted before upload — we never see your data
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleSyncPush}
                  disabled={sync.loading || !syncPassword}
                  className="btn-primary flex-1 flex items-center justify-center gap-2 text-sm"
                >
                  {sync.loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  Push to Cloud
                </button>
                <button
                  onClick={handleSyncPull}
                  disabled={sync.loading || !syncPassword}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors disabled:opacity-50"
                >
                  {sync.loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Pull from Cloud
                </button>
              </div>

              {/* ── Background sync daemon toggle ─────────────────── */}
              <div className="flex items-start justify-between gap-3 p-3 rounded-lg bg-slate-800/60 border border-slate-700/60">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <RefreshCw className={`w-4 h-4 ${sync.daemonEnabled ? 'text-ghost-400' : 'text-slate-500'}`} />
                    <span className="text-sm font-medium text-white">Background Sync</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {sync.daemonEnabled
                      ? 'Pending changes auto-push every 5 minutes. Password is kept in memory until you disable or quit.'
                      : 'Auto-push pending changes in the background. Your encryption password stays in memory only — never written to disk.'}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={sync.daemonEnabled}
                  onClick={handleToggleDaemon}
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                    sync.daemonEnabled ? 'bg-ghost-600' : 'bg-slate-700'
                  }`}
                  title={sync.daemonEnabled ? 'Disable background sync' : 'Enable background sync'}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      sync.daemonEnabled ? 'translate-x-4' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              {syncMessage && (
                <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
                  syncMessage.includes('error') || syncMessage.includes('fail')
                    ? 'bg-red-500/10 text-red-400'
                    : 'bg-green-500/10 text-green-400'
                }`}>
                  <Check className="w-4 h-4 shrink-0" />
                  {syncMessage}
                </div>
              )}
            </div>
          )}
        </div>
        </div>

        {/* C2: First-time sync setup wizard */}
        {syncSetupIntent && (
          <SyncSetupModal
            intent={syncSetupIntent}
            onClose={() => setSyncSetupIntent(null)}
            onConfirm={(password) => {
              setSyncPassword(password)
              const intent = syncSetupIntent
              setSyncSetupIntent(null)
              if (intent === 'push') void runPush(password)
              else                    void runPull(password)
            }}
          />
        )}

        {/* C4: Conflict drawer (open when pull skipped local-newer profiles) */}
        {pullConflicts && pullConflicts.length > 0 && (
          <ConflictDrawer
            conflicts={pullConflicts}
            onClose={() => setPullConflicts(null)}
          />
        )}

        {/* C6: First-run restore-from-cloud prompt */}
        {showRestorePrompt && sync.manifest && (
          <RestorePromptModal
            remoteCount={sync.manifest.profile_ids.length}
            onRestore={async (password) => {
              setSyncPassword(password)
              await runPull(password)
              await profileStore.fetchProfiles()
              setShowRestorePrompt(false)
              if (auth.user?.id) dismissRestorePrompt(auth.user.id)
            }}
            onDismiss={() => {
              setShowRestorePrompt(false)
              if (auth.user?.id) dismissRestorePrompt(auth.user.id)
            }}
          />
        )}

        {/* ── B1: Plan comparison grid (only when authenticated) ───── */}
        {auth.authenticated && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Crown className="w-4 h-4" />
                Compare Plans
              </h2>
              <a
                href={PRICING_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1"
              >
                Full pricing <ArrowRight className="w-3 h-3" />
              </a>
            </div>
            <PlanComparison currentPlan={plan} email={auth.user?.email} />
          </div>
        )}
      </div>
    </div>
  )
}
