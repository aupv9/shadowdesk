/**
 * Smart Warm-Up Engine — 7-day organic ramp UI
 *
 * Per-profile dashboard that lets the user:
 *   • Create a 7-day warm-up plan with a target SEA region + platforms
 *   • Optionally backdate the profile's `created_at` to spoof account age
 *   • Run the next daily session on demand (profile must be launched)
 *   • Pause / resume / cancel the plan
 *   • Inspect synthesized interactions for every completed session
 *
 * The plan advances one day at a time, spaced 24 h apart by default.
 * A background scheduler (src/main/smart-warmup.ts) auto-runs due sessions
 * for any profile that happens to be launched — so if the user keeps a
 * profile open for a week, the plan will drive itself to completion.
 */

import React, { useEffect, useMemo, useState } from 'react'
import {
  Sparkles,
  Clock,
  PlayCircle,
  PauseCircle,
  XCircle,
  CheckCircle2,
  Loader2,
  Calendar,
  MapPin,
  MousePointer2,
  Eye,
  AlertTriangle,
  RotateCw,
  ChevronRight,
  ChevronDown,
  Rocket
} from 'lucide-react'
import type {
  Profile,
  SeaPlatform,
  WarmUpPlan,
  WarmUpPlanProgress,
  WarmUpRegion,
  WarmUpSession,
  WarmUpStage
} from '../../types'

const REGION_OPTIONS: { value: WarmUpRegion; label: string; flag: string }[] = [
  { value: 'global', label: 'Global', flag: '🌐' },
  { value: 'VN', label: 'Vietnam', flag: '🇻🇳' },
  { value: 'TH', label: 'Thailand', flag: '🇹🇭' },
  { value: 'ID', label: 'Indonesia', flag: '🇮🇩' },
  { value: 'MY', label: 'Malaysia', flag: '🇲🇾' },
  { value: 'PH', label: 'Philippines', flag: '🇵🇭' },
  { value: 'SG', label: 'Singapore', flag: '🇸🇬' }
]

const STAGE_META: Record<WarmUpStage, { label: string; color: string; description: string }> = {
  benign: {
    label: 'Benign Browsing',
    color: 'bg-slate-600/30 text-slate-300 border-slate-600',
    description: 'Neutral search engines, news, Wikipedia — accumulates baseline cookies + ETags.'
  },
  interests: {
    label: 'Topical Interest',
    color: 'bg-blue-600/20 text-blue-300 border-blue-600',
    description: 'Region-specific topical content — YouTube, Reddit, regional news + entertainment.'
  },
  'platform-adjacent': {
    label: 'Platform Adjacent',
    color: 'bg-amber-600/20 text-amber-300 border-amber-600',
    description: 'Navigate the target SEA platform landing pages without logging in.'
  },
  'platform-active': {
    label: 'Platform Active',
    color: 'bg-orange-600/20 text-orange-300 border-orange-600',
    description: 'Deeper navigation — search, scroll, product views, category clicks.'
  },
  ready: {
    label: 'Ready',
    color: 'bg-emerald-600/20 text-emerald-300 border-emerald-600',
    description: 'Final dry-run that mirrors the shape of the real automation flow.'
  }
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-slate-700 text-slate-300' },
  running: { label: 'Running', color: 'bg-blue-500/20 text-blue-400' },
  completed: { label: 'Completed', color: 'bg-emerald-500/20 text-emerald-400' },
  paused: { label: 'Paused', color: 'bg-amber-500/20 text-amber-400' },
  failed: { label: 'Failed', color: 'bg-red-500/20 text-red-400' },
  cancelled: { label: 'Cancelled', color: 'bg-slate-700 text-slate-400' }
}

type Blueprint = { day: number; stage: WarmUpStage; visits: number }

export function SmartWarmUp() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [seaPlatforms, setSeaPlatforms] = useState<SeaPlatform[]>([])
  const [blueprint, setBlueprint] = useState<Blueprint[]>([])
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)
  const [progress, setProgress] = useState<WarmUpPlanProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [expandedSession, setExpandedSession] = useState<string | null>(null)

  // Create-plan form state
  const [region, setRegion] = useState<WarmUpRegion>('global')
  const [targetPlatforms, setTargetPlatforms] = useState<string[]>([])
  const [fakeAgeDays, setFakeAgeDays] = useState<number>(30)
  const [applyFakeAge, setApplyFakeAge] = useState<boolean>(true)

  useEffect(() => {
    (async () => {
      try {
        setLoading(true)
        const [profs, platforms, bp] = await Promise.all([
          window.api.profiles.list(),
          window.api.seaPlatforms.list(),
          (window.api as any).smartWarmup.blueprint()
        ])
        setProfiles(profs)
        setSeaPlatforms(platforms)
        setBlueprint(bp)
        if (profs.length > 0 && !selectedProfileId) {
          setSelectedProfileId(profs[0].id)
        }
      } catch (e: any) {
        setErr(e?.message ?? String(e))
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  // Refresh progress whenever the selected profile changes.
  useEffect(() => {
    if (!selectedProfileId) {
      setProgress(null)
      return
    }
    refreshProgress(selectedProfileId)
  }, [selectedProfileId])

  const refreshProgress = async (profileId: string) => {
    try {
      const p = await (window.api as any).smartWarmup.get(profileId)
      setProgress(p)
    } catch (e: any) {
      setErr(e?.message ?? String(e))
    }
  }

  const togglePlatform = (id: string) => {
    setTargetPlatforms((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const handleCreatePlan = async () => {
    if (!selectedProfileId) return
    try {
      setBusy('create')
      setErr(null)
      await (window.api as any).smartWarmup.create({
        profile_id: selectedProfileId,
        region,
        target_platforms: targetPlatforms,
        total_days: 7,
        fake_account_age_days: fakeAgeDays,
        apply_fake_age_now: applyFakeAge
      })
      setMsg('Warm-up plan created.')
      await refreshProgress(selectedProfileId)
    } catch (e: any) {
      setErr(e?.message ?? String(e))
    } finally {
      setBusy(null)
      setTimeout(() => setMsg(null), 4000)
    }
  }

  const handleRunNext = async () => {
    if (!selectedProfileId) return
    try {
      setBusy('run')
      setErr(null)
      setMsg('Running next session — this may take several minutes…')
      await (window.api as any).smartWarmup.runNext(selectedProfileId)
      setMsg('Session complete.')
      await refreshProgress(selectedProfileId)
    } catch (e: any) {
      setErr(e?.message ?? String(e))
      setMsg(null)
    } finally {
      setBusy(null)
      setTimeout(() => setMsg(null), 4000)
    }
  }

  const handlePause = async () => {
    if (!selectedProfileId) return
    await (window.api as any).smartWarmup.pause(selectedProfileId)
    await refreshProgress(selectedProfileId)
  }
  const handleResume = async () => {
    if (!selectedProfileId) return
    await (window.api as any).smartWarmup.resume(selectedProfileId)
    await refreshProgress(selectedProfileId)
  }
  const handleCancel = async () => {
    if (!selectedProfileId) return
    if (!confirm('Cancel this warm-up plan? Completed sessions will remain but no further days will run.')) return
    await (window.api as any).smartWarmup.cancel(selectedProfileId)
    await refreshProgress(selectedProfileId)
  }
  const handleApplyFakeAge = async () => {
    if (!selectedProfileId) return
    try {
      setBusy('age')
      setErr(null)
      await (window.api as any).smartWarmup.applyFakeAge(selectedProfileId, fakeAgeDays)
      setMsg(`Profile created_at backdated by ${fakeAgeDays} days.`)
      const refreshed = await window.api.profiles.list()
      setProfiles(refreshed)
    } catch (e: any) {
      setErr(e?.message ?? String(e))
    } finally {
      setBusy(null)
      setTimeout(() => setMsg(null), 4000)
    }
  }

  const selectedProfile = useMemo(
    () => profiles.find((p) => p.id === selectedProfileId) ?? null,
    [profiles, selectedProfileId]
  )

  const plan = progress?.plan ?? null
  const sessions = progress?.sessions ?? []
  const progressPct = plan
    ? Math.round((plan.current_day / plan.total_days) * 100)
    : 0

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-ghost-600/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-ghost-400" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-white">Smart Warm-Up Engine</h1>
              <p className="text-sm text-slate-400">
                7-day organic ramp — benign browsing → platform behaviour → ready for automation.
              </p>
            </div>
          </div>
        </div>

        {/* Toast strip */}
        {(err || msg) && (
          <div
            className={`mb-4 px-4 py-3 rounded-lg text-sm flex items-start gap-2 ${
              err
                ? 'bg-red-500/10 text-red-300 border border-red-500/30'
                : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
            }`}
          >
            {err ? <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> : <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />}
            <span>{err ?? msg}</span>
          </div>
        )}

        {/* Blueprint card */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-medium text-slate-300">7-Day Plan Blueprint</h2>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {blueprint.map((b) => {
              const meta = STAGE_META[b.stage]
              return (
                <div key={b.day} className={`rounded-lg border p-3 ${meta.color}`}>
                  <div className="text-xs font-semibold">Day {b.day}</div>
                  <div className="text-[11px] mt-1 font-medium">{meta.label}</div>
                  <div className="text-[10px] opacity-70 mt-1">{b.visits} visits</div>
                </div>
              )
            })}
          </div>
          <p className="text-xs text-slate-500 mt-3">
            Each day the engine synthesizes navigation, mouse jitter, scrolling, hovers, and dwell time on the
            stage-appropriate URL set. Sessions are spaced 24 h apart by default.
          </p>
        </div>

        {/* Main two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
          {/* Profile picker */}
          <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 h-fit">
            <div className="text-xs font-medium text-slate-400 uppercase mb-2">Profiles</div>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
              </div>
            ) : profiles.length === 0 ? (
              <div className="text-sm text-slate-500 py-4">No profiles yet.</div>
            ) : (
              <div className="space-y-1 max-h-[600px] overflow-y-auto">
                {profiles.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProfileId(p.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      selectedProfileId === p.id
                        ? 'bg-ghost-600/20 text-ghost-300 border border-ghost-600/40'
                        : 'text-slate-300 hover:bg-slate-700/50 border border-transparent'
                    }`}
                  >
                    <div className="font-medium truncate">{p.name}</div>
                    <div className="text-[10px] text-slate-500 truncate">
                      Created {new Date(p.created_at).toLocaleDateString()}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right pane */}
          <div className="space-y-4">
            {!selectedProfile ? (
              <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-8 text-center text-slate-500">
                Select a profile to manage its warm-up plan.
              </div>
            ) : !plan ? (
              /* No plan yet — show create form */
              <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
                <h2 className="text-base font-medium text-white mb-1">Create a 7-Day Warm-Up Plan</h2>
                <p className="text-sm text-slate-400 mb-4">
                  Ramp <span className="text-white">{selectedProfile.name}</span> from cold to automation-ready.
                </p>

                <div className="space-y-4">
                  {/* Region */}
                  <div>
                    <label className="text-xs font-medium text-slate-400 mb-1 block flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> Region
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {REGION_OPTIONS.map((r) => (
                        <button
                          key={r.value}
                          onClick={() => setRegion(r.value)}
                          className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                            region === r.value
                              ? 'bg-ghost-600 text-white'
                              : 'bg-slate-700/60 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {r.flag} {r.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Target platforms */}
                  <div>
                    <label className="text-xs font-medium text-slate-400 mb-1 block">
                      Target Platforms ({targetPlatforms.length} selected)
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {seaPlatforms.map((p) => (
                        <label
                          key={p.id}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer border text-xs ${
                            targetPlatforms.includes(p.id)
                              ? 'bg-ghost-600/20 border-ghost-600/40 text-white'
                              : 'bg-slate-700/40 border-slate-700 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="accent-ghost-500"
                            checked={targetPlatforms.includes(p.id)}
                            onChange={() => togglePlatform(p.id)}
                          />
                          <span>{p.name}</span>
                        </label>
                      ))}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Days 5-7 will navigate these platforms (no login).
                    </p>
                  </div>

                  {/* Fake account age */}
                  <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700">
                    <label className="text-xs font-medium text-slate-300 mb-2 block flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Fake Account Age
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={0}
                        max={365}
                        value={fakeAgeDays}
                        onChange={(e) => setFakeAgeDays(Number(e.target.value))}
                        className="flex-1 accent-ghost-500"
                      />
                      <div className="text-sm font-mono text-white w-20 text-right">
                        {fakeAgeDays} days
                      </div>
                    </div>
                    <label className="flex items-center gap-2 mt-2 text-xs text-slate-400">
                      <input
                        type="checkbox"
                        checked={applyFakeAge}
                        onChange={(e) => setApplyFakeAge(e.target.checked)}
                        className="accent-ghost-500"
                      />
                      Backdate <code className="text-slate-300">created_at</code> when the plan starts
                    </label>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Platforms that fingerprint "first-seen" timestamps will see an older profile.
                    </p>
                  </div>

                  <button
                    onClick={handleCreatePlan}
                    disabled={busy === 'create'}
                    className="w-full px-4 py-2.5 rounded-lg bg-ghost-600 hover:bg-ghost-500 text-white text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {busy === 'create' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Rocket className="w-4 h-4" />
                    )}
                    Create 7-Day Warm-Up Plan
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Plan overview */}
                <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h2 className="text-base font-medium text-white">{selectedProfile.name}</h2>
                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${STATUS_META[plan.status]?.color ?? 'bg-slate-700'}`}>
                          {STATUS_META[plan.status]?.label ?? plan.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400">
                        Day {plan.current_day} / {plan.total_days} · {plan.region.toUpperCase()} ·
                        {plan.target_platforms.length > 0 ? ` ${plan.target_platforms.join(', ')}` : ' no target platforms'}
                      </div>
                      {plan.fake_account_age_days > 0 && (
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Fake account age: {plan.fake_account_age_days} days
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => refreshProgress(selectedProfileId!)}
                        title="Refresh"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700"
                      >
                        <RotateCw className="w-4 h-4" />
                      </button>
                      {plan.status === 'running' || plan.status === 'pending' ? (
                        <button
                          onClick={handlePause}
                          className="p-1.5 rounded-lg text-amber-400 hover:bg-amber-500/10"
                          title="Pause"
                        >
                          <PauseCircle className="w-4 h-4" />
                        </button>
                      ) : plan.status === 'paused' ? (
                        <button
                          onClick={handleResume}
                          className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/10"
                          title="Resume"
                        >
                          <PlayCircle className="w-4 h-4" />
                        </button>
                      ) : null}
                      {plan.status !== 'cancelled' && plan.status !== 'completed' && (
                        <button
                          onClick={handleCancel}
                          className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10"
                          title="Cancel plan"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mb-4">
                    <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-ghost-500 to-emerald-500 transition-all"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-500 mt-1">
                      <span>{progressPct}% complete</span>
                      {plan.next_run_at && (
                        <span>Next run: {new Date(plan.next_run_at).toLocaleString()}</span>
                      )}
                    </div>
                  </div>

                  {/* Day tracker */}
                  <div className="grid grid-cols-7 gap-1.5 mb-4">
                    {blueprint.map((b) => {
                      const done = b.day <= plan.current_day
                      const current = b.day === plan.current_day + 1
                      const meta = STAGE_META[b.stage]
                      return (
                        <div
                          key={b.day}
                          className={`rounded-lg border p-2 text-center ${
                            done
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                              : current
                                ? meta.color
                                : 'bg-slate-900/50 border-slate-700 text-slate-500'
                          }`}
                        >
                          <div className="text-[10px] font-semibold">Day {b.day}</div>
                          {done && <CheckCircle2 className="w-3 h-3 mx-auto mt-0.5" />}
                          {!done && current && <Eye className="w-3 h-3 mx-auto mt-0.5" />}
                        </div>
                      )
                    })}
                  </div>

                  {/* Run next session */}
                  {plan.status !== 'completed' && plan.status !== 'cancelled' && (
                    <button
                      onClick={handleRunNext}
                      disabled={busy === 'run'}
                      className="w-full px-4 py-2.5 rounded-lg bg-ghost-600 hover:bg-ghost-500 text-white text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {busy === 'run' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <PlayCircle className="w-4 h-4" />
                      )}
                      Run Next Session (Day {plan.current_day + 1})
                    </button>
                  )}
                  <p className="text-[11px] text-slate-500 mt-2 text-center">
                    Profile must be launched before running a session. The scheduler will auto-run due sessions
                    every 10 minutes while profiles are open.
                  </p>
                </div>

                {/* Fake account age quick action */}
                <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <h3 className="text-sm font-medium text-slate-300">Spoof Account Age</h3>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={0}
                      max={365}
                      value={fakeAgeDays}
                      onChange={(e) => setFakeAgeDays(Number(e.target.value))}
                      className="w-24 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm"
                    />
                    <span className="text-xs text-slate-400">days backdated</span>
                    <button
                      onClick={handleApplyFakeAge}
                      disabled={busy === 'age'}
                      className="ml-auto px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs disabled:opacity-50"
                    >
                      {busy === 'age' ? 'Applying…' : 'Backdate created_at'}
                    </button>
                  </div>
                </div>

                {/* Session history */}
                <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
                  <h3 className="text-sm font-medium text-white mb-3">
                    Session History ({sessions.length})
                  </h3>
                  {sessions.length === 0 ? (
                    <div className="text-sm text-slate-500 py-4 text-center">
                      No sessions yet — run Day 1 to get started.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {sessions.map((s) => (
                        <SessionRow
                          key={s.id}
                          session={s}
                          expanded={expandedSession === s.id}
                          onToggle={() => setExpandedSession(expandedSession === s.id ? null : s.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Session row ─────────────────────────────────────────────────────────────

interface SessionRowProps {
  session: WarmUpSession
  expanded: boolean
  onToggle: () => void
}

function SessionRow({ session, expanded, onToggle }: SessionRowProps) {
  const meta = STAGE_META[session.stage]
  const duration = Math.round(session.duration_ms / 1000)
  const counts = session.interactions.reduce<Record<string, number>>((acc, e) => {
    acc[e.type] = (acc[e.type] ?? 0) + 1
    return acc
  }, {})
  return (
    <div className="rounded-lg bg-slate-900/50 border border-slate-700">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-800/40 transition-colors rounded-lg"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-slate-500" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-500" />
        )}
        <div className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${meta.color}`}>
          Day {session.day}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-white">{meta.label}</div>
          <div className="text-[11px] text-slate-500 truncate">
            {session.visited.length} urls · {duration}s · {session.interactions.length} interactions
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-[11px] text-slate-400 tabular-nums">
            Score {session.engagement_score}
          </div>
          {session.success ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <XCircle className="w-4 h-4 text-red-400" />
          )}
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-3 pt-1 border-t border-slate-700/50 space-y-2">
          {session.error && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2 py-1">
              {session.error}
            </div>
          )}
          <div>
            <div className="text-[10px] uppercase text-slate-500 font-semibold mb-1">Visited</div>
            <ul className="space-y-0.5 max-h-40 overflow-y-auto">
              {session.visited.map((url, i) => (
                <li key={i} className="text-[11px] text-slate-300 truncate">{url}</li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-[10px] uppercase text-slate-500 font-semibold mb-1 flex items-center gap-1">
              <MousePointer2 className="w-3 h-3" /> Interaction Summary
            </div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(counts).map(([type, n]) => (
                <span
                  key={type}
                  className="px-2 py-0.5 rounded-md bg-slate-800 text-[10px] text-slate-300 border border-slate-700"
                >
                  {type} × {n}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
