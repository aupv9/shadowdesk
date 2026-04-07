import { BrowserManager } from './browser-manager'
import { Database } from './database'

/**
 * Phase 11.2 — Profile warm-up.
 *
 * "Cold" profiles look suspicious — no cookies, no history, no third-party
 * trackers. The warm-up flow visits a curated list of common sites in
 * sequence so the profile accumulates the kind of organic state real
 * browsers carry: Google session cookies, YouTube prefs, Wikipedia ETags,
 * social-network tracking pixels, etc.
 *
 * The flow is intentionally minimal: it does not perform any account
 * logins or fill any forms — only navigation. The profile must already
 * be launched.
 */

export const DEFAULT_WARMUP_SITES = [
  'https://www.google.com',
  'https://www.youtube.com',
  'https://en.wikipedia.org/wiki/Main_Page',
  'https://www.bing.com',
  'https://www.reddit.com',
  'https://www.amazon.com',
  'https://news.ycombinator.com'
]

export interface WarmUpResult {
  visited: { url: string; success: boolean; ms: number; error?: string }[]
  durationMs: number
}

export async function runWarmUp(profileId: string, sites?: string[]): Promise<WarmUpResult> {
  const bm = BrowserManager.getInstance()
  if (!bm.isRunning(profileId)) {
    throw new Error('Profile must be launched before warm-up.')
  }
  const page = await bm.getActivePage(profileId)
  if (!page) throw new Error('No active page for profile.')

  const list = sites && sites.length > 0 ? sites : DEFAULT_WARMUP_SITES
  const visited: WarmUpResult['visited'] = []
  const start = Date.now()

  for (const url of list) {
    const t0 = Date.now()
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
      // Mimic dwell time: 2-5s per site
      const dwell = 2000 + Math.floor(Math.random() * 3000)
      await new Promise((r) => setTimeout(r, dwell))
      visited.push({ url, success: true, ms: Date.now() - t0 })
    } catch (err: any) {
      visited.push({ url, success: false, ms: Date.now() - t0, error: err.message })
    }
  }

  // Mark profile as warmed up if at least 50% of sites loaded successfully.
  const successes = visited.filter((v) => v.success).length
  if (successes >= Math.ceil(list.length / 2)) {
    Database.getInstance().setProfileWarmedUp(profileId, true)
  }

  return { visited, durationMs: Date.now() - start }
}
