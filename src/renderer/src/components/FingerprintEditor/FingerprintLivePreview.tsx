/**
 * Phase 13.D — Fingerprint live UA preview + uniqueness score card.
 *
 * Displayed below the profile inspector in FingerprintEditor when a
 * profile is selected. Shows:
 *
 *  1. UA string live preview — highlighted by component (protocol tokens,
 *     OS token, browser token, version).
 *  2. Uniqueness score card — rates how "common" the fingerprint combination
 *     is based on several heuristic factors. A high commonness score is
 *     desirable (blends into the crowd).
 *  3. Copyable UA button.
 */

import React, { useMemo, useState } from 'react'
import { Copy, Check, TrendingUp, AlertTriangle, Info } from 'lucide-react'
import type { FingerprintConfig } from '../../types'

// ── UA syntax highlighter ────────────────────────────────────────────────────

interface UAToken {
  text: string
  type: 'moz' | 'os' | 'engine' | 'browser' | 'version' | 'punctuation' | 'plain'
}

function tokenizeUA(ua: string): UAToken[] {
  const tokens: UAToken[] = []

  // Match standard UA pattern groups
  // Mozilla/5.0 (OS info) AppleWebKit/NNN (KHTML, like Gecko) Chrome/NNN Safari/NNN
  const mozMatch = ua.match(/^(Mozilla\/[\d.]+)/)
  if (!mozMatch) {
    return [{ text: ua, type: 'plain' }]
  }

  let rest = ua
  const push = (text: string, type: UAToken['type']) => {
    if (text) tokens.push({ text, type })
    rest = rest.slice(text.length)
  }

  // Mozilla/5.0
  push(mozMatch[1], 'moz')
  push(' ', 'plain')

  // (OS info)
  const osMatch = rest.match(/^(\([^)]+\))/)
  if (osMatch) {
    push(osMatch[1], 'os')
    push(' ', 'plain')
  }

  // AppleWebKit/NNN
  const wkMatch = rest.match(/^(AppleWebKit\/[\d.]+)/)
  if (wkMatch) {
    push(wkMatch[1], 'engine')
    push(' ', 'plain')
  }

  // (KHTML, like Gecko)
  const khtmlMatch = rest.match(/^(\([^)]+\))/)
  if (khtmlMatch) {
    push(khtmlMatch[1], 'punctuation')
    push(' ', 'plain')
  }

  // Chrome/NNN or Firefox/NNN …
  while (rest.length > 0) {
    const tokenMatch = rest.match(/^(\w[\w.-]*\/[\d.]+)/)
    if (tokenMatch) {
      const [full, token] = tokenMatch
      const [name] = token.split('/')
      const type: UAToken['type'] =
        /chrome|crios/i.test(name) ? 'browser' :
        /safari/i.test(name) ? 'browser' :
        /firefox/i.test(name) ? 'browser' :
        /edg/i.test(name) ? 'browser' :
        /version/i.test(name) ? 'version' :
        'engine'
      push(full, type)
      push(' ', 'plain')
    } else {
      push(rest[0], 'plain')
    }
  }

  return tokens.filter((t) => t.text.trim() !== '')
}

const UA_TOKEN_COLORS: Record<UAToken['type'], string> = {
  moz:        'text-slate-400',
  os:         'text-amber-300',
  engine:     'text-blue-300',
  browser:    'text-emerald-300',
  version:    'text-indigo-300',
  punctuation:'text-slate-500',
  plain:      'text-slate-300',
}

// ── Uniqueness / commonness scoring ─────────────────────────────────────────
//
// Factors (each contributes 0–100 points, weighted):
//  1. OS commonness  — Windows > macOS > Linux > mobile
//  2. Screen resolution commonness — common desktop sizes score higher
//  3. Hardware concurrency — 4/8/16 are very common; 1/2/32+ are rare
//  4. Device memory — 8 GB is most common; 2/4 also good; 1 GB is rare
//  5. Canvas/WebGL noise mode — 'noise' is strongly recommended
//  6. WebRTC mode — 'disabled' prevents IP leak

interface ScoreFactor {
  label: string
  score: number  // 0–100
  weight: number // relative weight
  hint?: string
}

export function computeUniquenessScore(fp: FingerprintConfig): {
  total: number
  rating: 'excellent' | 'good' | 'fair' | 'poor'
  factors: ScoreFactor[]
} {
  const factors: ScoreFactor[] = []

  // 1. OS commonness
  const ua = fp.browser.userAgent.toLowerCase()
  const osScore =
    ua.includes('windows nt 10') ? 100 :
    ua.includes('windows nt') ? 85 :
    ua.includes('macintosh') ? 75 :
    ua.includes('android') ? 70 :
    ua.includes('linux') ? 50 : 40
  factors.push({
    label: 'OS commonness',
    score: osScore,
    weight: 20,
    hint: 'Windows 10 is most common. Rare OS configurations are more identifiable.',
  })

  // 2. Screen resolution
  const { width, height } = fp.screen
  const COMMON_RESOLUTIONS: [number, number, number][] = [
    [1920, 1080, 100], [1366, 768, 95], [2560, 1440, 85],
    [1440, 900,  80],  [1280, 800, 75], [1600, 900, 75],
    [1280, 1024, 70],  [1024, 768, 65],
  ]
  const resMatch = COMMON_RESOLUTIONS.find(([w, h]) => w === width && h === height)
  const resScore = resMatch ? resMatch[2] : 40
  factors.push({
    label: 'Screen resolution',
    score: resScore,
    weight: 15,
    hint: `${width}×${height}. Common resolutions (1920×1080, 1366×768) blend in better.`,
  })

  // 3. Hardware concurrency
  const cores = fp.hardware.hardwareConcurrency
  const coresScore =
    cores === 8  ? 100 :
    cores === 4  ? 95  :
    cores === 16 ? 85  :
    cores === 6  ? 80  :
    cores === 12 ? 70  :
    cores === 2  ? 70  : 50
  factors.push({
    label: 'CPU core count',
    score: coresScore,
    weight: 10,
    hint: `${cores} cores. 4 and 8 are the most common values globally.`,
  })

  // 4. Device memory
  const mem = fp.hardware.deviceMemory
  const memScore =
    mem === 8  ? 100 :
    mem === 4  ? 90  :
    mem === 16 ? 80  :
    mem === 2  ? 65  :
    mem === 32 ? 60  :
    mem === 1  ? 30  : 50
  factors.push({
    label: 'Device memory',
    score: memScore,
    weight: 10,
    hint: `${mem} GB. 8 GB is the most common. 1 GB is suspiciously rare for desktop.`,
  })

  // 5. Canvas mode
  const canvasScore = fp.canvas.mode === 'noise' ? 100 : fp.canvas.mode === 'real' ? 20 : 60
  factors.push({
    label: 'Canvas protection',
    score: canvasScore,
    weight: 20,
    hint: fp.canvas.mode === 'noise'
      ? 'Noise injection is active — canvas fingerprint is unique per profile.'
      : fp.canvas.mode === 'block'
      ? 'Block mode is detectable by some sites. Noise is preferable.'
      : 'Real canvas exposes your actual GPU fingerprint.',
  })

  // 6. WebGL mode
  const webglScore = (fp.webgl.noiseSeed && fp.webgl.noiseSeed > 0) ? 90 : 50
  factors.push({
    label: 'WebGL protection',
    score: webglScore,
    weight: 15,
    hint: 'WebGL vendor/renderer spoofing with noise seeds reduces GPU fingerprint risk.',
  })

  // 7. WebRTC
  const rtcScore = fp.webrtc.mode === 'disabled' ? 100 : fp.webrtc.mode === 'fake' ? 70 : 20
  factors.push({
    label: 'WebRTC leak prevention',
    score: rtcScore,
    weight: 10,
    hint: fp.webrtc.mode === 'disabled'
      ? 'WebRTC is disabled — local IP cannot be leaked.'
      : fp.webrtc.mode === 'real'
      ? 'Real WebRTC exposes your local IP address!'
      : 'WebRTC is active but using a fake IP.',
  })

  const totalWeight = factors.reduce((s, f) => s + f.weight, 0)
  const total = Math.round(
    factors.reduce((s, f) => s + f.score * f.weight, 0) / totalWeight
  )

  const rating =
    total >= 85 ? 'excellent' :
    total >= 70 ? 'good' :
    total >= 50 ? 'fair' : 'poor'

  return { total, rating, factors }
}

// ── Component ────────────────────────────────────────────────────────────────

interface Props {
  fingerprint: FingerprintConfig
}

export function FingerprintLivePreview({ fingerprint: fp }: Props) {
  const [copied, setCopied] = useState(false)
  const [showFactors, setShowFactors] = useState(false)

  const tokens = useMemo(() => tokenizeUA(fp.browser.userAgent), [fp.browser.userAgent])
  const { total, rating, factors } = useMemo(() => computeUniquenessScore(fp), [fp])

  const handleCopy = () => {
    navigator.clipboard.writeText(fp.browser.userAgent).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }

  const ratingColor =
    rating === 'excellent' ? 'text-emerald-400' :
    rating === 'good'      ? 'text-blue-400' :
    rating === 'fair'      ? 'text-amber-400' : 'text-red-400'

  const ratingBg =
    rating === 'excellent' ? 'bg-emerald-600/15 border-emerald-600/30' :
    rating === 'good'      ? 'bg-blue-600/15 border-blue-600/30' :
    rating === 'fair'      ? 'bg-amber-600/15 border-amber-600/30' :
    'bg-red-600/15 border-red-600/30'

  const progressColor =
    rating === 'excellent' ? '#10b981' :
    rating === 'good'      ? '#3b82f6' :
    rating === 'fair'      ? '#f59e0b' : '#ef4444'

  return (
    <div className="space-y-4">
      {/* ── UA Live Preview ─────────────────────────────────────────────── */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-400" />
            Live User-Agent
          </h4>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-slate-700"
            title="Copy UA string"
          >
            {copied ? (
              <><Check className="w-3.5 h-3.5 text-emerald-400" /> Copied</>
            ) : (
              <><Copy className="w-3.5 h-3.5" /> Copy</>
            )}
          </button>
        </div>

        {/* Highlighted UA string */}
        <div className="bg-slate-950 rounded-lg px-3 py-3 font-mono text-xs leading-relaxed break-all border border-slate-800">
          {tokens.map((t, i) => (
            <span key={i} className={UA_TOKEN_COLORS[t.type]}>
              {t.text}
            </span>
          ))}
          {tokens.length === 0 && (
            <span className="text-slate-500">— no UA string —</span>
          )}
        </div>

        {/* UA component breakdown */}
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Browser',  value: fp.browser.vendor || '—' },
            { label: 'Version',  value: `v${fp.browser.version}` },
            { label: 'Platform', value: fp.browser.platform },
            { label: 'Language', value: fp.locale.language },
          ].map(({ label, value }) => (
            <div key={label} className="bg-slate-800/60 rounded-lg px-2.5 py-2">
              <p className="text-xs text-slate-500 mb-0.5">{label}</p>
              <p className="text-xs text-slate-200 font-medium truncate" title={value}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Uniqueness / Commonness Score ──────────────────────────────── */}
      <div className={`card border ${ratingBg}`}>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-white flex items-center gap-2">
            <TrendingUp className={`w-4 h-4 ${ratingColor}`} />
            Commonness Score
          </h4>
          <button
            onClick={() => setShowFactors((v) => !v)}
            className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1"
          >
            <Info className="w-3.5 h-3.5" />
            {showFactors ? 'Hide factors' : 'Show factors'}
          </button>
        </div>

        {/* Score ring + label */}
        <div className="flex items-center gap-5 mb-3">
          <div className="relative w-16 h-16 flex-shrink-0">
            <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="26" fill="none" stroke="#1e293b" strokeWidth="6" />
              <circle
                cx="32" cy="32" r="26"
                fill="none"
                stroke={progressColor}
                strokeWidth="6"
                strokeDasharray={`${2 * Math.PI * 26}`}
                strokeDashoffset={`${2 * Math.PI * 26 * (1 - total / 100)}`}
                strokeLinecap="round"
              />
            </svg>
            <span className={`absolute inset-0 flex items-center justify-center text-sm font-bold ${ratingColor}`}>
              {total}
            </span>
          </div>
          <div>
            <p className={`text-base font-semibold capitalize ${ratingColor}`}>{rating}</p>
            <p className="text-slate-400 text-xs mt-0.5 max-w-[200px]">
              {rating === 'excellent'
                ? 'This fingerprint blends in well with real browser traffic.'
                : rating === 'good'
                ? 'Good commonness. Minor tweaks could improve it further.'
                : rating === 'fair'
                ? 'Some unusual values detected — consider switching preset.'
                : 'Fingerprint is highly distinctive — recommend changing preset or settings.'}
            </p>
          </div>
        </div>

        {/* Factor breakdown */}
        {showFactors && (
          <div className="space-y-2 mt-1">
            {factors.map((f) => (
              <div key={f.label}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs text-slate-400">{f.label}</span>
                  <span className={`text-xs font-medium ${
                    f.score >= 80 ? 'text-emerald-400' :
                    f.score >= 60 ? 'text-amber-400' : 'text-red-400'
                  }`}>{f.score}/100</span>
                </div>
                <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${f.score}%`,
                      backgroundColor:
                        f.score >= 80 ? '#10b981' :
                        f.score >= 60 ? '#f59e0b' : '#ef4444',
                    }}
                  />
                </div>
                {f.hint && f.score < 70 && (
                  <p className="text-xs text-slate-500 mt-0.5 flex items-start gap-1">
                    <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                    {f.hint}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
