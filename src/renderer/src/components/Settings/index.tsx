import React, { useEffect, useState } from 'react'
import { Save, RefreshCw, Info, Keyboard } from 'lucide-react'

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
  { value: 'linux-ubuntu-chrome120', label: 'Ubuntu 22.04 — Chrome 120' }
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

  useEffect(() => {
    window.api.settings.get().then(setSettings)
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
              <span className="text-slate-300">0.1.0 Beta</span>
            </div>
            <div className="flex justify-between">
              <span>Phase</span>
              <span className="text-slate-300">3 - Monetization + Team</span>
            </div>
            <div className="flex justify-between">
              <span>Fingerprint Layer</span>
              <span className="text-slate-300">CDP + JS Injection</span>
            </div>
            <div className="flex justify-between">
              <span>Vectors Protected</span>
              <span className="text-green-400">19 / 19</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
