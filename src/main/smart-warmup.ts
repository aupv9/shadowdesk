/**
 * Smart Warm-Up Engine
 * ────────────────────
 *
 * Graduates a fresh profile from "cold" to "ready for automation" over a
 * 7-day schedule. Each day runs one warm-up **session** at a distinct
 * stage, synthesizing organic interactions to accumulate believable
 * browser state (cookies, history, ETags, Local Storage, etc.).
 *
 *  Day │ Stage              │ What happens
 *  ────┼────────────────────┼─────────────────────────────────────────────
 *   1  │ benign             │ Neutral browsing — search engines, wiki, news
 *   2  │ benign             │ Same sites, more dwell + scrolling
 *   3  │ interests          │ Topical content — YouTube, Reddit, local news
 *   4  │ interests          │ Light engagement — hovers, category clicks
 *   5  │ platform-adjacent  │ Navigate target SEA platform (no login)
 *   6  │ platform-active    │ Deeper navigation — search, scroll, view PDPs
 *   7  │ ready              │ Final dry-run mirroring real automation flow
 *
 * In addition the engine supports **fake account-age** spoofing: backdating
 * the profile's `created_at` column so platforms that fingerprint "first
 * seen" timestamps see a believable older profile.
 *
 * The engine is designed to be driven either by:
 *   • manual `runNextSession(profileId)` calls from the UI, or
 *   • the SmartWarmUpScheduler tick (polls every 10 minutes and runs any
 *     plan whose next_run_at is due).
 *
 * A "day" is 24h of wall clock between successive sessions by default —
 * this is configurable per-plan via `dayIntervalMs`.
 */

import { v4 as uuidv4 } from 'uuid'
import type { Page } from 'puppeteer-core'
import { BrowserManager } from './browser-manager'
import { Database } from './database'
import { getSeaPlatform } from './sea-platforms'
import type {
  CreateWarmUpPlanInput,
  WarmUpInteraction,
  WarmUpPlan,
  WarmUpPlanProgress,
  WarmUpRegion,
  WarmUpSession,
  WarmUpStage
} from '../shared/types'

// ── Tunables ────────────────────────────────────────────────────────────────

/** Default spacing between successive warm-up sessions (24 h). */
const DEFAULT_DAY_INTERVAL_MS = 24 * 60 * 60 * 1000
/** Per-URL dwell time range (min, max) in ms — deliberately slow/human-like. */
const DWELL_RANGE_MS: Record<WarmUpStage, [number, number]> = {
  benign:             [8_000, 18_000],
  interests:          [12_000, 28_000],
  'platform-adjacent':[15_000, 35_000],
  'platform-active':  [20_000, 45_000],
  ready:              [10_000, 22_000]
}
/** Number of URLs to visit per stage. */
const VISITS_PER_STAGE: Record<WarmUpStage, number> = {
  benign:             4,
  interests:          5,
  'platform-adjacent':4,
  'platform-active':  6,
  ready:              5
}
/** Stage assigned to each day (1-indexed). */
const DAY_STAGE: Record<number, WarmUpStage> = {
  1: 'benign',
  2: 'benign',
  3: 'interests',
  4: 'interests',
  5: 'platform-adjacent',
  6: 'platform-active',
  7: 'ready'
}

// ── Benign / interest URL catalog (global + regional) ──────────────────────
//
// These lists are intentionally *benign* — they are sites that real users
// visit every day. The engine picks a subset per session so two profiles
// never replay the same exact sequence.

const BENIGN_GLOBAL = [
  'https://www.google.com',
  'https://www.bing.com',
  'https://duckduckgo.com',
  'https://en.wikipedia.org/wiki/Main_Page',
  'https://news.ycombinator.com',
  'https://www.reddit.com',
  'https://www.weather.com',
  'https://www.bbc.com/news',
  'https://www.cnn.com',
  'https://github.com/trending'
]

const INTEREST_GLOBAL = [
  'https://www.youtube.com',
  'https://www.reddit.com/r/popular',
  'https://www.pinterest.com',
  'https://www.imdb.com',
  'https://www.goodreads.com',
  'https://medium.com',
  'https://stackoverflow.com/questions'
]

const BENIGN_BY_REGION: Record<WarmUpRegion, string[]> = {
  VN: [
    'https://www.google.com.vn',
    'https://vnexpress.net',
    'https://tuoitre.vn',
    'https://zingnews.vn',
    'https://vi.wikipedia.org/wiki/Trang_Ch%C3%ADnh',
    'https://dantri.com.vn'
  ],
  TH: [
    'https://www.google.co.th',
    'https://www.sanook.com',
    'https://www.thairath.co.th',
    'https://www.bangkokpost.com',
    'https://th.wikipedia.org'
  ],
  ID: [
    'https://www.google.co.id',
    'https://www.detik.com',
    'https://www.kompas.com',
    'https://www.tribunnews.com',
    'https://id.wikipedia.org'
  ],
  MY: [
    'https://www.google.com.my',
    'https://www.thestar.com.my',
    'https://says.com',
    'https://ms.wikipedia.org'
  ],
  PH: [
    'https://www.google.com.ph',
    'https://www.rappler.com',
    'https://www.gmanetwork.com/news',
    'https://www.philstar.com'
  ],
  SG: [
    'https://www.google.com.sg',
    'https://www.straitstimes.com',
    'https://www.channelnewsasia.com',
    'https://www.todayonline.com'
  ],
  global: []
}

const INTEREST_BY_REGION: Record<WarmUpRegion, string[]> = {
  VN: [
    'https://www.youtube.com/results?search_query=m%C3%B3n+ngon+vi%E1%BB%87t+nam',
    'https://vnexpress.net/the-thao',
    'https://kenh14.vn'
  ],
  TH: [
    'https://www.youtube.com/results?search_query=%E0%B8%AD%E0%B8%B2%E0%B8%AB%E0%B8%B2%E0%B8%A3%E0%B9%84%E0%B8%97%E0%B8%A2',
    'https://pantip.com',
    'https://www.kapook.com'
  ],
  ID: [
    'https://www.youtube.com/results?search_query=kuliner+indonesia',
    'https://www.kaskus.co.id',
    'https://www.liputan6.com'
  ],
  MY: ['https://www.youtube.com/results?search_query=makanan+malaysia', 'https://www.lowyat.net'],
  PH: ['https://www.youtube.com/results?search_query=filipino+food', 'https://www.inquirer.net'],
  SG: ['https://www.youtube.com/results?search_query=singapore+food', 'https://www.hardwarezone.com.sg'],
  global: []
}

// ── Helpers ────────────────────────────────────────────────────────────────

function randomInt(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1))
}

function pickN<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return arr.slice()
  const copy = arr.slice()
  const out: T[] = []
  while (out.length < n && copy.length > 0) {
    const idx = Math.floor(Math.random() * copy.length)
    out.push(copy.splice(idx, 1)[0])
  }
  return out
}

function nowIso(): string {
  return new Date().toISOString()
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

// ── URL plan builder ───────────────────────────────────────────────────────

/**
 * Build the ordered list of URLs to visit for a single session.
 *
 * Benign / interest stages draw from the global + regional pools. Platform
 * stages draw from the plan's target platforms' canonical landing pages
 * (and popular internal paths if available).
 */
function buildUrlList(stage: WarmUpStage, region: WarmUpRegion, targets: string[]): string[] {
  const count = VISITS_PER_STAGE[stage]
  switch (stage) {
    case 'benign': {
      const regional = BENIGN_BY_REGION[region] ?? []
      // Bias towards regional if available, pad with global.
      const pool = regional.length >= 2
        ? [...pickN(regional, Math.max(2, Math.floor(count / 2))), ...pickN(BENIGN_GLOBAL, count)]
        : BENIGN_GLOBAL
      return pickN(pool, count)
    }
    case 'interests': {
      const regional = INTEREST_BY_REGION[region] ?? []
      const pool = [...regional, ...INTEREST_GLOBAL]
      return pickN(pool, count)
    }
    case 'platform-adjacent':
    case 'platform-active':
    case 'ready': {
      const urls: string[] = []
      for (const id of targets) {
        const p = getSeaPlatform(id)
        if (!p) continue
        // Prefer the region-specific URL if available.
        const landing =
          region !== 'global' && (p as any).regionUrls?.[region]
            ? (p as any).regionUrls[region]
            : p.baseUrl
        urls.push(landing)
        // For "active" stage, add a couple of internal navigations.
        if (stage === 'platform-active' || stage === 'ready') {
          urls.push(landing.replace(/\/$/, '') + '/')
          urls.push(landing.replace(/\/$/, '') + '/?search=trending')
        }
      }
      // If user picked no target platforms, fall back to benign regional.
      if (urls.length === 0) return buildUrlList('benign', region, targets)
      return pickN(urls, Math.min(count, urls.length))
    }
  }
}

// ── Organic interaction synthesis ──────────────────────────────────────────
//
// For each URL visit we perform a small sequence of "human" actions:
//   • navigate              — page.goto
//   • dwell                 — wait 8..45s depending on stage
//   • scroll x N            — staggered scrollBy calls with easing
//   • mouse-move x N        — random jitter on the viewport
//   • hover                 — hover a random visible link
//
// All actions that talk to Chromium are wrapped in try/catch so that one
// flaky page cannot take down the whole session.

async function synthesizeInteractions(
  page: Page,
  url: string,
  stage: WarmUpStage
): Promise<WarmUpInteraction[]> {
  const events: WarmUpInteraction[] = []
  const [dwellMin, dwellMax] = DWELL_RANGE_MS[stage]

  // 1. navigate
  {
    const t0 = Date.now()
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 })
      events.push({ type: 'navigate', target: url, ms: Date.now() - t0, ok: true })
    } catch (err: any) {
      events.push({
        type: 'navigate',
        target: url,
        ms: Date.now() - t0,
        ok: false,
        error: err?.message ?? String(err)
      })
      return events // page never loaded — skip rest
    }
  }

  // 2. mouse-move jitter — 3..6 small random moves
  const moves = randomInt(3, 6)
  try {
    const viewport = page.viewport() ?? { width: 1280, height: 800 }
    let x = randomInt(100, viewport.width - 100)
    let y = randomInt(100, viewport.height - 100)
    for (let i = 0; i < moves; i++) {
      x = Math.max(10, Math.min(viewport.width - 10, x + randomInt(-120, 120)))
      y = Math.max(10, Math.min(viewport.height - 10, y + randomInt(-80, 80)))
      const t0 = Date.now()
      await page.mouse.move(x, y, { steps: randomInt(8, 20) })
      await wait(randomInt(80, 250))
      events.push({ type: 'mouse-move', target: `${x},${y}`, ms: Date.now() - t0, ok: true })
    }
  } catch (err: any) {
    events.push({ type: 'mouse-move', ms: 0, ok: false, error: err?.message ?? String(err) })
  }

  // 3. scroll — staggered scrollBy calls
  const scrolls = stage === 'platform-active' || stage === 'ready'
    ? randomInt(4, 8)
    : randomInt(2, 5)
  for (let i = 0; i < scrolls; i++) {
    const t0 = Date.now()
    try {
      const delta = randomInt(200, 900)
      await page.evaluate((d) => {
        window.scrollBy({ top: d, left: 0, behavior: 'smooth' })
      }, delta)
      await wait(randomInt(400, 1200))
      events.push({ type: 'scroll', target: `${delta}px`, ms: Date.now() - t0, ok: true })
    } catch (err: any) {
      events.push({ type: 'scroll', ms: Date.now() - t0, ok: false, error: err?.message ?? String(err) })
    }
  }

  // 4. hover a visible link (best-effort)
  try {
    const hovered: string | null = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href]')) as HTMLAnchorElement[]
      const visible = links.filter((a) => {
        const rect = a.getBoundingClientRect()
        return rect.width > 10 && rect.height > 10 && rect.top > 0 && rect.top < window.innerHeight
      })
      if (visible.length === 0) return null
      const pick = visible[Math.floor(Math.random() * visible.length)]
      const rect = pick.getBoundingClientRect()
      return JSON.stringify({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, href: pick.href })
    })
    if (hovered) {
      const info = JSON.parse(hovered) as { x: number; y: number; href: string }
      const t0 = Date.now()
      await page.mouse.move(info.x, info.y, { steps: randomInt(10, 25) })
      await wait(randomInt(300, 900))
      events.push({ type: 'hover', target: info.href, ms: Date.now() - t0, ok: true })
    }
  } catch (err: any) {
    events.push({ type: 'hover', ms: 0, ok: false, error: err?.message ?? String(err) })
  }

  // 5. dwell — the rest of the session time on this page
  const dwell = randomInt(dwellMin, dwellMax)
  const t0 = Date.now()
  await wait(dwell)
  events.push({ type: 'dwell', ms: Date.now() - t0, ok: true })

  return events
}

/** Engagement score: 0..100 based on successful interaction count. */
function scoreInteractions(events: WarmUpInteraction[]): number {
  const total = events.length
  if (total === 0) return 0
  const ok = events.filter((e) => e.ok).length
  const ratio = ok / total
  // Scale non-linearly so "all OK" = 100 and "half OK" = ~60.
  return Math.round(Math.min(100, ratio * 100 + (ok > 8 ? 5 : 0)))
}

// ── Engine ─────────────────────────────────────────────────────────────────

export class SmartWarmUpEngine {
  private static instance: SmartWarmUpEngine
  /** Per-profile mutex — prevents two concurrent sessions on the same profile. */
  private running = new Set<string>()

  static getInstance(): SmartWarmUpEngine {
    if (!SmartWarmUpEngine.instance) {
      SmartWarmUpEngine.instance = new SmartWarmUpEngine()
    }
    return SmartWarmUpEngine.instance
  }

  /**
   * Create a new 7-day warm-up plan for a profile.
   *
   * If `apply_fake_age_now` is true the profile's `created_at` timestamp is
   * immediately backdated by `fake_account_age_days` days. This is
   * persistent — the user can see it reflected in the profile list.
   */
  createPlan(input: CreateWarmUpPlanInput): WarmUpPlan {
    const db = Database.getInstance()

    const existingProfile = db.getProfile(input.profile_id) as any
    if (!existingProfile) throw new Error(`Profile ${input.profile_id} not found`)

    // Enforce one active plan per profile — replace prior plan if it exists.
    const prior = db.getWarmupPlanByProfile(input.profile_id)
    if (prior && (prior.status === 'pending' || prior.status === 'running' || prior.status === 'paused')) {
      db.deleteWarmupPlan(prior.id)
    }

    const id = uuidv4()
    const region: WarmUpRegion = input.region ?? 'global'
    const targets = input.target_platforms ?? []
    const totalDays = Math.min(14, Math.max(1, input.total_days ?? 7))
    const fakeDays = Math.max(0, Math.floor(input.fake_account_age_days ?? 0))

    db.createWarmupPlan({
      id,
      profile_id: input.profile_id,
      region,
      target_platforms: targets,
      total_days: totalDays,
      fake_account_age_days: fakeDays,
      notes: ''
    })

    if (input.apply_fake_age_now && fakeDays > 0) {
      db.backdateProfileCreatedAt(input.profile_id, fakeDays)
    }

    const plan = db.getWarmupPlan(id) as WarmUpPlan
    return plan
  }

  /** Explicit backdate helper so the UI can offer it as a standalone action. */
  applyFakeAccountAge(profileId: string, days: number): { created_at: string } {
    const db = Database.getInstance()
    const prof = db.getProfile(profileId)
    if (!prof) throw new Error(`Profile ${profileId} not found`)
    const created_at = db.backdateProfileCreatedAt(profileId, days)
    return { created_at }
  }

  /** Return plan + sessions + whether next session is due. */
  getProgress(planId: string): WarmUpPlanProgress | null {
    const db = Database.getInstance()
    const plan = db.getWarmupPlan(planId) as WarmUpPlan | null
    if (!plan) return null
    const sessions = db.getWarmupSessionsByPlan(planId) as WarmUpSession[]
    const nextDay = plan.current_day < plan.total_days ? plan.current_day + 1 : null
    const nextDue = this.isNextDue(plan)
    return { plan, sessions, next_day: nextDay, next_due: nextDue }
  }

  /** True if the plan's next session should run now. */
  isNextDue(plan: WarmUpPlan): boolean {
    if (plan.status === 'completed' || plan.status === 'cancelled' || plan.status === 'failed') {
      return false
    }
    if (plan.current_day >= plan.total_days) return false
    if (!plan.last_session_at) return true // day 1 — always due
    const last = Date.parse(plan.last_session_at)
    if (Number.isNaN(last)) return true
    return Date.now() - last >= DEFAULT_DAY_INTERVAL_MS
  }

  /**
   * Run the next pending session for this profile's plan. The profile MUST
   * already be launched — we do not auto-launch here so the UI stays in
   * control of proxies / fingerprint selection.
   */
  async runNextSession(profileId: string): Promise<WarmUpSession> {
    if (this.running.has(profileId)) {
      throw new Error('A warm-up session is already running for this profile.')
    }
    const db = Database.getInstance()
    const bm = BrowserManager.getInstance()
    const plan = db.getWarmupPlanByProfile(profileId) as WarmUpPlan | null
    if (!plan) throw new Error('No warm-up plan exists for this profile.')
    if (plan.status === 'completed') throw new Error('Warm-up plan already completed.')
    if (plan.status === 'cancelled') throw new Error('Warm-up plan was cancelled.')
    if (plan.current_day >= plan.total_days) throw new Error('Warm-up plan already at final day.')
    if (!bm.isRunning(profileId)) {
      throw new Error('Profile must be launched before running a warm-up session.')
    }
    const page = await bm.getActivePage(profileId)
    if (!page) throw new Error('No active page for profile.')

    this.running.add(profileId)
    const day = plan.current_day + 1
    const stage: WarmUpStage = DAY_STAGE[day] ?? 'benign'
    const sessionId = uuidv4()
    const startedAt = nowIso()
    const t0 = Date.now()
    const visited: string[] = []
    const interactions: WarmUpInteraction[] = []

    try {
      // Mark plan as running on the very first session.
      if (plan.status === 'pending' || plan.status === 'paused') {
        db.updateWarmupPlan(plan.id, {
          status: 'running',
          started_at: plan.started_at ?? startedAt
        })
      }

      const urls = buildUrlList(stage, plan.region as WarmUpRegion, plan.target_platforms)
      for (const url of urls) {
        visited.push(url)
        const events = await synthesizeInteractions(page, url, stage)
        interactions.push(...events)
      }

      const durationMs = Date.now() - t0
      const score = scoreInteractions(interactions)
      const success = score >= 50 && interactions.some((e) => e.type === 'navigate' && e.ok)
      const completedAt = nowIso()

      db.addWarmupSession({
        id: sessionId,
        plan_id: plan.id,
        profile_id: profileId,
        day,
        stage,
        visited,
        interactions,
        engagement_score: score,
        duration_ms: durationMs,
        success,
        error: null,
        started_at: startedAt,
        completed_at: completedAt
      })

      // Advance plan state.
      if (success) {
        const nextDay = day
        const isLast = nextDay >= plan.total_days
        db.updateWarmupPlan(plan.id, {
          current_day: nextDay,
          status: isLast ? 'completed' : 'running',
          last_session_at: completedAt,
          next_run_at: isLast
            ? null
            : new Date(Date.now() + DEFAULT_DAY_INTERVAL_MS).toISOString(),
          completed_at: isLast ? completedAt : null
        })
        if (isLast) {
          // Mirror the legacy `warmed_up` flag so callers that still rely on
          // it (detection dashboard, profile list) see the profile as warm.
          db.setProfileWarmedUp(profileId, true)
        }
      } else {
        // Failed session — do not advance current_day, but record the
        // last_session_at so the scheduler does not retry in a hot loop.
        db.updateWarmupPlan(plan.id, { last_session_at: completedAt })
      }

      return {
        id: sessionId,
        plan_id: plan.id,
        profile_id: profileId,
        day,
        stage,
        visited,
        interactions,
        engagement_score: score,
        duration_ms: durationMs,
        success,
        started_at: startedAt,
        completed_at: completedAt
      }
    } catch (err: any) {
      const completedAt = nowIso()
      db.addWarmupSession({
        id: sessionId,
        plan_id: plan.id,
        profile_id: profileId,
        day,
        stage,
        visited,
        interactions,
        engagement_score: scoreInteractions(interactions),
        duration_ms: Date.now() - t0,
        success: false,
        error: err?.message ?? String(err),
        started_at: startedAt,
        completed_at: completedAt
      })
      db.updateWarmupPlan(plan.id, { last_session_at: completedAt })
      throw err
    } finally {
      this.running.delete(profileId)
    }
  }

  /** Pause / resume / cancel helpers. */
  pausePlan(profileId: string): void {
    const db = Database.getInstance()
    const plan = db.getWarmupPlanByProfile(profileId)
    if (!plan) throw new Error('No warm-up plan exists for this profile.')
    db.updateWarmupPlan(plan.id, { status: 'paused' })
  }

  resumePlan(profileId: string): void {
    const db = Database.getInstance()
    const plan = db.getWarmupPlanByProfile(profileId)
    if (!plan) throw new Error('No warm-up plan exists for this profile.')
    db.updateWarmupPlan(plan.id, { status: 'running' })
  }

  cancelPlan(profileId: string): void {
    const db = Database.getInstance()
    const plan = db.getWarmupPlanByProfile(profileId)
    if (!plan) throw new Error('No warm-up plan exists for this profile.')
    db.updateWarmupPlan(plan.id, { status: 'cancelled' })
  }

  /** Return the stage label for a given day (used by the UI). */
  static stageForDay(day: number): WarmUpStage {
    return DAY_STAGE[day] ?? 'benign'
  }

  /** Return all visit counts & stage metadata (used by the UI). */
  static getPlanBlueprint(): { day: number; stage: WarmUpStage; visits: number }[] {
    return Object.entries(DAY_STAGE).map(([d, stage]) => ({
      day: Number(d),
      stage,
      visits: VISITS_PER_STAGE[stage]
    }))
  }
}

// ── Scheduler ──────────────────────────────────────────────────────────────

/**
 * Polls every 10 minutes and runs any plan whose next session is due —
 * but only if the profile is currently launched. If the profile is not
 * running we leave the plan alone; the user will get a UI nudge in the
 * Smart Warm-Up panel.
 */
export class SmartWarmUpScheduler {
  private static instance: SmartWarmUpScheduler
  private timer: NodeJS.Timeout | null = null
  private readonly TICK_MS = 10 * 60 * 1000 // 10 minutes

  static getInstance(): SmartWarmUpScheduler {
    if (!SmartWarmUpScheduler.instance) {
      SmartWarmUpScheduler.instance = new SmartWarmUpScheduler()
    }
    return SmartWarmUpScheduler.instance
  }

  start(): void {
    if (this.timer) return
    this.tick().catch((e) => console.error('[smart-warmup] tick error:', e))
    this.timer = setInterval(() => {
      this.tick().catch((e) => console.error('[smart-warmup] tick error:', e))
    }, this.TICK_MS)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  private async tick(): Promise<void> {
    const db = Database.getInstance()
    const bm = BrowserManager.getInstance()
    const engine = SmartWarmUpEngine.getInstance()
    const plans = db.getAllWarmupPlans() as WarmUpPlan[]
    for (const plan of plans) {
      if (!engine.isNextDue(plan)) continue
      if (!bm.isRunning(plan.profile_id)) continue // profile offline — skip
      try {
        await engine.runNextSession(plan.profile_id)
      } catch (err: any) {
        console.error(`[smart-warmup] session for ${plan.profile_id} failed:`, err?.message ?? err)
      }
    }
  }
}
