import { v4 as uuidv4 } from 'uuid'
import { Database } from './database'
import { AutomationEngine } from './automation'
import { BrowserManager } from './browser-manager'
import { resolveFingerprint } from './fingerprint/presets'

export interface WorkflowSchedule {
  id: string
  name: string
  workflow_id: string
  profile_ids: string[]
  cron: string
  enabled: boolean
  last_run_at: string | null
  next_run_at: string | null
  created_at: string
}

/**
 * Phase 10.2 — Workflow scheduler.
 *
 * Implements a minimal cron-like scheduler driven by a 30-second polling
 * tick. Each schedule record stores a 5-field cron expression
 *   minute  hour  day-of-month  month  day-of-week
 * supporting `*`, comma lists, ranges, and step values (`*\/5`).
 * The scheduler is intentionally dependency-free — we don't need
 * sub-second precision or distributed locking, only periodic background runs.
 */
export class WorkflowScheduler {
  private static instance: WorkflowScheduler
  private timer: NodeJS.Timeout | null = null
  private readonly TICK_MS = 30_000

  static getInstance(): WorkflowScheduler {
    if (!WorkflowScheduler.instance) {
      WorkflowScheduler.instance = new WorkflowScheduler()
    }
    return WorkflowScheduler.instance
  }

  start(): void {
    if (this.timer) return
    // Run immediately, then every 30s
    this.tick().catch((e) => console.error('[scheduler] tick error:', e))
    this.timer = setInterval(() => {
      this.tick().catch((e) => console.error('[scheduler] tick error:', e))
    }, this.TICK_MS)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  /** One scheduler tick — run any due schedules. */
  private async tick(): Promise<void> {
    const db = Database.getInstance()
    const now = new Date()
    const schedules = db.getAllSchedules() as any[]
    for (const row of schedules) {
      if (!row.enabled) continue
      try {
        const profileIds: string[] = JSON.parse(row.profile_ids || '[]')
        if (profileIds.length === 0) continue
        const due = this.isDue(row.cron, now, row.last_run_at)
        if (!due) continue
        await this.runSchedule(row.id, row.workflow_id, profileIds)
      } catch (err: any) {
        console.error(`[scheduler] schedule ${row.id} failed:`, err.message)
      }
    }
  }

  /** Manually trigger a schedule (also called by `runNow`). */
  async runSchedule(scheduleId: string, workflowId: string, profileIds: string[]): Promise<void> {
    const db = Database.getInstance()
    const bm = BrowserManager.getInstance()
    const automation = AutomationEngine.getInstance()

    // Mark schedule as running so we don't double-fire on the next tick.
    db.markScheduleRun(scheduleId, new Date().toISOString())

    // Auto-launch any profiles that aren't already running, then close
    // the headless ones we opened (we leave already-open ones alone).
    const ourLaunches: string[] = []
    for (const pid of profileIds) {
      if (bm.isRunning(pid)) continue
      try {
        const profile: any = db.getProfile(pid)
        if (!profile) continue
        const fp = typeof profile.fingerprint === 'string'
          ? JSON.parse(profile.fingerprint)
          : profile.fingerprint
        const allProxies = db.getAllProxies() as any[]
        const { proxy } = bm.pickProxy(profile, allProxies)
        let cookies: any[] = []
        try { cookies = JSON.parse(profile.cookies || '[]') } catch { /* ignore */ }
        await bm.launchProfile(pid, fp, proxy ?? undefined, cookies.length > 0 ? cookies : undefined)
        ourLaunches.push(pid)
      } catch (err: any) {
        console.error(`[scheduler] launch failed for ${pid}:`, err.message)
      }
    }

    try {
      await automation.executeWorkflowParallel(workflowId, profileIds)
    } finally {
      for (const pid of ourLaunches) {
        await bm.closeProfile(pid).catch(() => {})
      }
    }
  }

  /**
   * Determine whether a schedule is due to run.
   * To prevent double-firing inside the same minute we require that the
   * last_run_at was in a different minute than `now`.
   */
  isDue(cron: string, now: Date, lastRunAt: string | null): boolean {
    if (!this.matchesCron(cron, now)) return false
    if (lastRunAt) {
      const last = new Date(lastRunAt)
      // Same minute → already ran for this slot.
      if (
        last.getFullYear() === now.getFullYear() &&
        last.getMonth() === now.getMonth() &&
        last.getDate() === now.getDate() &&
        last.getHours() === now.getHours() &&
        last.getMinutes() === now.getMinutes()
      ) {
        return false
      }
    }
    return true
  }

  /** Parse a 5-field cron expression and check if it matches the given Date. */
  matchesCron(cron: string, date: Date): boolean {
    const parts = cron.trim().split(/\s+/)
    if (parts.length !== 5) return false
    const [minStr, hourStr, domStr, monStr, dowStr] = parts
    const min = date.getMinutes()
    const hour = date.getHours()
    const dom = date.getDate()
    const mon = date.getMonth() + 1 // cron months are 1-12
    const dow = date.getDay() // 0 = Sunday
    return (
      this.matchField(minStr, min, 0, 59) &&
      this.matchField(hourStr, hour, 0, 23) &&
      this.matchField(domStr, dom, 1, 31) &&
      this.matchField(monStr, mon, 1, 12) &&
      this.matchField(dowStr, dow, 0, 6)
    )
  }

  /**
   * Match a single cron field. Supports:
   *   *               — any value
   *   N               — exact match
   *   N,M             — list
   *   N-M             — inclusive range
   *   *\/N            — every N values from the field's minimum
   *   N-M/S           — stepped range
   */
  private matchField(field: string, value: number, min: number, max: number): boolean {
    if (field === '*') return true
    const tokens = field.split(',')
    for (const tokRaw of tokens) {
      const tok = tokRaw.trim()
      if (!tok) continue
      // Step form
      let step = 1
      let body = tok
      const slashIdx = tok.indexOf('/')
      if (slashIdx >= 0) {
        body = tok.substring(0, slashIdx)
        step = parseInt(tok.substring(slashIdx + 1), 10)
        if (!Number.isFinite(step) || step <= 0) continue
      }
      // Range
      let lo = min
      let hi = max
      if (body === '*' || body === '') {
        lo = min
        hi = max
      } else if (body.includes('-')) {
        const [a, b] = body.split('-').map((x) => parseInt(x, 10))
        if (Number.isFinite(a)) lo = a
        if (Number.isFinite(b)) hi = b
      } else {
        const n = parseInt(body, 10)
        if (!Number.isFinite(n)) continue
        if (step === 1) {
          if (n === value) return true
          continue
        }
        lo = n
        hi = max
      }
      if (value < lo || value > hi) continue
      if ((value - lo) % step === 0) return true
    }
    return false
  }

  /** Compute next run time for display only (best-effort). */
  nextRun(cron: string, from: Date = new Date()): Date | null {
    // Simple search: scan minute-by-minute up to one year ahead.
    const d = new Date(from.getTime())
    d.setSeconds(0, 0)
    d.setMinutes(d.getMinutes() + 1)
    for (let i = 0; i < 60 * 24 * 366; i++) {
      if (this.matchesCron(cron, d)) return new Date(d.getTime())
      d.setMinutes(d.getMinutes() + 1)
    }
    return null
  }
}

/** Helper used by IPC handler to create a new schedule row. */
export function buildScheduleRow(input: {
  workflow_id: string
  profile_ids: string[]
  cron: string
  enabled?: boolean
  name?: string
}): WorkflowSchedule {
  // Phase 19.1: Validate cron up-front so create/update handlers throw a
  // descriptive error instead of silently storing a row that will never fire.
  validateCronExpression(input.cron)

  const scheduler = WorkflowScheduler.getInstance()
  const next = scheduler.nextRun(input.cron)
  return {
    id: uuidv4(),
    name: input.name ?? 'Schedule',
    workflow_id: input.workflow_id,
    profile_ids: input.profile_ids,
    cron: input.cron,
    enabled: input.enabled ?? true,
    last_run_at: null,
    next_run_at: next ? next.toISOString() : null,
    created_at: new Date().toISOString()
  }
}

/**
 * Phase 19.1 — Strict 5-field cron validator.
 *
 * Validates the same subset that `WorkflowScheduler.matchField()` actually
 * supports: `*`, exact integers, comma lists, ranges (`N-M`), step values
 * (`*\/N`, `N-M/S`). Throws a descriptive Error on any malformed input —
 * IPC handlers should let this propagate so the renderer toast layer can
 * surface it to the user.
 *
 * Field bounds:
 *   minute       0-59
 *   hour         0-23
 *   day-of-month 1-31
 *   month        1-12
 *   day-of-week  0-6  (0 = Sunday)
 */
export function validateCronExpression(cron: string): void {
  if (typeof cron !== 'string' || !cron.trim()) {
    throw new Error('Cron expression is required')
  }
  const parts = cron.trim().split(/\s+/)
  if (parts.length !== 5) {
    throw new Error(
      `Cron expression must have 5 fields (minute hour day-of-month month day-of-week), got ${parts.length}`,
    )
  }
  const bounds: [number, number, string][] = [
    [0, 59, 'minute'],
    [0, 23, 'hour'],
    [1, 31, 'day-of-month'],
    [1, 12, 'month'],
    [0, 6,  'day-of-week'],
  ]
  for (let i = 0; i < 5; i++) {
    const [min, max, label] = bounds[i]
    validateCronField(parts[i], min, max, label)
  }
}

function validateCronField(field: string, min: number, max: number, label: string): void {
  if (!field) throw new Error(`Cron field "${label}" is empty`)
  for (const tokRaw of field.split(',')) {
    const tok = tokRaw.trim()
    if (!tok) throw new Error(`Cron field "${label}" has empty list element`)

    let body = tok
    let stepStr: string | null = null
    const slashIdx = tok.indexOf('/')
    if (slashIdx >= 0) {
      body = tok.substring(0, slashIdx)
      stepStr = tok.substring(slashIdx + 1)
      const step = Number(stepStr)
      if (!Number.isInteger(step) || step <= 0) {
        throw new Error(`Cron field "${label}" has invalid step "${stepStr}"`)
      }
    }

    if (body === '*' || body === '') continue

    if (body.includes('-')) {
      const [aStr, bStr] = body.split('-')
      const a = Number(aStr)
      const b = Number(bStr)
      if (!Number.isInteger(a) || !Number.isInteger(b)) {
        throw new Error(`Cron field "${label}" range "${body}" is not numeric`)
      }
      if (a < min || a > max || b < min || b > max) {
        throw new Error(`Cron field "${label}" range "${body}" out of bounds [${min}-${max}]`)
      }
      if (a > b) {
        throw new Error(`Cron field "${label}" range "${body}" must have low <= high`)
      }
      continue
    }

    const n = Number(body)
    if (!Number.isInteger(n)) {
      throw new Error(`Cron field "${label}" value "${body}" is not numeric`)
    }
    if (n < min || n > max) {
      throw new Error(`Cron field "${label}" value ${n} out of bounds [${min}-${max}]`)
    }
  }
}
