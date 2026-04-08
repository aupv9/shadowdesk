import React, { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  ChevronDown,
  Keyboard,
  MousePointer2,
  RotateCcw,
  Save,
  ScrollText,
  Sliders,
  Sparkles,
  Timer,
  Wand2,
} from 'lucide-react'
import { Header } from '../Layout/Header'
import { useProfileStore } from '../../stores/profileStore'
import type { BehaviorConfig, BehaviorPreset, TimingConfig } from '../../types'
import { BehaviorVisualizer } from './BehaviorVisualizer'

/**
 * Phase 17 — Behavioral Config UI
 *
 * A dedicated, sliders-first screen for tuning per-profile behavior
 * simulation and timing defenses. Complements the FingerprintEditor
 * (which still owns the coarse on/off toggles) by exposing fine-grained
 * parameters: mouse jitter sigma, typing WPM, scroll decay, rAF sigma,
 * Atomics noise, etc.
 *
 * Workflow:
 *  1. Pick a profile
 *  2. Optionally apply a one-click preset bundle (Off / Subtle / Balanced / Heavy / Stealth)
 *  3. Fine-tune with sliders and toggles; see the live preview update in real time
 *  4. Save — the merged fingerprint is persisted to the profile
 */

// ── Local sensible defaults ──────────────────────────────────────────────
const DEFAULT_BEHAVIOR: Required<BehaviorConfig> = {
  mouseJitter: true,
  typingNoise: true,
  scrollInertia: true,
  mouseJitterIntensity: 'moderate',
  mouseJitterSigma: 0.4,
  typingWpm: 75,
  typingVariancePct: 20,
  typingHoldSigmaMs: 5,
  scrollDecay: 0.88,
  scrollNoisePx: 2,
}

const DEFAULT_TIMING: Required<TimingConfig> = {
  dateNoisePrecision: 100,
  rafJitter: true,
  performanceClamp: true,
  rafJitterSigmaMs: 1.2,
  atomicsWaitNoise: true,
}

// Map sigma value → intensity preset label
function sigmaToIntensity(sigma: number): 'off' | 'subtle' | 'moderate' | 'heavy' {
  if (sigma <= 0)    return 'off'
  if (sigma <= 0.3)  return 'subtle'
  if (sigma <= 0.6)  return 'moderate'
  return 'heavy'
}

export function BehavioralConfig() {
  const { profiles, fetchProfiles } = useProfileStore()
  const [selectedId, setSelectedId]       = useState<string>('')
  const [behavior,   setBehavior]         = useState<Required<BehaviorConfig>>(DEFAULT_BEHAVIOR)
  const [timing,     setTiming]           = useState<Required<TimingConfig>>(DEFAULT_TIMING)
  const [presets,    setPresets]          = useState<BehaviorPreset[]>([])
  const [saving,     setSaving]           = useState(false)
  const [savedFlash, setSavedFlash]       = useState(false)
  const [dirty,      setDirty]            = useState(false)

  // Fetch profiles + behavior presets on mount
  useEffect(() => {
    if (profiles.length === 0) fetchProfiles()
    const behaviorApi = (window.api as any).behavior
    if (behaviorApi?.presets) {
      behaviorApi.presets()
        .then((list: BehaviorPreset[]) => setPresets(list))
        .catch(() => setPresets([]))
    }
  }, [])

  // Auto-select the first profile so the UI isn't empty on open
  useEffect(() => {
    if (!selectedId && profiles.length > 0) {
      setSelectedId(profiles[0].id)
    }
  }, [profiles])

  const selectedProfile = profiles.find((p) => p.id === selectedId) ?? null
  const fp = selectedProfile?.fingerprint

  // Sync local editable state from the selected profile
  useEffect(() => {
    if (!fp) return
    setBehavior({ ...DEFAULT_BEHAVIOR, ...(fp.behavior ?? {}) })
    setTiming({ ...DEFAULT_TIMING, ...(fp.timing ?? {}) })
    setDirty(false)
  }, [selectedId, fp?.behavior, fp?.timing])

  // Helpers that mark the editor dirty on every change
  const updateBehavior = (patch: Partial<Required<BehaviorConfig>>) => {
    setBehavior((b) => {
      const next = { ...b, ...patch }
      // Keep intensity label consistent with sigma when slider moves
      if ('mouseJitterSigma' in patch) {
        next.mouseJitterIntensity = sigmaToIntensity(next.mouseJitterSigma)
      }
      return next
    })
    setDirty(true)
  }
  const updateTiming = (patch: Partial<Required<TimingConfig>>) => {
    setTiming((t) => ({ ...t, ...patch }))
    setDirty(true)
  }

  const applyPreset = (preset: BehaviorPreset) => {
    setBehavior({ ...DEFAULT_BEHAVIOR, ...preset.behavior })
    setTiming({ ...DEFAULT_TIMING, ...preset.timing })
    setDirty(true)
  }

  const resetToProfile = () => {
    if (!fp) return
    setBehavior({ ...DEFAULT_BEHAVIOR, ...(fp.behavior ?? {}) })
    setTiming({ ...DEFAULT_TIMING, ...(fp.timing ?? {}) })
    setDirty(false)
  }

  const handleSave = async () => {
    if (!selectedId || !fp) return
    setSaving(true)
    try {
      await window.api.profiles.update(selectedId, {
        fingerprint: { ...fp, behavior, timing },
      })
      await fetchProfiles()
      setDirty(false)
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 2200)
    } finally {
      setSaving(false)
    }
  }

  // Computed metrics for the summary cards
  const metrics = useMemo(() => {
    const baseInterKey = (60 * 1000) / (behavior.typingWpm * 5)
    const interKeySigma = baseInterKey * (behavior.typingVariancePct / 100)
    return {
      interKeyMs: baseInterKey.toFixed(1),
      interKeySigma: interKeySigma.toFixed(1),
      // Rough "stealth score" 0–100 — weighted average of enabled knobs
      stealthScore: Math.round(
        (behavior.mouseJitter ? Math.min(behavior.mouseJitterSigma / 1.2, 1) * 18 : 0) +
        (behavior.typingNoise ? Math.min(behavior.typingVariancePct / 40, 1) * 18 : 0) +
        (behavior.scrollInertia ? Math.min((0.98 - behavior.scrollDecay) / 0.2, 1) * 14 : 0) +
        (timing.performanceClamp ? 12 : 0) +
        (timing.rafJitter       ? Math.min(timing.rafJitterSigmaMs / 3, 1) * 12 : 0) +
        (timing.dateNoisePrecision >= 100 ? 14 : 6) +
        (timing.atomicsWaitNoise ? 12 : 0)
      ),
    }
  }, [behavior, timing])

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Behavioral Config"
        subtitle="Tune mouse jitter, typing cadence, scroll inertia and timing defenses per profile"
      />

      <div className="flex-1 overflow-y-auto p-6">
        {/* Profile selector + save toolbar */}
        <div className="card mb-6">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <select
                className="input appearance-none pr-8"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
              >
                <option value="">— Select a profile —</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
            <button
              onClick={resetToProfile}
              disabled={!dirty || saving || !fp}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600
                         text-slate-200 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Discard unsaved changes"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
            <button
              onClick={handleSave}
              disabled={!dirty || saving || !fp}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-ghost-600 hover:bg-ghost-500
                         text-white text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
            </button>
          </div>

          {savedFlash && (
            <p className="text-xs text-green-400 mt-3">✓ Behavioral settings saved to profile</p>
          )}
          {!fp && profiles.length > 0 && (
            <p className="text-xs text-slate-500 mt-3">Select a profile above to begin tuning.</p>
          )}
          {profiles.length === 0 && (
            <p className="text-xs text-slate-500 mt-3">No profiles yet — create one in the Profiles tab.</p>
          )}
        </div>

        {fp && (
          <>
            {/* One-click preset bundles */}
            {presets.length > 0 && (
              <div className="card mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-ghost-400" />
                  <h3 className="text-sm font-semibold text-white">Quick Presets</h3>
                </div>
                <p className="text-xs text-slate-500 mb-3">
                  One-click bundles that tune every knob below. Click a preset, tweak, then save.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                  {presets.map((p) => {
                    const isActive = behavior.mouseJitterIntensity === p.behavior.mouseJitterIntensity
                                  && behavior.typingWpm === p.behavior.typingWpm
                                  && timing.dateNoisePrecision === p.timing.dateNoisePrecision
                                  && timing.rafJitterSigmaMs === p.timing.rafJitterSigmaMs
                    return (
                      <button
                        key={p.id}
                        onClick={() => applyPreset(p)}
                        className={`text-left rounded-lg border px-3 py-2.5 transition-colors
                                    ${isActive
                                      ? 'bg-ghost-600/15 border-ghost-500/60 text-white'
                                      : 'bg-slate-800/60 border-slate-700 text-slate-200 hover:bg-slate-800 hover:border-slate-600'}`}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <Wand2 className="w-3 h-3 text-ghost-400" />
                          <span className="text-xs font-semibold">{p.name}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-tight">{p.description}</p>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Summary + live preview */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
              <div className="card">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-4 h-4 text-ghost-400" />
                  <h4 className="text-xs font-semibold text-white uppercase tracking-wider">Stealth Score</h4>
                </div>
                <div className="text-3xl font-bold text-white leading-tight">{metrics.stealthScore}<span className="text-base text-slate-500">/100</span></div>
                <div className="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-ghost-500 to-fuchsia-500 transition-all duration-300"
                    style={{ width: `${metrics.stealthScore}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-2">Weighted sum of enabled simulation knobs.</p>
              </div>

              <div className="card">
                <div className="flex items-center gap-2 mb-2">
                  <Keyboard className="w-4 h-4 text-ghost-400" />
                  <h4 className="text-xs font-semibold text-white uppercase tracking-wider">Typing Cadence</h4>
                </div>
                <div className="text-xl font-bold text-white leading-tight">
                  {behavior.typingWpm}<span className="text-sm text-slate-500"> wpm</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  ~{metrics.interKeyMs} ms/key · ±{metrics.interKeySigma} ms variance
                </p>
              </div>

              <div className="card">
                <div className="flex items-center gap-2 mb-2">
                  <Timer className="w-4 h-4 text-ghost-400" />
                  <h4 className="text-xs font-semibold text-white uppercase tracking-wider">Timing Defenses</h4>
                </div>
                <div className="text-xl font-bold text-white leading-tight">
                  {timing.dateNoisePrecision}<span className="text-sm text-slate-500"> ms block</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  rAF ±{timing.rafJitterSigmaMs} ms · perf.now {timing.performanceClamp ? 'clamped' : 'native'}
                </p>
              </div>
            </div>

            {/* Live visualizer */}
            <div className="card mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Sliders className="w-4 h-4 text-ghost-400" />
                <h3 className="text-sm font-semibold text-white">Live Preview</h3>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                Deterministic noise derived from the profile's canvas seed — identical runs produce
                identical traces, same as the injected scripts.
              </p>
              <BehaviorVisualizer
                behavior={behavior}
                seed={fp.canvas?.noiseSeed ?? 0}
              />
            </div>

            {/* Mouse section */}
            <div className="card mb-4">
              <ToggleRow
                icon={<MousePointer2 className="w-4 h-4 text-ghost-400" />}
                title="Mouse Jitter"
                description="Add sub-pixel Gaussian noise to clientX / clientY on pointer events"
                checked={behavior.mouseJitter}
                onChange={(v) => updateBehavior({ mouseJitter: v })}
              />
              {behavior.mouseJitter && (
                <div className="mt-4 pl-6 space-y-4">
                  <Slider
                    label="Jitter sigma (pixels)"
                    value={behavior.mouseJitterSigma}
                    min={0}
                    max={2}
                    step={0.05}
                    format={(v) => v.toFixed(2) + ' px'}
                    help={`Intensity: ${behavior.mouseJitterIntensity}`}
                    onChange={(v) => updateBehavior({ mouseJitterSigma: v })}
                  />
                  <IntensityRow
                    value={behavior.mouseJitterIntensity}
                    onChange={(intensity) => {
                      const sigmaMap = { off: 0, subtle: 0.2, moderate: 0.4, heavy: 0.9 }
                      updateBehavior({
                        mouseJitterIntensity: intensity,
                        mouseJitterSigma: sigmaMap[intensity],
                      })
                    }}
                  />
                </div>
              )}
            </div>

            {/* Typing section */}
            <div className="card mb-4">
              <ToggleRow
                icon={<Keyboard className="w-4 h-4 text-ghost-400" />}
                title="Typing Cadence Noise"
                description="Randomise keydown/keyup timeStamps to emulate human typing rhythm"
                checked={behavior.typingNoise}
                onChange={(v) => updateBehavior({ typingNoise: v })}
              />
              {behavior.typingNoise && (
                <div className="mt-4 pl-6 space-y-4">
                  <Slider
                    label="Target speed"
                    value={behavior.typingWpm}
                    min={40}
                    max={180}
                    step={5}
                    format={(v) => `${v} wpm`}
                    help="Average real-world typing: 40–60 slow · 60–90 normal · 90+ fast"
                    onChange={(v) => updateBehavior({ typingWpm: v })}
                  />
                  <Slider
                    label="Speed variance"
                    value={behavior.typingVariancePct}
                    min={0}
                    max={50}
                    step={1}
                    format={(v) => `±${v}%`}
                    help="How much each keystroke delay deviates from the target cadence"
                    onChange={(v) => updateBehavior({ typingVariancePct: v })}
                  />
                  <Slider
                    label="Key-hold jitter sigma"
                    value={behavior.typingHoldSigmaMs}
                    min={0}
                    max={15}
                    step={0.5}
                    format={(v) => `${v} ms`}
                    help="Variance between keydown and keyup events (real users ≈ 4–8 ms)"
                    onChange={(v) => updateBehavior({ typingHoldSigmaMs: v })}
                  />
                </div>
              )}
            </div>

            {/* Scroll section */}
            <div className="card mb-4">
              <ToggleRow
                icon={<ScrollText className="w-4 h-4 text-ghost-400" />}
                title="Scroll Inertia"
                description="Simulate natural momentum decay on WheelEvent.deltaY"
                checked={behavior.scrollInertia}
                onChange={(v) => updateBehavior({ scrollInertia: v })}
              />
              {behavior.scrollInertia && (
                <div className="mt-4 pl-6 space-y-4">
                  <Slider
                    label="Decay multiplier"
                    value={behavior.scrollDecay}
                    min={0.7}
                    max={0.98}
                    step={0.01}
                    format={(v) => v.toFixed(2)}
                    help="Lower = faster decay (trackpad feel). Higher = longer glide (mouse wheel)."
                    onChange={(v) => updateBehavior({ scrollDecay: v })}
                  />
                  <Slider
                    label="Delta noise sigma"
                    value={behavior.scrollNoisePx}
                    min={0}
                    max={8}
                    step={0.25}
                    format={(v) => `${v} px`}
                    help="Gaussian noise added to each wheel delta. 0 = clean inertia curve."
                    onChange={(v) => updateBehavior({ scrollNoisePx: v })}
                  />
                </div>
              )}
            </div>

            {/* Timing section */}
            <div className="card mb-4">
              <div className="flex items-center gap-2 mb-3">
                <Timer className="w-4 h-4 text-ghost-400" />
                <h3 className="text-sm font-semibold text-white">Timing Defenses</h3>
              </div>

              <div className="space-y-4">
                <PrecisionRow
                  value={timing.dateNoisePrecision}
                  onChange={(v) => updateTiming({ dateNoisePrecision: v })}
                />

                <ToggleRow
                  title="rAF timestamp jitter"
                  description="Add Gaussian noise to requestAnimationFrame callback timestamps"
                  checked={timing.rafJitter}
                  onChange={(v) => updateTiming({ rafJitter: v })}
                  compact
                />
                {timing.rafJitter && (
                  <div className="pl-6">
                    <Slider
                      label="Jitter sigma"
                      value={timing.rafJitterSigmaMs}
                      min={0}
                      max={5}
                      step={0.1}
                      format={(v) => `${v.toFixed(1)} ms`}
                      help="Real browsers: 0.5–1.5 ms. Over 3 ms may cause visible animation judder."
                      onChange={(v) => updateTiming({ rafJitterSigmaMs: v })}
                    />
                  </div>
                )}

                <ToggleRow
                  title="performance.now() clamping"
                  description="Lower performance.now() precision to match Date.now block size"
                  checked={timing.performanceClamp}
                  onChange={(v) => updateTiming({ performanceClamp: v })}
                  compact
                />

                <ToggleRow
                  title="Atomics.wait() noise"
                  description="Jitter SharedArrayBuffer timeout to defeat high-precision timers"
                  checked={timing.atomicsWaitNoise}
                  onChange={(v) => updateTiming({ atomicsWaitNoise: v })}
                  compact
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Reusable sub-components ─────────────────────────────────────────────────

function ToggleRow({
  icon, title, description, checked, onChange, compact,
}: {
  icon?: React.ReactNode
  title: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
  compact?: boolean
}) {
  return (
    <div className={`flex items-center justify-between ${compact ? '' : 'mb-1'}`}>
      <div className="flex items-start gap-2.5 flex-1 min-w-0">
        {icon && <div className="mt-0.5 shrink-0">{icon}</div>}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white">{title}</p>
          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
        </div>
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

function Slider({
  label, value, min, max, step, format, help, onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  format: (v: number) => string
  help?: string
  onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-medium text-slate-300">{label}</label>
        <span className="text-xs font-mono text-ghost-400 tabular-nums">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer
                   accent-ghost-500"
      />
      {help && <p className="text-[11px] text-slate-500 mt-1">{help}</p>}
    </div>
  )
}

function IntensityRow({
  value, onChange,
}: {
  value: 'off' | 'subtle' | 'moderate' | 'heavy'
  onChange: (v: 'off' | 'subtle' | 'moderate' | 'heavy') => void
}) {
  const options: Array<{ id: 'off' | 'subtle' | 'moderate' | 'heavy'; label: string }> = [
    { id: 'off',      label: 'Off' },
    { id: 'subtle',   label: 'Subtle' },
    { id: 'moderate', label: 'Moderate' },
    { id: 'heavy',    label: 'Heavy' },
  ]
  return (
    <div>
      <label className="text-xs font-medium text-slate-300 block mb-1.5">Intensity preset</label>
      <div className="inline-flex rounded-lg bg-slate-900 border border-slate-700 p-0.5 gap-0.5">
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors
                        ${value === o.id
                          ? 'bg-ghost-600 text-white'
                          : 'text-slate-400 hover:text-slate-200'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function PrecisionRow({
  value, onChange,
}: {
  value: 50 | 100 | 250
  onChange: (v: 50 | 100 | 250) => void
}) {
  const options: Array<{ id: 50 | 100 | 250; label: string; desc: string }> = [
    { id: 50,  label: '50 ms',  desc: 'High precision — may leak timing' },
    { id: 100, label: '100 ms', desc: 'Balanced default' },
    { id: 250, label: '250 ms', desc: 'Max noise — may break some sites' },
  ]
  return (
    <div>
      <label className="text-xs font-medium text-slate-300 block mb-1.5">Date.now() precision</label>
      <div className="grid grid-cols-3 gap-2">
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={`rounded-lg border px-3 py-2 text-left transition-colors
                        ${value === o.id
                          ? 'border-ghost-500 bg-ghost-600/15'
                          : 'border-slate-700 bg-slate-800/60 hover:bg-slate-800'}`}
          >
            <div className={`text-xs font-semibold ${value === o.id ? 'text-white' : 'text-slate-200'}`}>
              {o.label}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">{o.desc}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
