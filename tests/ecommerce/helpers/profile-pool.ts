/**
 * Profile Pool — simulates the "Bulk Account Management" feature from the
 * E-Commerce Operations pillar. A pool holds N fake browser profiles, each
 * with its own identity (username/password/proxy tag), and exposes three
 * rotation strategies that mirror the production Profile.rotation_mode:
 *
 *   - 'round-robin'  — deterministic ordering, wraps around
 *   - 'random'       — uniform random pick
 *   - 'least-used'   — picks the profile with the lowest run count
 *
 * The pool also tracks session state so tests can assert that:
 *   a) each profile's cookie jar is isolated
 *   b) rate-limited profiles are temporarily taken out of rotation
 *   c) concurrency caps are respected
 *
 * This is test-only plumbing — the real BrowserManager handles actual
 * Chromium processes. Here we only simulate the rotation bookkeeping so we
 * can validate the policy without booting a real browser.
 */

export type RotationMode = 'round-robin' | 'random' | 'least-used'

export interface FakeProfile {
  id: string
  name: string
  username: string
  password: string
  proxyTag: string
  cookieJar: Map<string, string>
  runCount: number
  lastUsedAt: number
  cooldownUntil: number
  disabled: boolean
}

export interface ProfilePoolOptions {
  rotation: RotationMode
  /** Seed for deterministic random rotation. Default: hash of ids. */
  rngSeed?: number
  /** Max profiles that can be "in flight" at the same time. Default: unlimited. */
  maxConcurrent?: number
  /** How long (ms) to cool down a profile after a 429. Default: 30s. */
  cooldownMs?: number
}

function seededRng(seed: number): () => number {
  let state = seed || 42
  return () => {
    state = (state * 1664525 + 1013904223) % 0x100000000
    return state / 0x100000000
  }
}

export class ProfilePool {
  private readonly profiles: FakeProfile[]
  private cursor = 0
  private rng: () => number
  private inFlight = 0
  peakConcurrency = 0

  constructor(
    profiles: Omit<FakeProfile, 'cookieJar' | 'runCount' | 'lastUsedAt' | 'cooldownUntil' | 'disabled'>[],
    private readonly opts: ProfilePoolOptions
  ) {
    this.profiles = profiles.map((p) => ({
      ...p,
      cookieJar: new Map(),
      runCount: 0,
      lastUsedAt: 0,
      cooldownUntil: 0,
      disabled: false
    }))
    this.rng = seededRng(opts.rngSeed ?? profiles.length * 17 + 7)
  }

  get size(): number { return this.profiles.length }
  get active(): number { return this.profiles.filter((p) => !p.disabled).length }

  /** Return all profiles (for assertions). */
  snapshot(): ReadonlyArray<FakeProfile> { return this.profiles }

  /** Pick the next profile according to the rotation policy. Null when none available. */
  next(now = Date.now()): FakeProfile | null {
    const candidates = this.profiles.filter(
      (p) => !p.disabled && p.cooldownUntil <= now
    )
    if (candidates.length === 0) return null

    let picked: FakeProfile
    switch (this.opts.rotation) {
      case 'round-robin': {
        // Walk through candidates starting from cursor
        for (let i = 0; i < this.profiles.length; i++) {
          const idx = (this.cursor + i) % this.profiles.length
          const p = this.profiles[idx]
          if (!p.disabled && p.cooldownUntil <= now) {
            picked = p
            this.cursor = (idx + 1) % this.profiles.length
            return this.checkout(picked, now)
          }
        }
        return null
      }
      case 'random': {
        const idx = Math.floor(this.rng() * candidates.length)
        picked = candidates[idx]
        return this.checkout(picked, now)
      }
      case 'least-used': {
        picked = candidates.reduce((a, b) => (a.runCount <= b.runCount ? a : b))
        return this.checkout(picked, now)
      }
    }
  }

  private checkout(profile: FakeProfile, now: number): FakeProfile {
    profile.runCount++
    profile.lastUsedAt = now
    this.inFlight++
    if (this.inFlight > this.peakConcurrency) this.peakConcurrency = this.inFlight
    return profile
  }

  /** Record a successful session for the profile. */
  recordSuccess(profile: FakeProfile, sessionCookie: string | null): void {
    if (sessionCookie) profile.cookieJar.set('session', sessionCookie)
    this.inFlight = Math.max(0, this.inFlight - 1)
  }

  /** Mark a profile rate-limited — cools it down so the next `.next()` skips it. */
  recordRateLimit(profile: FakeProfile, now = Date.now()): void {
    profile.cooldownUntil = now + (this.opts.cooldownMs ?? 30_000)
    this.inFlight = Math.max(0, this.inFlight - 1)
  }

  /** Mark a profile as permanently disabled (e.g. after repeated failures). */
  disable(profile: FakeProfile, _reason: string): void {
    profile.disabled = true
    this.inFlight = Math.max(0, this.inFlight - 1)
  }

  /** Release a profile without state changes (e.g. after a failed extraction). */
  release(_profile: FakeProfile): void {
    this.inFlight = Math.max(0, this.inFlight - 1)
  }

  /** Assert concurrency cap — returns true if we're below the cap. */
  canAcceptMore(): boolean {
    if (!this.opts.maxConcurrent) return true
    return this.inFlight < this.opts.maxConcurrent
  }
}

/** Factory — builds a pool of N fake profiles with sequential credentials. */
export function makeProfilePool(
  size: number,
  rotation: RotationMode,
  opts: Omit<ProfilePoolOptions, 'rotation'> = {}
): ProfilePool {
  const profiles = Array.from({ length: size }, (_, i) => ({
    id: `profile-${i.toString().padStart(3, '0')}`,
    name: `Test Profile ${i}`,
    username: `user${i.toString().padStart(3, '0')}@test.local`,
    password: `SeaPass${i}!`,
    proxyTag: `proxy-${['VN', 'TH', 'ID', 'MY', 'PH', 'SG'][i % 6]}`
  }))
  return new ProfilePool(profiles, { rotation, ...opts })
}
