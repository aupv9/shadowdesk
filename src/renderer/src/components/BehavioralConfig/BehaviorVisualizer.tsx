import React, { useEffect, useRef } from 'react'
import type { BehaviorConfig } from '../../types'

/**
 * Phase 17 — Live behavioral preview
 *
 * Draws three small SVG traces that update in real time as the user tweaks
 * the sliders in BehavioralConfig:
 *   1. Mouse jitter — a sine-like path with Gaussian noise on Y
 *   2. Typing cadence — a tick timeline of inter-keystroke delays
 *   3. Scroll inertia — a decaying-magnitude bar plot
 *
 * The randomness is seeded (mulberry32) so the trace is stable across
 * re-renders until the user changes a slider. This mirrors how the
 * injected scripts use the profile canvas seed.
 */

interface Props {
  behavior: BehaviorConfig
  seed: number
}

// Lightweight seeded PRNG (mulberry32) — shared with injected scripts
function mkRng(s: number) {
  let state = s >>> 0
  return function rng() {
    state |= 0
    state = (state + 0x6D2B79F5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function gauss(rng: () => number, sigma: number): number {
  const u = 1 - rng()
  const v = rng()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * sigma
}

export function BehaviorVisualizer({ behavior, seed }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <VisCard title="Mouse path">
        <MousePathSvg
          enabled={behavior.mouseJitter}
          sigma={behavior.mouseJitterSigma ?? 0.4}
          seed={seed ^ 0xDEAD}
        />
      </VisCard>
      <VisCard title="Typing cadence">
        <TypingCadenceSvg
          enabled={behavior.typingNoise}
          wpm={behavior.typingWpm ?? 75}
          variancePct={behavior.typingVariancePct ?? 20}
          seed={seed ^ 0xBEEF}
        />
      </VisCard>
      <VisCard title="Scroll inertia">
        <ScrollInertiaSvg
          enabled={behavior.scrollInertia}
          decay={behavior.scrollDecay ?? 0.88}
          noisePx={behavior.scrollNoisePx ?? 2}
          seed={seed ^ 0xFACE}
        />
      </VisCard>
    </div>
  )
}

function VisCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2.5">
      <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-2">{title}</p>
      {children}
    </div>
  )
}

// ── Mouse path (sinusoid + jitter) ──────────────────────────────────────────
function MousePathSvg({ enabled, sigma, seed }: { enabled: boolean; sigma: number; seed: number }) {
  const width = 260
  const height = 70
  const rng = mkRng(seed)
  const points: string[] = []
  const SAMPLES = 70
  for (let i = 0; i < SAMPLES; i++) {
    const x = (i / (SAMPLES - 1)) * width
    // Base path is a gentle sine curve
    const baseY = height / 2 + Math.sin((i / SAMPLES) * Math.PI * 3) * 14
    // Jitter on Y (amplified for visibility vs. real sub-pixel)
    const jitter = enabled ? gauss(rng, sigma * 7) : 0
    points.push(`${x.toFixed(1)},${(baseY + jitter).toFixed(1)}`)
  }
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[70px]">
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={enabled ? '#a78bfa' : '#475569'}
        strokeWidth={1.2}
        strokeLinecap="round"
      />
      {/* End-point dot */}
      <circle
        cx={width - 2}
        cy={parseFloat(points[points.length - 1].split(',')[1])}
        r={2.5}
        fill={enabled ? '#c4b5fd' : '#64748b'}
      />
    </svg>
  )
}

// ── Typing cadence timeline ─────────────────────────────────────────────────
function TypingCadenceSvg({
  enabled, wpm, variancePct, seed,
}: {
  enabled: boolean
  wpm: number
  variancePct: number
  seed: number
}) {
  const width = 260
  const height = 70
  const rng = mkRng(seed)
  const keys = 16
  const baseMs = (60 * 1000) / (wpm * 5)   // ms per keystroke
  const sigma = enabled ? baseMs * (variancePct / 100) : 0

  // Generate inter-key delays
  const delays: number[] = []
  let total = 0
  for (let i = 0; i < keys; i++) {
    const d = Math.max(20, baseMs + gauss(rng, sigma))
    delays.push(d)
    total += d
  }
  // Normalise to fit width
  const scale = (width - 10) / total
  let cursor = 5

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[70px]">
      {/* Baseline */}
      <line x1="5" y1={height / 2} x2={width - 5} y2={height / 2} stroke="#334155" strokeWidth="1" strokeDasharray="2,2" />
      {delays.map((d, i) => {
        const x = cursor + d * scale * 0.5
        cursor += d * scale
        // Tick height encodes the delay — slower keys = taller tick
        const tickH = Math.min(26, Math.max(8, (d / baseMs) * 14))
        return (
          <line
            key={i}
            x1={x}
            y1={height / 2 - tickH / 2}
            x2={x}
            y2={height / 2 + tickH / 2}
            stroke={enabled ? '#22d3ee' : '#475569'}
            strokeWidth="2"
            strokeLinecap="round"
          />
        )
      })}
      <text x={width - 5} y={12} textAnchor="end" className="fill-slate-500" fontSize="9">
        ~{baseMs.toFixed(0)} ms/key
      </text>
    </svg>
  )
}

// ── Scroll inertia decay ────────────────────────────────────────────────────
function ScrollInertiaSvg({
  enabled, decay, noisePx, seed,
}: {
  enabled: boolean
  decay: number
  noisePx: number
  seed: number
}) {
  const width = 260
  const height = 70
  const rng = mkRng(seed)
  const samples = 30
  const bars: Array<{ x: number; h: number }> = []
  let delta = 28 // initial wheel delta (visual units)
  const bw = (width - 10) / samples
  for (let i = 0; i < samples; i++) {
    const noise = enabled ? gauss(rng, noisePx) : 0
    const h = Math.max(0.5, Math.abs(delta) + noise)
    bars.push({ x: 5 + i * bw, h })
    delta = enabled ? delta * decay : delta // no decay when disabled = constant bars
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[70px]">
      {bars.map((b, i) => (
        <rect
          key={i}
          x={b.x}
          y={height - b.h - 4}
          width={Math.max(1.5, bw - 1.5)}
          height={b.h}
          fill={enabled ? '#f472b6' : '#475569'}
          opacity={0.85}
          rx={0.5}
        />
      ))}
      <text x={width - 5} y={12} textAnchor="end" className="fill-slate-500" fontSize="9">
        decay {decay.toFixed(2)}
      </text>
    </svg>
  )
}
