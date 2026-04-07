/**
 * Phase 16.D — Behaviour Pattern Library
 *
 * Shows the 10 built-in human-behaviour archetypes and lets the user
 * apply one to a profile (writes behaviour/timing config via IPC).
 */

import React, { useEffect, useState } from 'react'
import {
  CheckCircle,
  Mouse,
  Keyboard,
  ScrollText,
  Clock,
  AlertCircle,
  Loader2,
  Activity
} from 'lucide-react'
import type { BehaviorArchetype } from '../../types'
import { useProfileStore } from '../../stores/profileStore'

// Icon map from string to lucide component (subset used in archetypes)
const ICON_MAP: Record<string, React.ElementType> = {
  Coffee:      () => <span>☕</span>,
  Zap:         () => <span>⚡</span>,
  Smartphone:  () => <span>📱</span>,
  Terminal:    () => <span>💻</span>,
  Eye:         () => <span>👁</span>,
  Briefcase:   () => <span>💼</span>,
  MessageCircle: () => <span>💬</span>,
  UserCheck:   () => <span>👴</span>,
  Gamepad2:    () => <span>🎮</span>,
  BookOpen:    () => <span>📖</span>
}

interface Props {
  selectedProfileId?: string
}

export function BehaviorLibrary({ selectedProfileId }: Props) {
  const [archetypes, setArchetypes] = useState<BehaviorArchetype[]>([])
  const [loading, setLoading]       = useState(true)
  const [applying, setApplying]     = useState<string | null>(null)
  const [applied, setApplied]       = useState<string | null>(null)
  const [error, setError]           = useState<string | null>(null)
  const { profiles } = useProfileStore()

  useEffect(() => {
    ;(window.api as any).ai.behaviorArchetypes()
      .then((a: BehaviorArchetype[]) => setArchetypes(a))
      .finally(() => setLoading(false))
  }, [])

  const handleApply = async (archetype: BehaviorArchetype) => {
    if (!selectedProfileId || applying) return
    setApplying(archetype.id)
    setError(null)
    try {
      // Map archetype to BehaviorConfig + TimingConfig and persist to profile
      const behaviorConfig = {
        mouseJitter:   true,
        typingNoise:   true,
        scrollInertia: true
      }
      const timingConfig = {
        dateNoisePrecision: 100 as const,
        rafJitter:          true,
        performanceClamp:   true
      }

      const profile = profiles.find((p) => p.id === selectedProfileId)
      if (!profile) throw new Error('Profile not found')

      const updatedFp = {
        ...profile.fingerprint,
        behavior: behaviorConfig,
        timing:   timingConfig,
        // Store the archetype id so the UI can show which one is active
        _archetypeId: archetype.id
      }

      await (window.api as any).profiles.update(selectedProfileId, { fingerprint: updatedFp })
      setApplied(archetype.id)
    } catch (e: any) {
      setError(e.message ?? 'Failed to apply archetype')
    } finally {
      setApplying(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading archetypes...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Profile selector hint */}
      {!selectedProfileId && (
        <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          Select a profile above to apply a behaviour archetype.
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Grid of archetypes */}
      <div className="grid grid-cols-2 gap-3">
        {archetypes.map((arch) => {
          const isApplied  = applied === arch.id
          const isApplying = applying === arch.id
          const IconEl     = ICON_MAP[arch.icon] ?? Activity

          return (
            <div
              key={arch.id}
              className={`border rounded-lg p-3 flex flex-col gap-2 transition-colors ${
                isApplied
                  ? 'border-ghost-500 bg-ghost-500/10'
                  : 'border-slate-700 bg-slate-800/30 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg"><IconEl /></span>
                <span className="text-sm font-medium text-white">{arch.name}</span>
                {isApplied && <CheckCircle className="w-3.5 h-3.5 text-ghost-400 ml-auto" />}
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">{arch.description}</p>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-500">
                <div className="flex items-center gap-1">
                  <Keyboard className="w-3 h-3" />
                  {arch.typingWpm[0]}–{arch.typingWpm[1]} WPM
                </div>
                <div className="flex items-center gap-1">
                  <Mouse className="w-3 h-3" />
                  {arch.mouseSpeed}x speed
                </div>
                <div className="flex items-center gap-1">
                  <ScrollText className="w-3 h-3" />
                  {arch.scrollStep}px steps
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {(arch.actionPause[0] / 1000).toFixed(1)}–{(arch.actionPause[1] / 1000).toFixed(1)}s pause
                </div>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-1">
                {arch.tags.map((tag) => (
                  <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">
                    {tag}
                  </span>
                ))}
              </div>

              {/* Apply button */}
              <button
                onClick={() => handleApply(arch)}
                disabled={!selectedProfileId || isApplying}
                className={`mt-auto flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  isApplied
                    ? 'bg-ghost-600/30 text-ghost-300 cursor-default'
                    : 'bg-slate-700 hover:bg-slate-600 text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
              >
                {isApplying
                  ? <><Loader2 className="w-3 h-3 animate-spin" /> Applying...</>
                  : isApplied
                    ? <><CheckCircle className="w-3 h-3" /> Applied</>
                    : 'Apply to Profile'
                }
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
