import React, { useEffect, useState } from 'react'
import {
  User, LogOut, Key, Cloud, CloudOff, Upload, Download, Shield,
  RefreshCw, AlertTriangle, Check, Crown, Lock
} from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { useLicenseStore } from '../../stores/licenseStore'
import { useSyncStore } from '../../stores/syncStore'
import type { SyncStatus } from '../../types'

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
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)

  const [licenseKey, setLicenseKey] = useState('')
  const [activatingLicense, setActivatingLicense] = useState(false)
  const [licenseError, setLicenseError] = useState<string | null>(null)

  const [syncPassword, setSyncPassword] = useState('')
  const [syncMessage, setSyncMessage] = useState<string | null>(null)

  useEffect(() => {
    auth.checkAuth()
    license.fetchLicense()
    license.fetchUsage()
  }, [])

  useEffect(() => {
    if (auth.authenticated) {
      sync.fetchStatus()
      sync.fetchManifest()
    }
  }, [auth.authenticated])

  // Listen for sync status updates
  useEffect(() => {
    const cleanup = window.api.sync.onStatus(sync.updateState)
    return cleanup
  }, [])

  const handleLogin = async () => {
    setAuthError(null)
    try {
      await auth.login(email, password)
      setEmail('')
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
      setEmail('')
      setPassword('')
      setName('')
      license.fetchLicense()
    } catch (e: any) {
      setAuthError(e.message)
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

      <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-2xl">
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
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="input w-full"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') authTab === 'login' ? handleLogin() : handleRegister()
                    }}
                  />
                </div>
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
          )}
        </div>

        {/* ── License Section ──────────────────────────────────────── */}
        <div className="card">
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Crown className="w-4 h-4" />
            License & Plan
          </h2>

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
  )
}
