import React, { useEffect, useState } from 'react'
import { Save, RefreshCw, Info, Keyboard, Server, Play, Square, Copy, CheckCircle, Cpu, AlertTriangle, ShieldCheck, Lock, Unlock, Plus, Trash2, KeyRound, Radar } from 'lucide-react'
import type { ApiServerStatus, ApiServerConfig } from '../../types'
import { RemoteNodesPanel } from './RemoteNodesPanel'
import { CommunityPresetsPanel } from './CommunityPresetsPanel'
import { WebhooksPanel } from './WebhooksPanel'
import { ACTION_META } from '../AutomationBuilder/actionMetadata'
import { COMMUNITY_PRESETS_ENABLED, DESKTOP_ONLY } from '../../../../shared/features'

type CaptchaProviderId = '2captcha' | 'anticaptcha' | 'capmonster'

interface CaptchaConfig {
  defaultProvider: CaptchaProviderId
  apiKeys: Record<CaptchaProviderId, string>
}

interface CanarySettings {
  enabled: boolean
  url: string
  sentinel: string
}

interface Settings {
  defaultPreset: string
  language: string
  theme: string
  autoLaunchLastSession: boolean
  autoSyncBinaryUA: boolean
  captcha: CaptchaConfig
  canary: CanarySettings
}

const CAPTCHA_PROVIDERS: { id: CaptchaProviderId; displayName: string }[] = [
  { id: '2captcha',    displayName: '2Captcha' },
  { id: 'anticaptcha', displayName: 'Anti-Captcha' },
  { id: 'capmonster',  displayName: 'CapMonster' }
]

interface ChromiumBinaryInfo {
  path?: string
  fullVersion?: string
  major?: number
  error?: string
}

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'vi', label: 'Tiếng Việt' },
  { value: 'th', label: 'ไทย' },
  { value: 'id', label: 'Bahasa Indonesia' }
]

const PRESETS = [
  { value: 'win10-chrome120', label: 'Windows 10 — Chrome 120' },
  { value: 'win11-chrome121', label: 'Windows 11 — Chrome 121' },
  { value: 'mac-ventura-chrome120', label: 'macOS Ventura — Chrome 120' },
  { value: 'mac-sonoma-chrome121', label: 'macOS Sonoma — Chrome 121' },
  { value: 'linux-ubuntu-chrome120', label: 'Ubuntu 22.04 — Chrome 120' },
  { value: 'android-samsung-chrome120', label: 'Android Samsung — Chrome 120' },
  { value: 'android-pixel-chrome121', label: 'Android Pixel — Chrome 121' },
  { value: 'android-oppo-chrome120', label: 'Android OPPO — Chrome 120' }
]

const SHORTCUTS = [
  { keys: 'Ctrl + N', action: 'New Profile' },
  { keys: 'Ctrl + F', action: 'Focus Search' },
  { keys: 'Ctrl + R', action: 'Refresh Profiles' },
  { keys: 'Enter', action: 'Launch First Profile' }
]

export function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // API Server state
  const [apiStatus, setApiStatus] = useState<ApiServerStatus | null>(null)
  const [apiPort, setApiPort] = useState(9222)
  const [apiToken, setApiToken] = useState('')
  const [apiLoading, setApiLoading] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)

  // Phase 12.A.1 — Chromium binary info
  const [binary, setBinary] = useState<ChromiumBinaryInfo | null>(null)
  const [binaryLoading, setBinaryLoading] = useState(false)

  // Phase 12.B.1 — Captcha balance state per provider
  const [captchaBalances, setCaptchaBalances] = useState<Record<string, { balance?: number; error?: string; loading?: boolean }>>({})

  // Phase 12.C.3 — Encrypted credential vault
  const [vaultStatus, setVaultStatus] = useState<{ initialized: boolean; unlocked: boolean }>({ initialized: false, unlocked: false })
  const [vaultPassword, setVaultPassword] = useState('')
  const [vaultError, setVaultError] = useState<string | null>(null)
  const [vaultLoading, setVaultLoading] = useState(false)
  const [vaultCreds, setVaultCreds] = useState<Array<{ id: string; profile_id: string | null; label: string; username: string; password: string; fields: Record<string, string> }>>([])
  const [showAddCred, setShowAddCred] = useState(false)
  const [newCred, setNewCred] = useState<{ label: string; username: string; password: string }>({ label: '', username: '', password: '' })
  const [presetCount, setPresetCount] = useState<number | null>(null)

  useEffect(() => {
    window.api.settings.get().then(setSettings)
    window.api.fingerprint.presets()
      .then((p: Record<string, unknown>) => setPresetCount(Object.keys(p).length))
      .catch(() => {})
    window.api.apiServer.status().then(setApiStatus)
    window.api.apiServer.config().then((cfg) => {
      setApiPort(cfg.port)
      setApiToken(cfg.authToken ?? '')
    })
    // Detect Chromium binary version (cached after first call)
    setBinaryLoading(true)
    window.api.system.chromiumVersion()
      .then((info: ChromiumBinaryInfo) => setBinary(info))
      .catch((err: Error) => setBinary({ error: err.message }))
      .finally(() => setBinaryLoading(false))
    // Vault status
    window.api.vault.status().then((s) => {
      setVaultStatus(s)
      if (s.unlocked) {
        window.api.vault.list().then(setVaultCreds).catch(() => {})
      }
    }).catch(() => {})
  }, [])

  const refreshVault = async () => {
    const s = await window.api.vault.status()
    setVaultStatus(s)
    if (s.unlocked) {
      try {
        const list = await window.api.vault.list()
        setVaultCreds(list)
      } catch {
        setVaultCreds([])
      }
    } else {
      setVaultCreds([])
    }
  }

  const handleVaultUnlock = async () => {
    if (!vaultPassword) {
      setVaultError('Password required')
      return
    }
    setVaultLoading(true)
    setVaultError(null)
    try {
      const result = await window.api.vault.unlock(vaultPassword)
      if (!result.ok) {
        setVaultError('Invalid master password')
        return
      }
      setVaultPassword('')
      await refreshVault()
    } catch (err: any) {
      setVaultError(err?.message ?? 'Failed to unlock vault')
    } finally {
      setVaultLoading(false)
    }
  }

  const handleVaultLock = async () => {
    await window.api.vault.lock()
    await refreshVault()
  }

  const handleAddCred = async () => {
    if (!newCred.label || !newCred.username) {
      setVaultError('Label and username are required')
      return
    }
    setVaultLoading(true)
    setVaultError(null)
    try {
      await window.api.vault.create({
        profile_id: null,
        label: newCred.label,
        username: newCred.username,
        password: newCred.password,
        fields: {}
      })
      setNewCred({ label: '', username: '', password: '' })
      setShowAddCred(false)
      await refreshVault()
    } catch (err: any) {
      setVaultError(err?.message ?? 'Failed to add credential')
    } finally {
      setVaultLoading(false)
    }
  }

  const handleDeleteCred = async (id: string) => {
    if (!confirm('Delete this credential? This cannot be undone.')) return
    try {
      await window.api.vault.delete(id)
      await refreshVault()
    } catch (err: any) {
      setVaultError(err?.message ?? 'Failed to delete credential')
    }
  }

  const handleChange = (key: keyof Settings, value: string | boolean) => {
    if (!settings) return
    setSettings({ ...settings, [key]: value })
    setSaved(false)
  }

  const handleCaptchaProviderChange = (provider: CaptchaProviderId) => {
    if (!settings) return
    setSettings({ ...settings, captcha: { ...settings.captcha, defaultProvider: provider } })
    setSaved(false)
  }

  const handleCaptchaKeyChange = (provider: CaptchaProviderId, key: string) => {
    if (!settings) return
    setSettings({
      ...settings,
      captcha: { ...settings.captcha, apiKeys: { ...settings.captcha.apiKeys, [provider]: key } }
    })
    setSaved(false)
  }

  const handleCheckBalance = async (provider: CaptchaProviderId) => {
    if (!settings) return
    const key = settings.captcha.apiKeys[provider]
    if (!key) {
      setCaptchaBalances((prev) => ({ ...prev, [provider]: { error: 'No API key configured' } }))
      return
    }
    setCaptchaBalances((prev) => ({ ...prev, [provider]: { loading: true } }))
    try {
      const result = await window.api.captcha.checkBalance(provider, key)
      setCaptchaBalances((prev) => ({
        ...prev,
        [provider]: { balance: result.balance, error: result.error }
      }))
    } catch (err: any) {
      setCaptchaBalances((prev) => ({
        ...prev,
        [provider]: { error: err.message ?? 'Balance check failed' }
      }))
    }
  }

  const handleSave = async () => {
    if (!settings) return
    setSaving(true)
    try {
      const updated = await window.api.settings.update(settings)
      setSettings(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      // Apply theme immediately
      const theme = updated.theme ?? 'dark'
      if (theme === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light')
      } else {
        document.documentElement.setAttribute('data-theme', theme)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleStartApi = async () => {
    setApiLoading(true)
    try {
      const status = await window.api.apiServer.start({
        port: apiPort,
        authToken: apiToken || undefined
      })
      setApiStatus(status)
    } catch (err: any) {
      console.error('Failed to start API server:', err)
    } finally {
      setApiLoading(false)
    }
  }

  const handleStopApi = async () => {
    setApiLoading(true)
    try {
      const status = await window.api.apiServer.stop()
      setApiStatus(status)
    } catch (err: any) {
      console.error('Failed to stop API server:', err)
    } finally {
      setApiLoading(false)
    }
  }

  const handleCopyUrl = () => {
    if (apiStatus?.url) {
      navigator.clipboard.writeText(apiStatus.url)
      setCopiedUrl(true)
      setTimeout(() => setCopiedUrl(false), 1500)
    }
  }

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500 text-sm">
        Loading settings...
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-white">Settings</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary flex items-center gap-2 text-sm"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saved ? 'Saved!' : 'Save'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-2xl">
        {/* General */}
        <div className="card">
          <h2 className="text-sm font-semibold text-white mb-4">General</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Default Fingerprint Preset</label>
              <select
                value={settings.defaultPreset}
                onChange={(e) => handleChange('defaultPreset', e.target.value)}
                className="input w-full"
              >
                {PRESETS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">Used when creating new profiles</p>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Language</label>
              <select
                value={settings.language}
                onChange={(e) => handleChange('language', e.target.value)}
                className="input w-full"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1.5">Theme</label>
              <select
                value={settings.theme}
                onChange={(e) => handleChange('theme', e.target.value)}
                className="input w-full"
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
                <option value="system">System</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm text-slate-300">Auto-launch last session</label>
                <p className="text-xs text-slate-500">Reopen last active profiles on startup</p>
              </div>
              <button
                onClick={() => handleChange('autoLaunchLastSession', !settings.autoLaunchLastSession)}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  settings.autoLaunchLastSession ? 'bg-ghost-600' : 'bg-slate-600'
                }`}
              >
                <div
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    settings.autoLaunchLastSession ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Phase 12.A.1 — Chromium binary */}
        <div className="card">
          <h2 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
            <Cpu className="w-4 h-4" />
            Chromium Binary
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            The actual Chromium binary used to launch profiles. Its version determines the TLS/JA3 fingerprint
            seen by remote servers, regardless of the spoofed user agent.
          </p>

          <div className="space-y-3">
            {binaryLoading && (
              <div className="text-xs text-slate-500 flex items-center gap-2">
                <RefreshCw className="w-3 h-3 animate-spin" /> Detecting binary version...
              </div>
            )}

            {binary?.error && (
              <div className="text-xs text-red-400 flex items-start gap-2 p-2 bg-red-600/10 border border-red-600/30 rounded">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>{binary.error}</span>
              </div>
            )}

            {binary?.fullVersion && (
              <>
                <div className="text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Detected version</span>
                    <span className="text-slate-300 font-mono">{binary.fullVersion}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Major</span>
                    <span className="text-slate-300 font-mono">{binary.major}</span>
                  </div>
                  {binary.path && (
                    <div className="flex justify-between gap-3">
                      <span className="text-slate-500 flex-shrink-0">Path</span>
                      <span className="text-slate-400 font-mono text-[10px] truncate" title={binary.path}>
                        {binary.path}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-start justify-between gap-3 pt-2 border-t border-slate-700">
                  <div className="flex-1">
                    <label className="text-sm text-slate-300">Auto-sync profile UA to binary</label>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Rewrite the spoofed Chrome major version on launch so it matches the real binary.
                      Strictly improves TLS/JA3 alignment. Disable to pin a specific Chrome version per profile.
                    </p>
                  </div>
                  <button
                    onClick={() => handleChange('autoSyncBinaryUA', !settings.autoSyncBinaryUA)}
                    className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 mt-1 ${
                      settings.autoSyncBinaryUA ? 'bg-ghost-600' : 'bg-slate-600'
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                        settings.autoSyncBinaryUA ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Phase 12.B.1 — Captcha Solvers */}
        <div className="card">
          <h2 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" />
            Captcha Solvers
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Configure third-party captcha solving providers. Workflows can call <code className="text-slate-400">solveCaptcha</code> actions
            which dispatch to the default provider unless overridden per step.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Default provider</label>
              <select
                value={settings.captcha?.defaultProvider ?? '2captcha'}
                onChange={(e) => handleCaptchaProviderChange(e.target.value as CaptchaProviderId)}
                className="input w-full"
              >
                {CAPTCHA_PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>{p.displayName}</option>
                ))}
              </select>
            </div>

            <div className="space-y-3 pt-2 border-t border-slate-700">
              {CAPTCHA_PROVIDERS.map((p) => {
                const balance = captchaBalances[p.id]
                return (
                  <div key={p.id}>
                    <label className="block text-xs text-slate-500 mb-1">{p.displayName} API key</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="password"
                        value={settings.captcha?.apiKeys?.[p.id] ?? ''}
                        onChange={(e) => handleCaptchaKeyChange(p.id, e.target.value)}
                        placeholder={`Paste your ${p.displayName} API key…`}
                        className="input flex-1"
                      />
                      <button
                        onClick={() => handleCheckBalance(p.id)}
                        disabled={balance?.loading}
                        className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-200 rounded transition-colors flex items-center gap-1"
                      >
                        {balance?.loading ? <RefreshCw className="w-3 h-3 animate-spin" /> : null}
                        Check balance
                      </button>
                    </div>
                    {balance && !balance.loading && (
                      <p className={`text-xs mt-1 ${balance.error ? 'text-red-400' : 'text-emerald-400'}`}>
                        {balance.error
                          ? `Error: ${balance.error}`
                          : `Balance: $${(balance.balance ?? 0).toFixed(3)}`}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Automation API Server */}
        <div className="card">
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Server className="w-4 h-4" />
            Automation API Server
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Local REST API for external tools, scripts, and third-party integrations to control profiles and run workflows.
          </p>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="block text-xs text-slate-500 mb-1">Port</label>
                <input
                  type="number"
                  value={apiPort}
                  onChange={(e) => setApiPort(Number(e.target.value))}
                  disabled={apiStatus?.running}
                  className="input w-full"
                  min={1024}
                  max={65535}
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-slate-500 mb-1">Auth Token (optional)</label>
                <input
                  type="text"
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                  disabled={apiStatus?.running}
                  placeholder="Bearer token..."
                  className="input w-full"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              {apiStatus?.running ? (
                <>
                  <div className="flex items-center gap-2 flex-1">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-sm text-green-400">Running</span>
                    <button
                      onClick={handleCopyUrl}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-white bg-slate-700 rounded transition-colors"
                    >
                      {copiedUrl ? <CheckCircle className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copiedUrl ? 'Copied!' : apiStatus.url}
                    </button>
                  </div>
                  <button
                    onClick={handleStopApi}
                    disabled={apiLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
                  >
                    <Square className="w-3.5 h-3.5" />
                    Stop
                  </button>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 flex-1">
                    <div className="w-2 h-2 rounded-full bg-slate-500" />
                    <span className="text-sm text-slate-500">Stopped</span>
                  </div>
                  <button
                    onClick={handleStartApi}
                    disabled={apiLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-ghost-600 hover:bg-ghost-700 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Start Server
                  </button>
                </>
              )}
            </div>

            <div className="text-xs text-slate-500 mt-2 p-2 bg-slate-700/50 rounded">
              Endpoints: <code className="text-slate-400">GET /api/health</code>,{' '}
              <code className="text-slate-400">GET /api/profiles</code>,{' '}
              <code className="text-slate-400">POST /api/profiles/:id/launch</code>,{' '}
              <code className="text-slate-400">POST /api/workflows/:id/run</code>
            </div>
          </div>
        </div>

        {/* Phase 12.C.3 — Encrypted Credential Vault */}
        <div className="card">
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            {vaultStatus.unlocked ? (
              <Unlock className="w-4 h-4 text-green-400" />
            ) : (
              <Lock className="w-4 h-4 text-yellow-400" />
            )}
            Credential Vault
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            AES-256-GCM encrypted store for usernames, passwords, and 2FA secrets.
            Use the <code className="text-slate-400">useCredential</code> automation
            action to inject vault values into workflows. Auto-locks after 15 minutes idle.
          </p>

          {!vaultStatus.unlocked && (
            <div className="space-y-3">
              {!vaultStatus.initialized && (
                <div className="p-2 bg-amber-900/20 border border-amber-700/30 rounded text-xs text-amber-300">
                  No vault yet — set a master password below to create one.
                  This password cannot be recovered.
                </div>
              )}
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Master password</label>
                <input
                  type="password"
                  value={vaultPassword}
                  onChange={(e) => setVaultPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleVaultUnlock()}
                  placeholder={vaultStatus.initialized ? 'Enter master password' : 'Choose a strong password'}
                  className="input w-full"
                />
              </div>
              {vaultError && (
                <div className="text-xs text-red-400">{vaultError}</div>
              )}
              <button
                onClick={handleVaultUnlock}
                disabled={vaultLoading}
                className="btn-primary flex items-center gap-2 text-sm"
              >
                {vaultLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
                {vaultStatus.initialized ? 'Unlock Vault' : 'Create Vault'}
              </button>
            </div>
          )}

          {vaultStatus.unlocked && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-green-400">
                  <Unlock className="w-4 h-4" />
                  Unlocked — {vaultCreds.length} credential{vaultCreds.length === 1 ? '' : 's'}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowAddCred((v) => !v)}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 rounded transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add
                  </button>
                  <button
                    onClick={handleVaultLock}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-600 rounded transition-colors"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    Lock
                  </button>
                </div>
              </div>

              {vaultError && (
                <div className="text-xs text-red-400">{vaultError}</div>
              )}

              {showAddCred && (
                <div className="p-3 bg-slate-800/60 border border-slate-700/60 rounded space-y-2">
                  <input
                    type="text"
                    value={newCred.label}
                    onChange={(e) => setNewCred({ ...newCred, label: e.target.value })}
                    placeholder="Label (e.g. github-main)"
                    className="input w-full text-sm"
                  />
                  <input
                    type="text"
                    value={newCred.username}
                    onChange={(e) => setNewCred({ ...newCred, username: e.target.value })}
                    placeholder="Username / email"
                    className="input w-full text-sm"
                  />
                  <input
                    type="password"
                    value={newCred.password}
                    onChange={(e) => setNewCred({ ...newCred, password: e.target.value })}
                    placeholder="Password"
                    className="input w-full text-sm"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleAddCred}
                      disabled={vaultLoading}
                      className="btn-primary text-xs"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => { setShowAddCred(false); setNewCred({ label: '', username: '', password: '' }) }}
                      className="px-2.5 py-1 text-xs text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {vaultCreds.length === 0 && !showAddCred && (
                <div className="text-xs text-slate-500 italic">
                  No credentials yet. Click <span className="text-slate-300">Add</span> to create one.
                </div>
              )}

              {vaultCreds.length > 0 && (
                <div className="border border-slate-700/50 rounded overflow-hidden">
                  {vaultCreds.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center gap-3 px-3 py-2 border-b border-slate-700/50 last:border-b-0 hover:bg-slate-800/50"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white truncate">{c.label}</div>
                        <div className="text-xs text-slate-500 truncate">{c.username}</div>
                      </div>
                      <button
                        onClick={() => handleDeleteCred(c.id)}
                        className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                        title="Delete credential"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Phase 14.A — Remote Browser Nodes */}
        {/* Detection Layer 3 — live WAF canary */}
        <div className="card">
          <h2 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
            <Radar className="w-4 h-4" />
            Detection Canary
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Loads a page you control through each profile during a detection test and records whether a
            real WAF challenged it. Every other check reasons about your fingerprint; this one measures
            what a production bot-mitigation system actually did.
          </p>

          <label className="flex items-start gap-2.5 mb-4 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={settings.canary?.enabled ?? false}
              onChange={(e) => setSettings({
                ...settings,
                canary: { ...(settings.canary ?? { url: '', sentinel: '' }), enabled: e.target.checked }
              })}
            />
            <span className="text-xs text-slate-300">
              Run the canary during detection tests
              <span className="block text-[11px] text-slate-500 mt-0.5">
                Off by default — it sends a request from every profile you test.
              </span>
            </span>
          </label>

          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Canary URL</label>
              <input
                className="input-field text-xs w-full"
                placeholder="https://canary.yourdomain.com/"
                value={settings.canary?.url ?? ''}
                onChange={(e) => setSettings({
                  ...settings,
                  canary: { ...(settings.canary ?? { enabled: false, sentinel: '' }), url: e.target.value }
                })}
              />
              <p className="text-[11px] text-slate-600 mt-1">
                Use a domain you own, behind Cloudflare Bot Fight Mode or equivalent. Pointing this at a
                third party gives unreliable readings and puts load on someone else&apos;s site.
              </p>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Page sentinel</label>
              <input
                className="input-field text-xs w-full"
                placeholder="a string that appears only on the real page"
                value={settings.canary?.sentinel ?? ''}
                onChange={(e) => setSettings({
                  ...settings,
                  canary: { ...(settings.canary ?? { enabled: false, url: '' }), sentinel: e.target.value }
                })}
              />
              <p className="text-[11px] text-slate-600 mt-1">
                Challenge pages are often served with HTTP 200. Without a sentinel to look for, an
                interstitial is indistinguishable from your real page.
              </p>
            </div>
          </div>
        </div>

        <RemoteNodesPanel />

        {/* Phase 15.B — Community Fingerprint Presets */}
        {COMMUNITY_PRESETS_ENABLED && <CommunityPresetsPanel />}

        {/* Phase 15.C — Outbound Webhooks */}
        <WebhooksPanel />

        {/* Keyboard Shortcuts */}
        <div className="card">
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Keyboard className="w-4 h-4" />
            Keyboard Shortcuts
          </h2>
          <div className="space-y-2">
            {SHORTCUTS.map((s) => (
              <div key={s.keys} className="flex items-center justify-between text-sm">
                <span className="text-slate-400">{s.action}</span>
                <kbd className="px-2 py-0.5 rounded bg-slate-700 text-slate-300 text-xs font-mono">
                  {s.keys}
                </kbd>
              </div>
            ))}
          </div>
        </div>

        {/* About */}
        <div className="card">
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Info className="w-4 h-4" />
            About ShadowDesk
          </h2>
          {/* Counts are derived, not typed in — the hardcoded ones had all
              drifted (8 presets, 17 actions, "0.3.0 Beta" against a 1.0.0
              package). */}
          <div className="space-y-2 text-sm text-slate-400">
            <div className="flex justify-between">
              <span>Version</span>
              <span className="text-slate-300">{__APP_VERSION__}</span>
            </div>
            <div className="flex justify-between">
              <span>Edition</span>
              <span className="text-slate-300">{DESKTOP_ONLY ? 'Desktop (local)' : 'Cloud'}</span>
            </div>
            <div className="flex justify-between">
              <span>Fingerprint Layer</span>
              <span className="text-slate-300">CDP + JS Injection</span>
            </div>
            <div className="flex justify-between">
              <span>Fingerprint Presets</span>
              <span className="text-slate-300">{presetCount ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span>Automation Actions</span>
              <span className="text-slate-300">{Object.keys(ACTION_META).length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
