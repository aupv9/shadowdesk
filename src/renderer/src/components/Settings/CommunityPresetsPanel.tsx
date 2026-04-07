/**
 * Phase 15.B — Community Fingerprint Presets
 *
 * Displays a bundled list of community-submitted device presets.
 * Users can view quality scores and download/apply a preset to an existing
 * profile (simulated locally — in production this would call a backend API).
 */

import React, { useState } from 'react'
import { Users, Star, Download, ShieldCheck, Smartphone, Monitor, Loader2 } from 'lucide-react'
import type { CommunityPreset } from '../../types'

// ── Local bundled community presets ──────────────────────────────────────────
const COMMUNITY_PRESETS: CommunityPreset[] = [
  {
    id: 'cp-win11-edge122',
    name: 'Windows 11 Edge 122',
    os: 'Windows 11',
    browser: 'Edge 122',
    submittedBy: 'viet_anon_07',
    qualityScore: 92,
    downloadCount: 830,
    publishedAt: '2026-02-01'
  },
  {
    id: 'cp-mac-sonoma-safari17',
    name: 'macOS Sonoma Safari 17.3',
    os: 'macOS Sonoma',
    browser: 'Safari 17.3',
    submittedBy: 'sea_fp_lab',
    qualityScore: 88,
    downloadCount: 610,
    publishedAt: '2026-01-15'
  },
  {
    id: 'cp-android-xiaomi-chrome',
    name: 'Xiaomi Redmi Note 12 Chrome 121',
    os: 'Android 13 (Xiaomi)',
    browser: 'Chrome 121',
    submittedBy: 'id_mobile_dev',
    qualityScore: 85,
    downloadCount: 1240,
    publishedAt: '2026-01-20'
  },
  {
    id: 'cp-android-samsung-s23',
    name: 'Samsung Galaxy S23 Chrome 120',
    os: 'Android 13 (Samsung S23)',
    browser: 'Chrome 120',
    submittedBy: 'th_browser_tools',
    qualityScore: 90,
    downloadCount: 975,
    publishedAt: '2025-12-10'
  },
  {
    id: 'cp-linux-ubuntu-firefox',
    name: 'Ubuntu 22.04 Firefox 122',
    os: 'Ubuntu 22.04',
    browser: 'Firefox 122',
    submittedBy: 'devops_42',
    qualityScore: 78,
    downloadCount: 320,
    publishedAt: '2026-02-10'
  }
]

function qualityColor(score: number) {
  if (score >= 90) return 'text-emerald-400'
  if (score >= 75) return 'text-amber-400'
  return 'text-red-400'
}

function deviceIcon(os: string) {
  return os.toLowerCase().includes('android') || os.toLowerCase().includes('ios')
    ? <Smartphone className="w-4 h-4 text-slate-400" />
    : <Monitor className="w-4 h-4 text-slate-400" />
}

export function CommunityPresetsPanel() {
  const [downloading, setDownloading] = useState<string | null>(null)
  const [done, setDone] = useState<Set<string>>(new Set())

  const handleDownload = async (id: string) => {
    setDownloading(id)
    // Simulate async download (in production: fetch preset JSON from API)
    await new Promise((r) => setTimeout(r, 700))
    setDownloading(null)
    setDone((prev) => new Set([...prev, id]))
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Users className="w-4 h-4 text-indigo-400" />
          Community Fingerprint Presets
        </h3>
        <span className="text-xs text-slate-500">{COMMUNITY_PRESETS.length} presets</span>
      </div>

      <p className="text-xs text-slate-400 mb-3">
        Anonymized real-device fingerprint snapshots submitted by the community.
        Quality score reflects rarity and detection resistance.
      </p>

      <div className="space-y-2">
        {COMMUNITY_PRESETS.map((p) => (
          <div key={p.id} className="p-3 bg-slate-800/60 rounded-lg flex items-center gap-3">
            {deviceIcon(p.os)}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{p.name}</p>
              <p className="text-xs text-slate-500">{p.os} · {p.browser} · by {p.submittedBy}</p>
            </div>
            <div className="text-right text-xs shrink-0">
              <p className={`font-semibold flex items-center gap-1 justify-end ${qualityColor(p.qualityScore)}`}>
                <ShieldCheck className="w-3 h-3" />{p.qualityScore}
              </p>
              <p className="text-slate-500 flex items-center gap-1">
                <Download className="w-2.5 h-2.5" />{p.downloadCount.toLocaleString()}
              </p>
            </div>
            <button
              onClick={() => handleDownload(p.id)}
              disabled={!!downloading || done.has(p.id)}
              className={`shrink-0 text-xs flex items-center gap-1 px-2.5 py-1.5 rounded-md font-medium transition-colors ${
                done.has(p.id)
                  ? 'bg-emerald-900/40 text-emerald-400 cursor-default'
                  : 'btn-secondary'
              }`}
            >
              {downloading === p.id
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : done.has(p.id)
                  ? 'Saved'
                  : <><Download className="w-3.5 h-3.5" />Get</>}
            </button>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-600 mt-3 text-center">
        Want to contribute? Submit your device fingerprint via Settings → Export Preset.
      </p>
    </div>
  )
}
