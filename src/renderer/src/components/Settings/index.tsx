import React, { useEffect, useState } from 'react'
import { Save, RefreshCw, Info, Keyboard, Server, Play, Square, Copy, CheckCircle } from 'lucide-react'
import type { ApiServerStatus, ApiServerConfig } from '../../types'

interface Settings {
  defaultPreset: string
  language: string
  theme: string
  autoLaunchLastSession: boolean
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

  useEffect(() => {
    window.api.settings.get().then(setSettings)
    window.api.apiServer.status().then(setApiStatus)
    window.api.apiServer.config().then((cfg) => {
      setApiPort(cfg.port)
      setApiToken(cfg.authToken ?? '')
    })
  }, [])

  const handleChange = (key: keyof Settings, value: string | boolean) => {
    if (!settings) return
    setSettings({ ...settings, [key]: value })
    setSaved(false)
  }

  const handleSave = async () => {
    if (!settings) return
    setSaving(true)
    try {
      const updated = await window.api.settings.update(settings)
      setSettings(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
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
                <option value="light">Light (coming soon)</option>
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
            About Ghost Browser
          </h2>
          <div className="space-y-2 text-sm text-slate-400">
            <div className="flex justify-between">
              <span>Version</span>
              <span className="text-slate-300">0.3.0 Beta</span>
            </div>
            <div className="flex justify-between">
              <span>Phase</span>
              <span className="text-slate-300">4 - Automation API + RPA</span>
            </div>
            <div className="flex justify-between">
              <span>Fingerprint Layer</span>
              <span className="text-slate-300">CDP + JS Injection</span>
            </div>
            <div className="flex justify-between">
              <span>Vectors Protected</span>
              <span className="text-green-400">19 / 19</span>
            </div>
            <div className="flex justify-between">
              <span>Fingerprint Presets</span>
              <span className="text-slate-300">8 (5 desktop + 3 mobile)</span>
            </div>
            <div className="flex justify-between">
              <span>Automation Actions</span>
              <span className="text-slate-300">17 (incl. conditional + loop)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
