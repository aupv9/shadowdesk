/**
 * Phase 13.C — Welcome wizard for first-time users.
 *
 * 4-step onboarding flow:
 *   1. Introduction — what ShadowDesk does
 *   2. Create first profile + pick a fingerprint preset
 *   3. Add a proxy (optional, skippable)
 *   4. Ready — launch profile
 *
 * Shown once on first launch. Dismissed state is persisted to
 * localStorage under `ghostbrowser.welcomeDismissed`.
 */

import React, { useState } from 'react'
import {
  Shield, Globe, Zap, CheckCircle,
  ChevronRight, ChevronLeft, X, Monitor,
  Wifi, Rocket
} from 'lucide-react'

const STORAGE_KEY = 'ghostbrowser.welcomeDismissed'

export function useWelcomeWizard() {
  const [show, setShow] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) !== '1'
    } catch {
      return true
    }
  })

  const dismiss = () => {
    try { localStorage.setItem(STORAGE_KEY, '1') } catch { /* */ }
    setShow(false)
  }

  return { show, dismiss }
}

// ── Step definitions ──────────────────────────────────────────────────────────

interface StepProps {
  onNext: () => void
  onSkip: () => void
}

function StepIntro({ onNext }: StepProps) {
  return (
    <div className="flex flex-col items-center text-center gap-5">
      <div className="w-20 h-20 rounded-3xl bg-indigo-600/20 ring-1 ring-indigo-500/30 flex items-center justify-center">
        <Shield className="w-10 h-10 text-indigo-400" />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Welcome to ShadowDesk</h2>
        <p className="text-slate-400 text-sm max-w-sm">
          The anti-detect browser platform for professionals. Each profile runs
          in a fully isolated Chromium with its own unique fingerprint, cookies,
          and proxy — completely invisible to fingerprinting services.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-3 w-full mt-2">
        {[
          { icon: Shield, label: '45+ vectors spoofed', color: 'text-indigo-400' },
          { icon: Globe,  label: 'Proxy per profile',   color: 'text-emerald-400' },
          { icon: Zap,    label: 'Automation engine',   color: 'text-amber-400'   },
        ].map(({ icon: Icon, label, color }) => (
          <div key={label} className="flex flex-col items-center gap-2 p-3 rounded-xl bg-slate-800/60 border border-slate-700">
            <Icon className={`w-5 h-5 ${color}`} />
            <span className="text-xs text-slate-400 text-center">{label}</span>
          </div>
        ))}
      </div>
      <button onClick={onNext} className="btn-primary flex items-center gap-2 px-6 py-2.5 text-sm font-medium w-full justify-center">
        Get started <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}

const PRESETS = [
  { key: 'win11-chrome121', label: 'Windows 11 + Chrome 121', os: 'Windows', recommended: true },
  { key: 'win10-chrome120', label: 'Windows 10 + Chrome 120', os: 'Windows' },
  { key: 'mac-sonoma-chrome121', label: 'macOS Sonoma + Chrome 121', os: 'macOS' },
  { key: 'linux-ubuntu-chrome120', label: 'Ubuntu + Chrome 120', os: 'Linux' },
  { key: 'android-pixel-chrome121', label: 'Pixel 7 + Chrome 121', os: 'Android' },
]

function StepCreateProfile({ onNext, onSkip }: StepProps) {
  const [name, setName] = useState('')
  const [preset, setPreset] = useState('win11-chrome121')

  const handleCreate = async () => {
    if (!name.trim()) return
    try {
      await window.api.profiles.create({ name: name.trim(), preset })
    } catch { /* non-fatal — user can create via ProfileManager */ }
    onNext()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-600/20 flex items-center justify-center">
          <Monitor className="w-5 h-5 text-indigo-400" />
        </div>
        <div>
          <h3 className="text-white font-semibold">Create your first profile</h3>
          <p className="text-slate-400 text-xs">Pick a name and fingerprint preset</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs text-slate-400 font-medium">Profile name</label>
        <input
          className="input"
          placeholder="e.g. Shopping Account 1"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          autoFocus
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs text-slate-400 font-medium">Fingerprint preset</label>
        <div className="flex flex-col gap-1 max-h-44 overflow-y-auto pr-1">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPreset(p.key)}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition-colors text-sm ${
                preset === p.key
                  ? 'border-indigo-500 bg-indigo-600/15 text-white'
                  : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500'
              }`}
            >
              <span>{p.label}</span>
              {p.recommended && (
                <span className="text-xs text-indigo-400 font-medium">Recommended</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 mt-1">
        <button
          onClick={handleCreate}
          disabled={!name.trim()}
          className="btn-primary flex-1 text-sm flex items-center justify-center gap-2 disabled:opacity-50"
        >
          Create & Continue <ChevronRight className="w-4 h-4" />
        </button>
        <button onClick={onSkip} className="btn-ghost text-xs px-3">
          Skip
        </button>
      </div>
    </div>
  )
}

function StepAddProxy({ onNext, onSkip }: StepProps) {
  const [host, setHost] = useState('')
  const [port, setPort] = useState('')
  const [type, setType] = useState<'http' | 'socks5'>('http')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!host.trim() || !port.trim()) return
    setSaving(true)
    try {
      await window.api.proxies.create({
        name: `${type.toUpperCase()} ${host}:${port}`,
        type,
        host: host.trim(),
        port: parseInt(port, 10),
        username: '',
        password: '',
      })
    } catch { /* non-fatal */ }
    setSaving(false)
    onNext()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-600/20 flex items-center justify-center">
          <Wifi className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h3 className="text-white font-semibold">Add a proxy <span className="text-slate-500 font-normal">(optional)</span></h3>
          <p className="text-slate-400 text-xs">Route your profile traffic through a proxy</p>
        </div>
      </div>

      <div className="flex gap-2">
        {(['http', 'socks5'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              type === t ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2">
          <label className="text-xs text-slate-400 mb-1 block">Host / IP</label>
          <input
            className="input"
            placeholder="192.168.1.1"
            value={host}
            onChange={(e) => setHost(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Port</label>
          <input
            className="input"
            placeholder="1080"
            type="number"
            value={port}
            onChange={(e) => setPort(e.target.value)}
          />
        </div>
      </div>

      <div className="flex gap-2 mt-1">
        <button
          onClick={handleSave}
          disabled={saving || !host.trim() || !port.trim()}
          className="btn-primary flex-1 text-sm flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {saving ? 'Saving…' : <>Add Proxy <ChevronRight className="w-4 h-4" /></>}
        </button>
        <button onClick={onSkip} className="btn-ghost text-xs px-3">
          Skip
        </button>
      </div>
    </div>
  )
}

function StepReady({ onNext }: StepProps) {
  return (
    <div className="flex flex-col items-center text-center gap-5">
      <div className="w-20 h-20 rounded-3xl bg-emerald-600/20 ring-1 ring-emerald-500/30 flex items-center justify-center">
        <Rocket className="w-10 h-10 text-emerald-400" />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">You're all set!</h2>
        <p className="text-slate-400 text-sm max-w-sm">
          Click <strong className="text-white">Launch</strong> on any profile card to open a fingerprinted
          Chromium window. Use the Automation section to build RPA workflows, or
          Detection Testing to verify your anti-fingerprint coverage.
        </p>
      </div>

      <div className="flex flex-col gap-2 w-full text-left">
        {[
          'Ctrl+N — create a new profile',
          'Ctrl+F — focus search',
          'Ctrl+R — refresh profile list',
          'Enter   — launch first profile in list',
        ].map((tip) => (
          <div key={tip} className="flex items-center gap-2 text-sm text-slate-400 bg-slate-800 rounded-lg px-3 py-2">
            <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            <code className="font-mono text-slate-300">{tip}</code>
          </div>
        ))}
      </div>

      <button onClick={onNext} className="btn-primary flex items-center gap-2 px-6 py-2.5 text-sm font-medium w-full justify-center">
        Open Browser Profiles <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}

// ── Main wizard component ─────────────────────────────────────────────────────

const STEPS = [StepIntro, StepCreateProfile, StepAddProxy, StepReady]
const STEP_LABELS = ['Welcome', 'Profile', 'Proxy', 'Ready']

interface WelcomeWizardProps {
  onDismiss: () => void
}

export function WelcomeWizard({ onDismiss }: WelcomeWizardProps) {
  const [step, setStep] = useState(0)

  const next = () => {
    if (step >= STEPS.length - 1) {
      onDismiss()
    } else {
      setStep((s) => s + 1)
    }
  }

  const back = () => setStep((s) => Math.max(0, s - 1))

  const StepComponent = STEPS[step]

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-md bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            {STEP_LABELS.map((label, i) => (
              <React.Fragment key={label}>
                <div
                  className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                    i === step
                      ? 'text-white'
                      : i < step
                      ? 'text-emerald-400'
                      : 'text-slate-600'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ring-1 transition-colors ${
                      i < step
                        ? 'bg-emerald-600 ring-emerald-500 text-white'
                        : i === step
                        ? 'bg-indigo-600 ring-indigo-500 text-white'
                        : 'bg-slate-800 ring-slate-600 text-slate-500'
                    }`}
                  >
                    {i < step ? <CheckCircle className="w-3 h-3" /> : i + 1}
                  </div>
                  <span className="hidden sm:block">{label}</span>
                </div>
                {i < STEP_LABELS.length - 1 && (
                  <div className={`h-px w-4 transition-colors ${i < step ? 'bg-emerald-600' : 'bg-slate-700'}`} />
                )}
              </React.Fragment>
            ))}
          </div>
          <button
            onClick={onDismiss}
            className="text-slate-500 hover:text-slate-300 transition-colors p-1"
            title="Skip setup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step body */}
        <div className="p-6">
          <StepComponent onNext={next} onSkip={next} />
        </div>

        {/* Footer nav — show back button from step 1 onwards */}
        {step > 0 && (
          <div className="px-6 pb-4 flex justify-start">
            <button
              onClick={back}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              <ChevronLeft className="w-3 h-3" /> Back
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
