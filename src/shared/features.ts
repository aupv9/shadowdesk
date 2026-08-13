/**
 * Build-time feature gate for the v1.0 desktop-only release.
 *
 * Two backends sit behind parts of this app and neither is deployed yet:
 *
 *   1. `server/` in this repo — auth, licensing, team, cloud sync.
 *   2. The external "Common SaaS API" — analytics, billing, support,
 *      cloud profiles, remote config. No implementation exists in this repo.
 *
 * Shipping those sections against a dead endpoint means a user's first click
 * is a connection error, so v1.0 compiles them out of the navigation and
 * never starts their background daemons. Everything that runs locally —
 * profiles, fingerprints, proxies, automation, detection testing, the vault —
 * is unaffected.
 *
 * Flip DESKTOP_ONLY to false to restore the full cloud build once the
 * backends are live; nothing else needs to change.
 */
export const DESKTOP_ONLY = true

/**
 * Sections that require a reachable backend. Hidden while DESKTOP_ONLY.
 *
 * - team / account: `server/` (auth + licensing + sync)
 * - analytics / billing / support: Common SaaS API
 */
export const CLOUD_SECTIONS = ['team', 'account', 'analytics', 'billing', 'support'] as const

/**
 * Sections that require hardware or tooling we cannot assume a user has.
 *
 * `mobile-devices` drives real handsets over `adb` and Appium/WebDriverAgent;
 * the iOS half is still a skeleton. Note this does NOT cover mobile
 * *workflows*, which run against Chromium mobile emulation and ship in v1.0.
 */
export const HARDWARE_SECTIONS = ['mobile-devices'] as const

/**
 * The Community Presets panel renders a catalog and a Download button, waits
 * 700ms, then reports success — it never calls into the main process and
 * applies nothing. A control that fakes success is worse than a missing one,
 * so it stays hidden until it is actually wired up. This is not tied to
 * DESKTOP_ONLY: the panel is broken in the cloud build too.
 */
export const COMMUNITY_PRESETS_ENABLED = false

const GATED: ReadonlySet<string> = new Set<string>([
  ...(DESKTOP_ONLY ? CLOUD_SECTIONS : []),
  ...(DESKTOP_ONLY ? HARDWARE_SECTIONS : [])
])

/** True when a nav section should be reachable in this build. */
export function isSectionEnabled(section: string): boolean {
  return !GATED.has(section)
}
