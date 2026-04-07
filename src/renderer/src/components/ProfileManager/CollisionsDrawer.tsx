import React, { useEffect, useState } from 'react'
import { X, AlertTriangle, AlertCircle, RefreshCw, ShieldCheck } from 'lucide-react'
import type { CollisionReport, CollisionGroup } from '../../types'

interface CollisionsDrawerProps {
  /** When provided, clicking a profile in the drawer scrolls/highlights it in the list. */
  onPickProfile?: (profileId: string) => void
  onClose: () => void
}

export function CollisionsDrawer({ onPickProfile, onClose }: CollisionsDrawerProps) {
  const [report, setReport] = useState<CollisionReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const scan = async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await window.api.profiles.detectCollisions()
      setReport(r)
    } catch (e: any) {
      setError(e?.message ?? 'Scan failed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    scan()
  }, [])

  const noiseGroups   = (report?.groups ?? []).filter((g) => g.kind === 'noise-seed')
  const tupleGroups   = (report?.groups ?? []).filter((g) => g.kind === 'identity-tuple')
  const totalAffected = (report?.groups ?? []).reduce((acc, g) => acc + g.profiles.length, 0)

  return (
    <div
      className="fixed inset-0 z-40 bg-black/40 flex justify-end"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md h-full bg-slate-900 border-l border-slate-700 shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-white">Fingerprint Collisions</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {report
                ? `${report.totalProfiles} profiles scanned · ${report.groups.length} collision groups`
                : 'Scanning…'}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={scan}
              disabled={loading}
              className="btn-ghost p-2 rounded-lg"
              title="Re-scan"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={onClose} className="btn-ghost p-2 rounded-lg" title="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {error && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-600/15 border border-red-600/30 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {report && report.groups.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ShieldCheck className="w-10 h-10 text-emerald-400 mb-3" />
              <p className="text-sm font-medium text-white">No collisions detected</p>
              <p className="text-xs text-slate-500 mt-1">
                Every profile has a unique fingerprint signature.
              </p>
            </div>
          )}

          {report && report.groups.length > 0 && (
            <div className="text-xs text-slate-500">
              {totalAffected} profile{totalAffected === 1 ? '' : 's'} affected across{' '}
              {report.groups.length} group{report.groups.length === 1 ? '' : 's'}.
            </div>
          )}

          {noiseGroups.length > 0 && (
            <CollisionSection
              title="Noise-seed collisions"
              tone="critical"
              description="Profiles share canvas / WebGL / audio noise seeds — they will produce identical fingerprints. Reroll the duplicates."
              groups={noiseGroups}
              onPickProfile={onPickProfile}
            />
          )}

          {tupleGroups.length > 0 && (
            <CollisionSection
              title="Identity-tuple collisions"
              tone="warning"
              description="Profiles share (User-Agent, screen size, timezone). Common when many profiles use the same preset — diversify if these run against the same site."
              groups={tupleGroups}
              onPickProfile={onPickProfile}
            />
          )}
        </div>
      </div>
    </div>
  )
}

interface SectionProps {
  title: string
  tone: 'critical' | 'warning'
  description: string
  groups: CollisionGroup[]
  onPickProfile?: (profileId: string) => void
}

function CollisionSection({ title, tone, description, groups, onPickProfile }: SectionProps) {
  const toneStyles = tone === 'critical'
    ? { icon: 'text-red-400',    bg: 'bg-red-600/10',    border: 'border-red-600/30',    label: 'text-red-300' }
    : { icon: 'text-amber-400',  bg: 'bg-amber-600/10',  border: 'border-amber-600/30',  label: 'text-amber-300' }

  return (
    <div className={`rounded-lg border ${toneStyles.border} ${toneStyles.bg} p-3`}>
      <div className="flex items-start gap-2 mb-2">
        <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${toneStyles.icon}`} />
        <div className="flex-1">
          <h3 className={`text-sm font-semibold ${toneStyles.label}`}>{title}</h3>
          <p className="text-xs text-slate-400 mt-0.5">{description}</p>
        </div>
      </div>

      <div className="space-y-2 mt-3">
        {groups.map((g) => (
          <div key={g.id} className="rounded-md bg-slate-800/60 border border-slate-700/50 p-2.5">
            <div className="text-xs font-mono text-slate-400 break-all mb-2">{g.signature}</div>
            <div className="flex flex-wrap gap-1.5">
              {g.profiles.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onPickProfile?.(p.id)}
                  className="px-2 py-0.5 rounded text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
                  title={p.id}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
