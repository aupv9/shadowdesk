import React, { useEffect, useState } from 'react'
import { CheckCircle, AlertCircle, Info, RefreshCw, ChevronDown } from 'lucide-react'
import { Header } from '../Layout/Header'
import { useProfileStore } from '../../stores/profileStore'

const VECTORS = [
  { category: 'Browser',    name: 'User-Agent / UA-CH',        risk: 'critical', status: 'spoofed' },
  { category: 'Browser',    name: 'Platform / OS Version',     risk: 'critical', status: 'spoofed' },
  { category: 'Graphics',   name: 'Canvas Fingerprint',         risk: 'critical', status: 'spoofed' },
  { category: 'Graphics',   name: 'WebGL Vendor/Renderer',      risk: 'high',     status: 'spoofed' },
  { category: 'Graphics',   name: 'WebGL Parameters',           risk: 'high',     status: 'spoofed' },
  { category: 'Audio',      name: 'AudioContext',                risk: 'high',     status: 'spoofed' },
  { category: 'Hardware',   name: 'Screen Resolution',          risk: 'medium',   status: 'spoofed' },
  { category: 'Hardware',   name: 'Device Memory',              risk: 'medium',   status: 'spoofed' },
  { category: 'Hardware',   name: 'Hardware Concurrency',       risk: 'medium',   status: 'spoofed' },
  { category: 'Network',    name: 'WebRTC Local IP',            risk: 'critical', status: 'spoofed' },
  { category: 'Locale',     name: 'Timezone',                   risk: 'high',     status: 'spoofed' },
  { category: 'Locale',     name: 'Language / Accept-Language', risk: 'high',     status: 'spoofed' },
  { category: 'Fonts',      name: 'Font Enumeration',           risk: 'high',     status: 'spoofed' },
  { category: 'Fonts',      name: 'Font Metrics',               risk: 'medium',   status: 'spoofed' },
  { category: 'DOM',        name: 'ClientRects noise',          risk: 'medium',   status: 'spoofed' },
  { category: 'API',        name: 'Battery API',                risk: 'low',      status: 'spoofed' },
  { category: 'API',        name: 'Media Devices',              risk: 'medium',   status: 'spoofed' },
  { category: 'API',        name: 'Speech Synthesis Voices',    risk: 'low',      status: 'spoofed' },
  { category: 'Browser',    name: 'Plugin / MimeType List',     risk: 'high',     status: 'spoofed' },
  { category: 'Mobile',     name: 'Touch Points / Events',      risk: 'high',     status: 'spoofed' },
  { category: 'Mobile',     name: 'Device Pixel Ratio',         risk: 'medium',   status: 'spoofed' },
  { category: 'Mobile',     name: 'Mobile UA & Platform',       risk: 'critical', status: 'spoofed' },
  // Phase 5: New vectors
  { category: 'Evasion',    name: 'CDP Automation Hiding',      risk: 'critical', status: 'spoofed' },
  { category: 'Evasion',    name: 'ChromeDriver Variables',     risk: 'critical', status: 'spoofed' },
  { category: 'Evasion',    name: 'Error Stack Sanitization',   risk: 'high',     status: 'spoofed' },
  { category: 'Evasion',    name: 'Function.toString Masking',  risk: 'high',     status: 'spoofed' },
  { category: 'Evasion',    name: 'Headless Signal Hiding',     risk: 'critical', status: 'spoofed' },
  { category: 'API',        name: 'Permissions API',            risk: 'medium',   status: 'spoofed' },
  { category: 'API',        name: 'Storage Quota',              risk: 'medium',   status: 'spoofed' },
  { category: 'Network',    name: 'Network Information API',    risk: 'medium',   status: 'spoofed' },
  { category: 'API',        name: 'Performance Entries',        risk: 'high',     status: 'spoofed' },
  { category: 'Browser',    name: 'chrome.runtime Stub',        risk: 'high',     status: 'spoofed' },
  { category: 'Browser',    name: 'chrome.loadTimes Stub',      risk: 'medium',   status: 'spoofed' },
  { category: 'Evasion',    name: 'iframe contentWindow',       risk: 'medium',   status: 'spoofed' },
  // Phase 6: New vectors
  { category: 'Behavior',   name: 'Mouse Jitter Simulation',    risk: 'high',     status: 'spoofed' },
  { category: 'Behavior',   name: 'Typing Cadence Noise',       risk: 'medium',   status: 'spoofed' },
  { category: 'Behavior',   name: 'Scroll Inertia Simulation',  risk: 'medium',   status: 'spoofed' },
  { category: 'Timing',     name: 'Date.now() Quantisation',    risk: 'high',     status: 'spoofed' },
  { category: 'Timing',     name: 'rAF Timestamp Jitter',       risk: 'medium',   status: 'spoofed' },
  { category: 'Timing',     name: 'performance.now() Clamping', risk: 'high',     status: 'spoofed' },
  { category: 'Timing',     name: 'Atomics.wait() Noise',       risk: 'medium',   status: 'spoofed' },
  { category: 'Evasion',    name: 'Object.defineProperty Trap', risk: 'high',     status: 'spoofed' },
  { category: 'Evasion',    name: 'Worker webdriver Patch',     risk: 'critical', status: 'spoofed' },
  { category: 'Evasion',    name: 'Blink Internal Masking',     risk: 'high',     status: 'spoofed' },
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
  const [selectedId,  setSelectedId]  = useState<string>('')
  const [rolling,     setRolling]     = useState(false)
  const [rolledMsg,   setRolledMsg]   = useState(false)

  useEffect(() => {
    if (profiles.length === 0) fetchProfiles()
  }, [])

  const selectedProfile = profiles.find((p) => p.id === selectedId) ?? null
  const fp = selectedProfile?.fingerprint

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

          {fp ? (
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
              <InfoRow label="Preset"      value={fp.preset} />
              <InfoRow label="User-Agent"  value={fp.browser.userAgent} mono truncate />
              <InfoRow label="Platform"    value={fp.browser.platform} />
              <InfoRow label="Screen"      value={`${fp.screen.width}×${fp.screen.height} (${fp.screen.pixelRatio}x)`} />
              <InfoRow label="Timezone"    value={fp.locale.timezone} />
              <InfoRow label="Language"    value={fp.locale.language} />
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
                  <span className={`text-sm flex-1 ${v.status === 'spoofed' ? 'text-slate-200' : 'text-slate-500'}`}>
                    {v.name}
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
