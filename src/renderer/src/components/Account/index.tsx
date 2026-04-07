import React, { useEffect, useState } from 'react'
import {
  User, LogOut, Key, Cloud, CloudOff, Upload, Download, Shield,
  RefreshCw, AlertTriangle, Check, Crown, Lock, Eye, EyeOff
} from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { useLicenseStore } from '../../stores/licenseStore'
import { useSyncStore } from '../../stores/syncStore'
import type { SyncStatus } from '../../types'

const REMEMBERED_EMAIL_KEY = 'ghostbrowser.account.rememberedEmail'

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
  }, [])

  useEffect(() => {
    if (auth.authenticated) {
      sync.fetchStatus()
      sync.fetchManifest()
      // Force a fresh license check on sign-in so plan upgrades land
      // immediately instead of waiting for the next app restart.
      license.refreshLicense()
    }
  }, [auth.authenticated])

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
      setAuthError(e.message)
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
      setAuthError(e.message)
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

  const handleSyncPush = async () => {
    if (!syncPassword) return
    setSyncMessage(null)
    try {
      await sync.push(syncPassword)
      await sync.fetchManifest()
      setSyncMessage('Profiles pushed to cloud successfully')
    } catch (e: any) {
      setSyncMessage(e.message)
    }
  }

  const handleSyncPull = async () => {
    if (!syncPassword) return
    setSyncMessage(null)
    try {
      const count = await sync.pull(syncPassword)
      await sync.fetchManifest()
      setSyncMessage(`Pulled ${count} profiles from cloud`)
    } catch (e: any) {
      setSyncMessage(e.message)
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
        {/* ── Auth Section ─────────────────────────────────────────── */}
        <div className="card">
          {!auth.authenticated ? (
            <>
              <div className="flex gap-2 mb-4">
                <button
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
      </div>
    </div>
  )
}
