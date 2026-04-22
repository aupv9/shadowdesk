import React, { useEffect, useRef, useState } from 'react'
import { CheckCircle, AlertCircle, Info, RefreshCw, ChevronDown, Sliders, AlertTriangle, Layers } from 'lucide-react'
import { Header } from '../Layout/Header'
import { useProfileStore } from '../../stores/profileStore'
import { FingerprintLivePreview } from './FingerprintLivePreview'
import type { BehaviorConfig, TimingConfig } from '../../types'

// Locale → valid timezone prefixes (mirrors presets.ts validation)
const LOCALE_TZ_MAP: Record<string, string[]> = {
  'en-us': ['America/'],
  'en-gb': ['Europe/London', 'Europe/Dublin'],
  'en':    ['America/', 'Europe/', 'Australia/', 'Asia/', 'Pacific/'],
  'vi':    ['Asia/Ho_Chi_Minh', 'Asia/Hanoi'],
  'th':    ['Asia/Bangkok'],
  'id':    ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura'],
}

function isLocaleTzMismatch(locale: string, timezone: string): boolean {
  const lang = locale.toLowerCase()
  const keys = Object.keys(LOCALE_TZ_MAP).sort((a, b) => b.length - a.length)
  for (const key of keys) {
    if (lang === key || lang.startsWith(key)) {
      return !LOCALE_TZ_MAP[key].some((z) => timezone.startsWith(z))
    }
  }
  return false
}

const VECTORS = [
  { category: 'Browser',    name: 'User-Agent / UA-CH',        risk: 'critical', status: 'spoofed', tooltip: 'Controls browser identity string and Client Hints headers. Critical for matching browser/OS consistency.' },
  { category: 'Browser',    name: 'Platform / OS Version',     risk: 'critical', status: 'spoofed', tooltip: 'Spoofs navigator.platform and OS version strings to match the selected preset.' },
  { category: 'Graphics',   name: 'Canvas Fingerprint',         risk: 'critical', status: 'spoofed', tooltip: 'Injects deterministic noise into canvas rendering to prevent unique GPU-based identification.' },
  { category: 'Graphics',   name: 'WebGL Vendor/Renderer',      risk: 'high',     status: 'spoofed', tooltip: 'Overrides GPU vendor/renderer strings reported by WebGL API.' },
  { category: 'Graphics',   name: 'WebGL Parameters',           risk: 'high',     status: 'spoofed', tooltip: 'Spoofs WebGL extension and parameter queries to match common GPU profiles.' },
  { category: 'Audio',      name: 'AudioContext',                risk: 'high',     status: 'spoofed', tooltip: 'Adds noise to AudioContext processing to prevent audio-based fingerprinting.' },
  { category: 'Hardware',   name: 'Screen Resolution',          risk: 'medium',   status: 'spoofed', tooltip: 'Overrides screen.width/height and related properties.' },
  { category: 'Hardware',   name: 'Device Memory',              risk: 'medium',   status: 'spoofed', tooltip: 'Spoofs navigator.deviceMemory to a common value (4/8 GB).' },
  { category: 'Hardware',   name: 'Hardware Concurrency',       risk: 'medium',   status: 'spoofed', tooltip: 'Overrides navigator.hardwareConcurrency (CPU core count).' },
  { category: 'Network',    name: 'WebRTC Local IP',            risk: 'critical', status: 'spoofed', tooltip: 'Prevents local IP address leaks through WebRTC ICE candidates.' },
  { category: 'Locale',     name: 'Timezone',                   risk: 'high',     status: 'spoofed', tooltip: 'Spoofs Intl.DateTimeFormat timezone to match the profile\'s locale.' },
  { category: 'Locale',     name: 'Language / Accept-Language', risk: 'high',     status: 'spoofed', tooltip: 'Controls navigator.language and Accept-Language HTTP header.' },
  { category: 'Fonts',      name: 'Font Enumeration',           risk: 'high',     status: 'spoofed', tooltip: 'Whitelists fonts reported by document.fonts.check() to a platform-appropriate set.' },
  { category: 'Fonts',      name: 'Font Metrics',               risk: 'medium',   status: 'spoofed', tooltip: 'Adds subtle noise to measureText() results to prevent font metric fingerprinting.' },
  { category: 'DOM',        name: 'ClientRects noise',          risk: 'medium',   status: 'spoofed', tooltip: 'Injects sub-pixel noise into getBoundingClientRect() and getClientRects().' },
  { category: 'API',        name: 'Battery API',                risk: 'low',      status: 'spoofed', tooltip: 'Spoofs or blocks the Battery Status API to prevent charge-level tracking.' },
  { category: 'API',        name: 'Media Devices',              risk: 'medium',   status: 'spoofed', tooltip: 'Controls the number and types of media devices reported by enumerateDevices().' },
  { category: 'API',        name: 'Speech Synthesis Voices',    risk: 'low',      status: 'spoofed', tooltip: 'Filters speechSynthesis.getVoices() to OS-appropriate voice subset.' },
  { category: 'Browser',    name: 'Plugin / MimeType List',     risk: 'high',     status: 'spoofed', tooltip: 'Overrides navigator.plugins with a realistic browser plugin set.' },
  { category: 'Mobile',     name: 'Touch Points / Events',      risk: 'high',     status: 'spoofed', tooltip: 'Spoofs maxTouchPoints and touch event support for mobile emulation.' },
  { category: 'Mobile',     name: 'Device Pixel Ratio',         risk: 'medium',   status: 'spoofed', tooltip: 'Overrides window.devicePixelRatio to match the target device.' },
  { category: 'Mobile',     name: 'Mobile UA & Platform',       risk: 'critical', status: 'spoofed', tooltip: 'Ensures mobile User-Agent, platform, and feature flags are consistent.' },
  // Phase 5: New vectors
  { category: 'Evasion',    name: 'CDP Automation Hiding',      risk: 'critical', status: 'spoofed', tooltip: 'Removes Chrome DevTools Protocol traces that indicate automation.' },
  { category: 'Evasion',    name: 'ChromeDriver Variables',     risk: 'critical', status: 'spoofed', tooltip: 'Cleans up global variables (cdc_, $cdc_) left by ChromeDriver.' },
  { category: 'Evasion',    name: 'Error Stack Sanitization',   risk: 'high',     status: 'spoofed', tooltip: 'Removes automation framework paths from Error.stack traces.' },
  { category: 'Evasion',    name: 'Function.toString Masking',  risk: 'high',     status: 'spoofed', tooltip: 'Ensures overridden functions return \'[native code]\' from toString().' },
  { category: 'Evasion',    name: 'Headless Signal Hiding',     risk: 'critical', status: 'spoofed', tooltip: 'Removes indicators of headless Chrome (navigator.webdriver, etc.).' },
  { category: 'API',        name: 'Permissions API',            risk: 'medium',   status: 'spoofed', tooltip: 'Spoofs Permissions.query() results for consistent permission states.' },
  { category: 'API',        name: 'Storage Quota',              risk: 'medium',   status: 'spoofed', tooltip: 'Overrides StorageManager.estimate() to return realistic quota values.' },
  { category: 'Network',    name: 'Network Information API',    risk: 'medium',   status: 'spoofed', tooltip: 'Spoofs navigator.connection properties (effectiveType, downlink, rtt).' },
  { category: 'API',        name: 'Performance Entries',        risk: 'high',     status: 'spoofed', tooltip: 'Sanitizes performance.getEntries() to remove automation-related entries.' },
  { category: 'Browser',    name: 'chrome.runtime Stub',        risk: 'high',     status: 'spoofed', tooltip: 'Provides a chrome.runtime stub so sites see a normal Chrome extension API.' },
  { category: 'Browser',    name: 'chrome.loadTimes Stub',      risk: 'medium',   status: 'spoofed', tooltip: 'Stubs the deprecated chrome.loadTimes() for older detection scripts.' },
  { category: 'Evasion',    name: 'iframe contentWindow',       risk: 'medium',   status: 'spoofed', tooltip: 'Propagates fingerprint overrides into cross-origin iframe contexts.' },
  // Phase 6: New vectors
  { category: 'Behavior',   name: 'Mouse Jitter Simulation',    risk: 'high',     status: 'spoofed', tooltip: 'Adds realistic micro-movements to mouse events to mimic human behavior.' },
  { category: 'Behavior',   name: 'Typing Cadence Noise',       risk: 'medium',   status: 'spoofed', tooltip: 'Varies keystroke timing to simulate natural typing rhythm.' },
  { category: 'Behavior',   name: 'Scroll Inertia Simulation',  risk: 'medium',   status: 'spoofed', tooltip: 'Adds momentum and deceleration to scroll events.' },
  { category: 'Timing',     name: 'Date.now() Quantisation',    risk: 'high',     status: 'spoofed', tooltip: 'Reduces Date.now() precision to prevent timing-based fingerprinting.' },
  { category: 'Timing',     name: 'rAF Timestamp Jitter',       risk: 'medium',   status: 'spoofed', tooltip: 'Adds slight jitter to requestAnimationFrame timestamps.' },
  { category: 'Timing',     name: 'performance.now() Clamping', risk: 'high',     status: 'spoofed', tooltip: 'Clamps performance.now() to a configurable precision level.' },
  { category: 'Timing',     name: 'Atomics.wait() Noise',       risk: 'medium',   status: 'spoofed', tooltip: 'Adds noise to SharedArrayBuffer timing measurements.' },
  { category: 'Evasion',    name: 'Object.defineProperty Trap', risk: 'high',     status: 'spoofed', tooltip: 'Prevents detection of property descriptor overrides.' },
  { category: 'Evasion',    name: 'Worker webdriver Patch',     risk: 'critical', status: 'spoofed', tooltip: 'Patches navigator.webdriver inside Web Worker contexts.' },
  { category: 'Evasion',    name: 'Blink Internal Masking',     risk: 'high',     status: 'spoofed', tooltip: 'Hides Blink-internal properties that reveal automation.' },
]

const RISK_BADGE: Record<string, string> = {
  critical: 'badge-red',
  high:     'badge-yellow',
  medium:   'badge-blue',
  low:      'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-400'
}

const categories = [...new Set(VECTORS.map((v) => v.category))]
const spoofedCount = VECTORS.filter((v) => v.status === 'spoofed').length
const score = Math.round((spoofedCount / VECTORS.length) * 100)

export function FingerprintEditor() {
  const { profiles, fetchProfiles, rerollFingerprint } = useProfileStore()
  const [selectedId,      setSelectedId]      = useState<string>('')
  const [rolling,         setRolling]         = useState(false)
  const [rolledMsg,       setRolledMsg]       = useState(false)
  const [savingBehavior,  setSavingBehavior]  = useState(false)
  const [behaviorMsg,     setBehaviorMsg]     = useState(false)
  const [presetKeys,      setPresetKeys]      = useState<string[]>([])
  const [switchingPreset, setSwitchingPreset] = useState(false)
  const [presetMsg,       setPresetMsg]       = useState(false)
  // Local editable copies of behavior/timing
  const [behavior, setBehavior] = useState<BehaviorConfig | null>(null)
  const [timing,   setTiming]   = useState<TimingConfig | null>(null)

  // Phase 13.B — Debounce fingerprint editor changes (500ms)
  const saveBehaviorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (profiles.length === 0) fetchProfiles()
    window.api.fingerprint.presets().then((p: Record<string, any>) => {
      setPresetKeys(Object.keys(p))
    }).catch(() => {})
  }, [])

  const selectedProfile = profiles.find((p) => p.id === selectedId) ?? null
  const fp = selectedProfile?.fingerprint

  // Sync local state when profile selection changes
  useEffect(() => {
    if (fp) {
      setBehavior(fp.behavior ?? { mouseJitter: true, typingNoise: true, scrollInertia: true })
      setTiming(fp.timing ?? { dateNoisePrecision: 100, rafJitter: true, performanceClamp: true })
    } else {
      setBehavior(null)
      setTiming(null)
    }
  }, [selectedId, fp?.behavior, fp?.timing])

  // Phase 13.B — Auto-save behavior/timing changes after 500ms debounce
  useEffect(() => {
    if (!selectedId || !fp || !behavior || !timing) return
    // Don't debounce the initial sync from profile selection
    if (behavior === fp.behavior && timing === fp.timing) return

    if (saveBehaviorTimerRef.current) clearTimeout(saveBehaviorTimerRef.current)
    saveBehaviorTimerRef.current = setTimeout(async () => {
      try {
        await window.api.profiles.update(selectedId, {
          fingerprint: { ...fp, behavior, timing }
        })
        await fetchProfiles()
        setBehaviorMsg(true)
        setTimeout(() => setBehaviorMsg(false), 2000)
      } catch { /* silently fail — user can manually save */ }
    }, 500)

    return () => {
      if (saveBehaviorTimerRef.current) clearTimeout(saveBehaviorTimerRef.current)
    }
  }, [behavior, timing])

  const handleReroll = async () => {
    if (!selectedId) return
    setRolling(true)
    try {
      await rerollFingerprint(selectedId)
      setRolledMsg(true)
      setTimeout(() => setRolledMsg(false), 2500)
    } finally {
      setRolling(false)
    }
  }

  const handleSaveBehavior = async () => {
    if (!selectedId || !fp || !behavior || !timing) return
    setSavingBehavior(true)
    try {
      await window.api.profiles.update(selectedId, {
        fingerprint: { ...fp, behavior, timing }
      })
      await fetchProfiles()
      setBehaviorMsg(true)
      setTimeout(() => setBehaviorMsg(false), 2000)
    } finally {
      setSavingBehavior(false)
    }
  }

  const handleChangePreset = async (presetKey: string) => {
    if (!selectedId || !presetKey || switchingPreset) return
    setSwitchingPreset(true)
    try {
      await (window.api.profiles as any).changePreset(selectedId, presetKey)
      await fetchProfiles()
      setPresetMsg(true)
      setTimeout(() => setPresetMsg(false), 2500)
    } finally {
      setSwitchingPreset(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Fingerprint Engine"
        subtitle={`${spoofedCount}/${VECTORS.length} vectors protected`}
      />

      <div className="flex-1 overflow-y-auto p-6">
        {/* Score Card */}
        <div className="card mb-6 border-ghost-600/30">
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16">
              <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="28" fill="none" stroke="#1e293b" strokeWidth="6" />
                <circle
                  cx="32" cy="32" r="28"
                  fill="none" stroke="#6366f1" strokeWidth="6"
                  strokeDasharray={`${2 * Math.PI * 28}`}
                  strokeDashoffset={`${2 * Math.PI * 28 * (1 - score / 100)}`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">
                {score}%
              </span>
            </div>
            <div className="flex-1">
              <div className="text-white font-semibold text-base">Protection Score</div>
              <div className="text-slate-400 text-sm mt-0.5">
                {spoofedCount} vectors actively spoofed across all profiles
              </div>
              <div className="flex items-center gap-1.5 mt-2 text-xs text-ghost-400">
                <Info className="w-3.5 h-3.5" />
                Layer 1 (CDP + JS) + Layer 2 (Advanced CDP Evasion) + iOS/Android presets active.
              </div>
            </div>
          </div>
        </div>

        {/* Profile inspector */}
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Profile Inspector</h3>
            {selectedProfile && (
              <button
                onClick={handleReroll}
                disabled={rolling}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ghost-600/20 hover:bg-ghost-600/30
                           text-ghost-400 text-xs font-medium transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${rolling ? 'animate-spin' : ''}`} />
                {rolling ? 'Re-rolling...' : 'Re-roll Fingerprint'}
              </button>
            )}
          </div>

          {/* Profile selector */}
          <div className="relative mb-4">
            <select
              className="input appearance-none pr-8"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              <option value="">— Select a profile to inspect —</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>

          {rolledMsg && (
            <p className="text-xs text-green-400 mb-3">✓ New fingerprint generated and saved</p>
          )}
          {presetMsg && (
            <p className="text-xs text-green-400 mb-3">✓ Preset applied — fingerprint updated</p>
          )}

          {/* Inline preset switcher — only when a profile is selected */}
          {selectedProfile && presetKeys.length > 0 && (
            <div className="flex items-center gap-2 mb-4">
              <Layers className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <div className="relative flex-1">
                <select
                  className="input appearance-none pr-8 text-xs"
                  value={fp?.preset ?? ''}
                  onChange={(e) => handleChangePreset(e.target.value)}
                  disabled={switchingPreset}
                >
                  {presetKeys.map((key) => (
                    <option key={key} value={key}>{key}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              </div>
              {switchingPreset && (
                <RefreshCw className="w-3.5 h-3.5 text-ghost-400 animate-spin shrink-0" />
              )}
            </div>
          )}

          {fp ? (
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
              <InfoRow label="Preset"      value={fp.preset} />
              <InfoRow label="Platform"    value={fp.browser.platform} />
              <InfoRow label="Screen"      value={`${fp.screen.width}×${fp.screen.height} (${fp.screen.pixelRatio}x)`} />
              <InfoRow label="Timezone"    value={fp.locale.timezone} />
              <InfoRow label="Language"    value={fp.locale.language} />
              {isLocaleTzMismatch(fp.locale.language, fp.locale.timezone) && (
                <div className="col-span-2 flex items-center gap-2 text-amber-400 bg-amber-900/20 border border-amber-500/30 rounded-lg px-3 py-2 mt-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Locale/timezone mismatch — detectable by fingerprint tools</span>
                </div>
              )}
              <InfoRow label="Device RAM"  value={`${fp.hardware.deviceMemory} GB`} />
              <InfoRow label="CPU Cores"   value={`${fp.hardware.hardwareConcurrency}`} />
              <InfoRow label="WebGL"       value={fp.webgl.renderer} mono truncate />
              <InfoRow label="Canvas seed" value={String(fp.canvas.noiseSeed)} mono />
              <InfoRow label="WebRTC"      value={fp.webrtc.mode} />
              <InfoRow label="Touch points" value={String(fp.hardware.maxTouchPoints)} />
            </div>
          ) : (
            <p className="text-xs text-slate-500">Select a profile above to view its fingerprint values</p>
          )}
        </div>

        {/* Phase 13.D — Live UA Preview + Uniqueness Score */}
        {fp && (
          <div className="mb-6">
            <FingerprintLivePreview fingerprint={fp} />
          </div>
        )}

        {/* Behavior & Timing Configuration (Phase 6) */}
        {fp && behavior && timing && (
          <div className="card mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-ghost-400" />
                <h3 className="text-sm font-semibold text-white">Behavior & Timing</h3>
              </div>
              <button
                onClick={handleSaveBehavior}
                disabled={savingBehavior}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ghost-600/20 hover:bg-ghost-600/30
                           text-ghost-400 text-xs font-medium transition-colors disabled:opacity-50"
              >
                {savingBehavior ? <RefreshCw className="w-3 h-3 animate-spin" /> : null}
                {savingBehavior ? 'Saving...' : 'Save'}
              </button>
            </div>

            {behaviorMsg && (
              <p className="text-xs text-green-400 mb-3">✓ Behavior settings saved</p>
            )}

            <div className="space-y-4">
              {/* Behavior section */}
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Behavior Simulation</p>
                <div className="space-y-2">
                  <BehaviorToggle
                    label="Mouse Jitter"
                    description="Adds sub-pixel Gaussian noise to pointer events"
                    checked={behavior.mouseJitter}
                    onChange={(v) => setBehavior({ ...behavior, mouseJitter: v })}
                  />
                  <BehaviorToggle
                    label="Typing Cadence Noise"
                    description="Randomises keydown/keyup event timing (±25 ms variance)"
                    checked={behavior.typingNoise}
                    onChange={(v) => setBehavior({ ...behavior, typingNoise: v })}
                  />
                  <BehaviorToggle
                    label="Scroll Inertia"
                    description="Simulates natural momentum decay on wheel events"
                    checked={behavior.scrollInertia}
                    onChange={(v) => setBehavior({ ...behavior, scrollInertia: v })}
                  />
                </div>
              </div>

              {/* Timing section */}
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Timing Defenses</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between bg-slate-800/60 rounded-lg px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-200">Date.now() Precision</p>
                      <p className="text-xs text-slate-500 mt-0.5">Quantise to nearest block (ms)</p>
                    </div>
                    <select
                      className="bg-slate-700 border border-slate-600 text-slate-200 text-xs rounded-lg px-2 py-1.5
                                 focus:outline-none focus:border-ghost-500 ml-3"
                      value={timing.dateNoisePrecision}
                      onChange={(e) => setTiming({ ...timing, dateNoisePrecision: Number(e.target.value) as 50 | 100 | 250 })}
                    >
                      <option value={50}>50 ms (high noise)</option>
                      <option value={100}>100 ms (balanced)</option>
                      <option value={250}>250 ms (max noise)</option>
                    </select>
                  </div>
                  <BehaviorToggle
                    label="rAF Timestamp Jitter"
                    description="Adds ±1.2 ms Gaussian noise to requestAnimationFrame timestamps"
                    checked={timing.rafJitter}
                    onChange={(v) => setTiming({ ...timing, rafJitter: v })}
                  />
                  <BehaviorToggle
                    label="performance.now() Clamping"
                    description="Reduces performance.now() precision to match Date.now()"
                    checked={timing.performanceClamp}
                    onChange={(v) => setTiming({ ...timing, performanceClamp: v })}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Vector Table by Category */}
        {categories.map((cat) => (
          <div key={cat} className="mb-5">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{cat}</h3>
            <div className="space-y-1.5">
              {VECTORS.filter((v) => v.category === cat).map((v) => (
                <div key={v.name} className="flex items-center gap-3 bg-slate-800/50 rounded-lg px-3 py-2.5">
                  {v.status === 'spoofed'
                    ? <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                    : <AlertCircle className="w-4 h-4 text-slate-500 shrink-0" />
                  }
                  <span className={`text-sm flex-1 flex items-center gap-1 ${v.status === 'spoofed' ? 'text-slate-200' : 'text-slate-500'}`} title={v.tooltip}>
                    {v.name}
                    <Info className="w-3 h-3 text-slate-500 shrink-0" />
                  </span>
                  <span className={RISK_BADGE[v.risk]}>{v.risk}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    v.status === 'spoofed' ? 'bg-green-900/40 text-green-400' : 'bg-slate-700 text-slate-500'
                  }`}>
                    {v.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function InfoRow({ label, value, mono, truncate }: {
  label: string
  value: string
  mono?: boolean
  truncate?: boolean
}) {
  return (
    <>
      <span className="text-slate-500">{label}</span>
      <span
        className={`text-slate-200 ${mono ? 'font-mono' : ''} ${truncate ? 'truncate' : ''}`}
        title={value}
      >
        {value}
      </span>
    </>
  )
}

function BehaviorToggle({
  label, description, checked, onChange
}: {
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between bg-slate-800/60 rounded-lg px-3 py-2.5">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-200">{label}</p>
        <p className="text-xs text-slate-500 mt-0.5">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 ml-3 rounded-full border-2 border-transparent
                    transition-colors focus:outline-none
                    ${checked ? 'bg-ghost-600' : 'bg-slate-700'}`}
        role="switch"
        aria-checked={checked}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow
                      transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`}
        />
      </button>
    </div>
  )
}
