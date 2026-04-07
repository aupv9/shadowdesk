import type { CollisionGroup, CollisionReport } from '../../shared/types'

/**
 * Phase 12.C.4 — Fingerprint collision detector.
 *
 * Scans a profile pool for two kinds of collisions:
 *
 *  1. **noise-seed** — two or more profiles share the exact same
 *     `(canvas, webgl, audio)` noise-seed tuple. Because seeds are derived
 *     deterministically from profile UUIDs, this should be vanishingly rare
 *     — when it happens, it's almost always a sign that profiles were
 *     cloned via direct DB copy or imported from a leaked bundle. These
 *     profiles will produce identical canvas/audio/webgl fingerprints.
 *
 *  2. **identity-tuple** — two or more profiles share the same
 *     `(userAgent, screen, timezone)` triple. This is much more common
 *     (e.g. anyone who creates 50 profiles from the same preset will hit
 *     this) but still useful to surface so the user can deliberately diversify
 *     screen size or locale across profiles in the same group.
 */

interface ProfileLike {
  id: string
  name: string
  fingerprint: any  // FingerprintConfig but kept loose to handle string-encoded variants
}

function parseFingerprint(fp: any): any {
  if (!fp) return null
  if (typeof fp === 'string') {
    try {
      return JSON.parse(fp)
    } catch {
      return null
    }
  }
  return fp
}

function noiseSeedKey(fp: any): string | null {
  if (!fp?.canvas || !fp?.webgl || !fp?.audio) return null
  return `${fp.canvas.noiseSeed}|${fp.webgl.noiseSeed}|${fp.audio.noiseSeed}`
}

function identityTupleKey(fp: any): string | null {
  if (!fp?.browser || !fp?.screen || !fp?.locale) return null
  return [
    fp.browser.userAgent,
    `${fp.screen.width}x${fp.screen.height}`,
    fp.locale.timezone
  ].join('|')
}

function describeNoiseSeed(fp: any): string {
  return `canvas=${fp.canvas.noiseSeed} webgl=${fp.webgl.noiseSeed} audio=${fp.audio.noiseSeed}`
}

function describeIdentityTuple(fp: any): string {
  // Trim the UA to a useful prefix so the chip doesn't blow up the layout.
  const uaShort = String(fp.browser.userAgent).slice(0, 60) + '…'
  return `${uaShort} · ${fp.screen.width}×${fp.screen.height} · ${fp.locale.timezone}`
}

/**
 * Group profiles by a key function and return only the buckets with >= 2 entries.
 * Each returned group includes the description of the first profile in the bucket
 * (since all bucket members share the signature, any of them works).
 */
function buildGroups(
  profiles: { id: string; name: string; fp: any }[],
  kind: 'noise-seed' | 'identity-tuple',
  keyFn: (fp: any) => string | null,
  describeFn: (fp: any) => string
): CollisionGroup[] {
  const buckets = new Map<string, { id: string; name: string; fp: any }[]>()

  for (const p of profiles) {
    const key = keyFn(p.fp)
    if (key === null) continue
    const list = buckets.get(key)
    if (list) list.push(p)
    else buckets.set(key, [p])
  }

  const groups: CollisionGroup[] = []
  for (const [key, members] of buckets) {
    if (members.length < 2) continue
    groups.push({
      id: `${kind}:${key}`,
      kind,
      signature: describeFn(members[0].fp),
      profiles: members.map((m) => ({ id: m.id, name: m.name }))
    })
  }

  // Largest collision groups first — they need attention soonest.
  groups.sort((a, b) => b.profiles.length - a.profiles.length)
  return groups
}

export function detectCollisions(profiles: ProfileLike[]): CollisionReport {
  const parsed = profiles
    .map((p) => ({ id: p.id, name: p.name, fp: parseFingerprint(p.fingerprint) }))
    .filter((p) => p.fp !== null)

  const noiseGroups = buildGroups(parsed, 'noise-seed', noiseSeedKey, describeNoiseSeed)
  const identityGroups = buildGroups(parsed, 'identity-tuple', identityTupleKey, describeIdentityTuple)

  return {
    scannedAt: new Date().toISOString(),
    totalProfiles: parsed.length,
    // Noise-seed collisions are critical — list them first.
    groups: [...noiseGroups, ...identityGroups]
  }
}
