import { v4 as uuidv4 } from 'uuid'
import { BrowserManager } from './browser-manager'
import { Database } from './database'
import { getSettings } from './settings'
import { getSolver, type CaptchaProviderId, type SolveResult } from './captcha'
import { getVault } from './vault'
import type {
  AutomationStep,
  AutomationStepResult,
  AutomationRunResult,
  AutomationWorkflow,
  AssertResult,
  AssertType,
  PreFlightValidationResult,
  VariableType,
  VariableDefinition,
  TypedVariable,
  ErrorCategory,
  ErrorContext,
  CircuitBreakerConfig,
  CircuitBreakerState,
  AutomationRunMetrics,
  AiRecoveryConfig,
  AiRecoveryIntervention
} from '../shared/types'
import { validatePreFlight, analyzeRuntimeSignal } from './platform-hardener'
import { generateRecoverySteps } from './ai-assistant'
import type { Page, ElementHandle } from 'puppeteer-core'
import type { WebContents } from 'electron'
import { app } from 'electron'
import http from 'http'
import https from 'https'
import { createWriteStream } from 'fs'
import { mkdir, stat, readFile as fsReadFile, writeFile as fsWriteFile, appendFile as fsAppendFile } from 'fs/promises'
import { dirname, extname, isAbsolute, resolve as pathResolve } from 'path'
import { URL } from 'url'

/**
 * Tier 6: Minimal RFC-4180-style CSV parser. Handles quoted fields, embedded
 * commas/newlines, and double-quote escaping. The first row is treated as the
 * header — every subsequent row becomes an object keyed by header column.
 *
 * Keeping this in-tree avoids pulling a new dependency for the common case of
 * config-style spreadsheets used in farming/scraping workflows.
 */
function parseCsv(text: string, delimiter = ','): Record<string, string>[] {
  const rows: string[][] = []
  let current: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0
  // Strip BOM if present
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)

  while (i < text.length) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue }
        inQuotes = false
        i++
        continue
      }
      field += ch
      i++
      continue
    }
    if (ch === '"') { inQuotes = true; i++; continue }
    if (ch === delimiter) { current.push(field); field = ''; i++; continue }
    if (ch === '\r') { i++; continue }
    if (ch === '\n') {
      current.push(field)
      rows.push(current)
      current = []
      field = ''
      i++
      continue
    }
    field += ch
    i++
  }
  // Flush trailing field/row
  if (field.length > 0 || current.length > 0) {
    current.push(field)
    rows.push(current)
  }

  if (rows.length === 0) return []
  const header = rows[0].map((h) => h.trim())
  return rows.slice(1)
    .filter((r) => r.length > 0 && !(r.length === 1 && r[0] === ''))
    .map((r) => {
      const obj: Record<string, string> = {}
      header.forEach((h, idx) => { obj[h] = r[idx] ?? '' })
      return obj
    })
}

/**
 * Phase 18.1 — File path validation for security.
 *
 * Prevents directory traversal attacks (LFI) by validating that file paths
 * are contained within the app's userData directory. Rejects paths that:
 *   - Use absolute paths outside userData
 *   - Use ../../../ traversal attacks
 *   - Point to sensitive system files
 *
 * Returns the validated absolute path if safe, otherwise throws.
 */
function validateFilePath(filePath: string): string {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('filePath must be a non-empty string')
  }

  const userData = app.getPath('userData')

  // Handle absolute paths
  if (isAbsolute(filePath)) {
    const normalized = pathResolve(filePath)
    const relative = normalized.split(userData).pop() || ''

    // Check if path escapes userData
    if (!normalized.startsWith(userData)) {
      throw new Error(
        `File access denied: absolute path outside userData directory. ` +
        `Restricted to: ${userData}`
      )
    }
    return normalized
  }

  // Handle relative paths — resolve relative to userData
  const normalized = pathResolve(userData, filePath)

  // Ensure it's still within userData (prevent ../)
  try {
    const relative = pathResolve(normalized).substring(userData.length + 1)
    if (relative.startsWith('..')) {
      throw new Error(
        `File access denied: path escape attempt (../) detected. ` +
        `Use relative paths within the user data directory.`
      )
    }
  } catch {
    throw new Error(
      `File access denied: invalid path. ` +
      `Use relative paths within the user data directory.`
    )
  }

  return normalized
}

/** Replace {key} placeholders in step params with variable values.
 *  Keys may include dots for namespaced lookups (e.g. `{cred.username}`). */
function interpolateParams(
  params: Record<string, any>,
  vars: Record<string, string>
): Record<string, any> {
  if (Object.keys(vars).length === 0) return params
  return JSON.parse(
    JSON.stringify(params).replace(/\{([\w.]+)\}/g, (_, k) => vars[k] ?? `{${k}}`)
  )
}

// ─── Phase 1 Typed Variables — Runtime Utilities ─────────────────────────────

/**
 * Infer the VariableType from a raw JavaScript value.
 * Used as fallback when no explicit saveAsType or VariableDefinition exists.
 */
export function inferVariableType(value: any): VariableType {
  if (value === null || value === undefined) return 'string'
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'number' && Number.isFinite(value)) return 'number'
  if (Array.isArray(value)) return 'array'
  if (typeof value === 'object') return 'object'
  // For strings: try to detect JSON arrays/objects
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if ((trimmed.startsWith('[') && trimmed.endsWith(']')) ||
        (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
      try {
        const parsed = JSON.parse(trimmed)
        if (Array.isArray(parsed)) return 'array'
        if (typeof parsed === 'object' && parsed !== null) return 'object'
      } catch { /* not valid JSON */ }
    }
    // Detect numbers stored as strings (from extractText, etc.)
    if (/^-?\d+(\.\d+)?$/.test(trimmed) && trimmed.length > 0) return 'number'
  }
  return 'string'
}

/**
 * Coerce a value to the target VariableType. Returns the coerced value.
 * Throws only if coercion is impossible (e.g. non-numeric string → number).
 */
export function coerceVariable(value: any, targetType: VariableType): any {
  if (value === null || value === undefined) {
    switch (targetType) {
      case 'string': return ''
      case 'number': return 0
      case 'boolean': return false
      case 'array': return []
      case 'object': return {}
    }
  }

  switch (targetType) {
    case 'string':
      if (typeof value === 'string') return value
      if (typeof value === 'object') return JSON.stringify(value)
      return String(value)

    case 'number': {
      if (typeof value === 'number') return value
      const n = Number(value)
      if (Number.isFinite(n)) return n
      // Try parsing from JSON string
      if (typeof value === 'string') {
        const trimmed = value.trim()
        const parsed = Number(trimmed)
        if (Number.isFinite(parsed)) return parsed
      }
      return 0  // safe fallback — no throw so workflows don't break
    }

    case 'boolean':
      if (typeof value === 'boolean') return value
      if (typeof value === 'string') {
        const lower = value.toLowerCase().trim()
        return lower === 'true' || lower === '1' || lower === 'yes'
      }
      return !!value

    case 'array':
      if (Array.isArray(value)) return value
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value)
          if (Array.isArray(parsed)) return parsed
        } catch { /* fall through */ }
        return [value]  // wrap scalar in array
      }
      return [value]

    case 'object':
      if (typeof value === 'object' && !Array.isArray(value)) return value
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value)
          if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) return parsed
        } catch { /* fall through */ }
      }
      return { value }  // wrap in object

    default:
      return value
  }
}

/**
 * Convert a TypedVariable map to the legacy Record<string, string> format.
 * All values are stringified for backward compatibility with interpolateParams.
 */
export function typedVarsToStringMap(typedVars: Map<string, TypedVariable>): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, tv] of typedVars) {
    if (tv.value === null || tv.value === undefined) {
      result[key] = ''
    } else if (typeof tv.value === 'string') {
      result[key] = tv.value
    } else {
      result[key] = JSON.stringify(tv.value)
    }
  }
  return result
}

/**
 * Initialize typed variables from workflow definitions, legacy variables, and runtime overrides.
 * Returns both the TypedVariable map and the string map for interpolation.
 */
export function initializeTypedVariables(
  definitions: VariableDefinition[] | undefined,
  legacyVars: Record<string, string> | undefined,
  runtimeVars: Record<string, string> | undefined,
  builtIns: Record<string, string>
): { typedVars: Map<string, TypedVariable>; stringVars: Record<string, string> } {
  const typedVars = new Map<string, TypedVariable>()

  // 1. Apply defaults from definitions
  if (definitions) {
    for (const def of definitions) {
      if (def.default !== undefined) {
        typedVars.set(def.name, {
          value: coerceVariable(def.default, def.type),
          type: def.type
        })
      } else if (def.required) {
        // Set type-appropriate empty default for required vars
        typedVars.set(def.name, {
          value: coerceVariable(null, def.type),
          type: def.type
        })
      }
    }
  }

  // 2. Override with legacy string variables (backward compatible)
  if (legacyVars) {
    for (const [key, val] of Object.entries(legacyVars)) {
      const def = definitions?.find(d => d.name === key)
      const type = def?.type ?? 'string'
      typedVars.set(key, {
        value: def ? coerceVariable(val, type) : val,
        type
      })
    }
  }

  // 3. Override with runtime variables
  if (runtimeVars) {
    for (const [key, val] of Object.entries(runtimeVars)) {
      const def = definitions?.find(d => d.name === key)
      const type = def?.type ?? 'string'
      typedVars.set(key, {
        value: def ? coerceVariable(val, type) : val,
        type
      })
    }
  }

  // 4. Add built-in variables (always string type)
  for (const [key, val] of Object.entries(builtIns)) {
    if (!typedVars.has(key)) {
      typedVars.set(key, { value: val, type: 'string' })
    }
  }

  // Generate the string map for interpolation
  const stringVars = typedVarsToStringMap(typedVars)

  return { typedVars, stringVars }
}

/**
 * Set a typed variable from a step's saveAs output. Infers type from the value
 * and step's saveAsType hint, or falls back to the workflow's VariableDefinition.
 */
export function setTypedVariable(
  typedVars: Map<string, TypedVariable>,
  stringVars: Record<string, string>,
  name: string,
  value: any,
  stepId: string,
  saveAsType?: VariableType,
  definitions?: VariableDefinition[]
): void {
  // Determine the target type: explicit saveAsType > definition > inferred
  const def = definitions?.find(d => d.name === name)
  const targetType = saveAsType ?? def?.type ?? inferVariableType(value)

  const coerced = coerceVariable(value, targetType)
  typedVars.set(name, { value: coerced, type: targetType, sourceStep: stepId })

  // Update string map for interpolation backward compatibility
  if (coerced === null || coerced === undefined) {
    stringVars[name] = ''
  } else if (typeof coerced === 'string') {
    stringVars[name] = coerced
  } else {
    stringVars[name] = JSON.stringify(coerced)
  }
}

// ─── Phase 2: Error Categorization ───────────────────────────────────────────

/** Known error patterns mapped to categories for smarter recovery. */
const ERROR_PATTERNS: [RegExp, ErrorCategory][] = [
  // Timeout patterns
  [/timed?\s*out/i, 'timeout'],
  [/timeout/i, 'timeout'],
  [/waiting for selector/i, 'timeout'],
  [/exceeded.*ms/i, 'timeout'],
  // Network patterns
  [/net::ERR_/i, 'network'],
  [/ECONNREFUSED/i, 'network'],
  [/ENOTFOUND/i, 'network'],
  [/ECONNRESET/i, 'network'],
  [/ETIMEDOUT/i, 'network'],
  [/fetch failed/i, 'network'],
  [/request failed/i, 'network'],
  [/proxy.*error/i, 'network'],
  [/status\s+4(0[0-9]|[1-9]\d)/i, 'network'],  // 4xx
  [/status\s+5\d{2}/i, 'network'],               // 5xx
  // Selector patterns
  [/not found/i, 'selector'],
  [/no element/i, 'selector'],
  [/selector.*not.*match/i, 'selector'],
  [/failed to find/i, 'selector'],
  // Navigation patterns
  [/navigation/i, 'navigation'],
  [/ERR_TOO_MANY_REDIRECTS/i, 'navigation'],
  [/ERR_ABORTED/i, 'navigation'],
  // Captcha patterns
  [/captcha/i, 'captcha'],
  [/recaptcha/i, 'captcha'],
  [/hcaptcha/i, 'captcha'],
  // Validation patterns
  [/assert/i, 'validation'],
  [/expected/i, 'validation'],
  [/mismatch/i, 'validation'],
  // Permission patterns
  [/EACCES/i, 'permission'],
  [/EPERM/i, 'permission'],
  [/permission denied/i, 'permission'],
]

/**
 * Categorize an error message into a known ErrorCategory.
 * Falls back to 'unknown' if no pattern matches.
 */
export function categorizeError(message: string): ErrorCategory {
  for (const [pattern, category] of ERROR_PATTERNS) {
    if (pattern.test(message)) return category
  }
  return 'unknown'
}

// ─── Phase 2: Circuit Breaker ────────────────────────────────────────────────

/**
 * Per-workflow circuit breaker that monitors consecutive step failures.
 *
 * States:
 *  - CLOSED:    Normal execution. Failures increment the counter.
 *  - OPEN:      Too many failures. Steps are skipped until resetTimeout elapses.
 *  - HALF_OPEN: After timeout, allow a limited number of steps to test recovery.
 *               If they succeed → CLOSED. If they fail → back to OPEN.
 */
export class CircuitBreaker {
  private status: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED'
  private failureCount = 0
  private successCount = 0
  private halfOpenAttempts = 0
  private lastFailureTime: number | null = null
  private tripCount = 0

  constructor(private readonly config: CircuitBreakerConfig) {}

  /** Record a successful step execution. */
  recordSuccess(): void {
    this.failureCount = 0
    if (this.status === 'HALF_OPEN') {
      this.successCount++
      if (this.successCount >= this.config.successThreshold) {
        this.status = 'CLOSED'
        this.successCount = 0
        this.halfOpenAttempts = 0
      }
    }
  }

  /** Record a failed step execution. Returns true if the circuit just tripped. */
  recordFailure(): boolean {
    this.successCount = 0
    this.lastFailureTime = Date.now()

    if (this.status === 'HALF_OPEN') {
      // Failed during recovery test — trip back to OPEN
      this.status = 'OPEN'
      this.halfOpenAttempts = 0
      this.tripCount++
      return true
    }

    this.failureCount++
    if (this.status === 'CLOSED' && this.failureCount >= this.config.failureThreshold) {
      this.status = 'OPEN'
      this.failureCount = 0
      this.tripCount++
      return true
    }
    return false
  }

  /**
   * Check if execution should proceed.
   * - CLOSED: always allow
   * - OPEN: check if reset timeout elapsed → transition to HALF_OPEN
   * - HALF_OPEN: allow up to halfOpenMaxAttempts
   */
  canExecute(): boolean {
    if (this.status === 'CLOSED') return true

    if (this.status === 'OPEN') {
      if (this.lastFailureTime &&
          Date.now() - this.lastFailureTime >= this.config.resetTimeoutMs) {
        this.status = 'HALF_OPEN'
        this.halfOpenAttempts = 0
        this.successCount = 0
        return true
      }
      return false
    }

    // HALF_OPEN
    const maxAttempts = this.config.halfOpenMaxAttempts ?? 3
    return this.halfOpenAttempts < maxAttempts
  }

  /** Increment the half-open attempt counter before executing a step. */
  markHalfOpenAttempt(): void {
    if (this.status === 'HALF_OPEN') {
      this.halfOpenAttempts++
    }
  }

  /** Get the current state snapshot for reporting. */
  getState(): CircuitBreakerState {
    return {
      status: this.status,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime
        ? new Date(this.lastFailureTime).toISOString()
        : undefined,
      nextAttemptTime: (this.status === 'OPEN' && this.lastFailureTime)
        ? new Date(this.lastFailureTime + this.config.resetTimeoutMs).toISOString()
        : undefined,
      tripCount: this.tripCount
    }
  }

  /** Check if the circuit is currently open (blocking execution). */
  isOpen(): boolean {
    return this.status === 'OPEN'
  }
}

// ─── Phase 2: Enhanced Backoff ───────────────────────────────────────────────

/**
 * Calculate retry delay with jitter and max cap support.
 *
 * @param baseDelay  - Base delay in ms
 * @param attempt    - 0-based attempt number
 * @param backoff    - Strategy: fixed, linear, exponential
 * @param jitter     - Add randomized jitter (±25%) to prevent thundering herd
 * @param maxDelay   - Cap the maximum delay (default 30s)
 */
export function calculateRetryDelay(
  baseDelay: number,
  attempt: number,
  backoff: 'fixed' | 'linear' | 'exponential',
  jitter: boolean = false,
  maxDelay: number = 30_000
): number {
  let delay: number
  switch (backoff) {
    case 'linear':
      delay = baseDelay * (attempt + 1)
      break
    case 'exponential':
      delay = baseDelay * Math.pow(2, attempt)
      break
    default: // fixed
      delay = baseDelay
      break
  }

  // Cap at max delay
  delay = Math.min(delay, maxDelay)

  // Add jitter: ±25% randomization
  if (jitter) {
    const jitterRange = delay * 0.25
    delay = delay - jitterRange + Math.random() * jitterRange * 2
  }

  return Math.max(0, Math.round(delay))
}

/**
 * Phase 18 — Minimal JSONPath getter.
 *
 * Supports the common subset:
 *   $            — root
 *   $.a.b.c      — dot access
 *   $.a[0]       — array index
 *   $.a[*]       — all array items (returns array)
 *   $.a.0.b      — numeric keys in dot form (convenience)
 *   $["a.b"]     — quoted key with literal dot
 *
 * Returns undefined if any segment misses. For `[*]` the caller gets back
 * the raw array and is responsible for stringifying it.
 */
export function jsonPathGet(obj: any, path: string): any {
  if (!path || path === '$') return obj
  let cleaned = path.startsWith('$.') ? path.slice(2) : path.startsWith('$') ? path.slice(1) : path
  if (cleaned.startsWith('.')) cleaned = cleaned.slice(1)

  const tokens: (string | number | '*')[] = []
  let i = 0
  let buf = ''
  while (i < cleaned.length) {
    const ch = cleaned[i]
    if (ch === '.') {
      if (buf) { tokens.push(/^-?\d+$/.test(buf) ? Number(buf) : buf); buf = '' }
      i++
      continue
    }
    if (ch === '[') {
      if (buf) { tokens.push(/^-?\d+$/.test(buf) ? Number(buf) : buf); buf = '' }
      const end = cleaned.indexOf(']', i)
      if (end < 0) return undefined
      const inside = cleaned.slice(i + 1, end).trim()
      if (inside === '*') tokens.push('*')
      else if (/^-?\d+$/.test(inside)) tokens.push(Number(inside))
      else tokens.push(inside.replace(/^['"]|['"]$/g, ''))
      i = end + 1
      continue
    }
    buf += ch
    i++
  }
  if (buf) tokens.push(/^-?\d+$/.test(buf) ? Number(buf) : buf)

  let current: any = obj
  for (const tok of tokens) {
    if (current == null) return undefined
    if (tok === '*') {
      if (!Array.isArray(current)) return undefined
      return current
    }
    if (typeof tok === 'number') {
      if (!Array.isArray(current)) return undefined
      const idx = tok < 0 ? current.length + tok : tok
      current = current[idx]
      continue
    }
    current = current[tok]
  }
  return current
}

/**
 * Phase 18 — Apply a transform pipeline to a raw string value.
 *
 * `transform` may be a single op or an array of ops applied in order.
 * Ops:
 *   trim | upper | lower | number | length
 *   jsonPath:$.a.b       — parse as JSON and extract
 *   regex:pattern        — first capture group (or full match if no groups)
 *   split:sep:index      — split by sep, take index (default 0)
 *   replace:find:with    — literal or `re:pattern` replace
 *   prefix:str           — prepend str
 *   suffix:str           — append str
 *
 * Errors are swallowed — a failed transform yields an empty string so a
 * downstream step can test with `var-empty` instead of blowing up the run.
 */
export function applyTransforms(raw: string, transform: string | string[] | undefined): string {
  if (!transform) return raw
  const ops = Array.isArray(transform) ? transform : [transform]
  let v: string = raw
  for (const op of ops) {
    if (!op) continue
    if (op === 'trim')                            v = v.trim()
    else if (op === 'upper' || op === 'uppercase') v = v.toUpperCase()
    else if (op === 'lower' || op === 'lowercase') v = v.toLowerCase()
    else if (op === 'number') {
      const n = Number(v)
      v = Number.isFinite(n) ? String(n) : ''
    }
    else if (op === 'length') v = String(v.length)
    else if (op.startsWith('jsonPath:')) {
      const path = op.slice('jsonPath:'.length)
      try {
        const parsed = JSON.parse(v)
        const picked = jsonPathGet(parsed, path)
        v = picked === undefined
          ? ''
          : typeof picked === 'string' ? picked : JSON.stringify(picked)
      } catch { v = '' }
    }
    else if (op.startsWith('regex:')) {
      const pat = op.slice('regex:'.length)
      try {
        const m = v.match(new RegExp(pat))
        v = m ? (m[1] ?? m[0] ?? '') : ''
      } catch { v = '' }
    }
    else if (op.startsWith('split:')) {
      const rest = op.slice('split:'.length)
      const firstColon = rest.indexOf(':')
      const sep = firstColon >= 0 ? rest.slice(0, firstColon) : rest
      const idx = firstColon >= 0 ? Number(rest.slice(firstColon + 1)) || 0 : 0
      const parts = v.split(sep || ',')
      v = parts[idx < 0 ? parts.length + idx : idx] ?? ''
    }
    else if (op.startsWith('replace:')) {
      const rest = op.slice('replace:'.length)
      const sepIdx = rest.indexOf(':')
      if (sepIdx > 0) {
        const find = rest.slice(0, sepIdx)
        const wth = rest.slice(sepIdx + 1)
        if (find.startsWith('re:')) {
          try { v = v.replace(new RegExp(find.slice(3), 'g'), wth) } catch { /* noop */ }
        } else {
          v = v.split(find).join(wth)
        }
      }
    }
    else if (op.startsWith('prefix:')) v = op.slice('prefix:'.length) + v
    else if (op.startsWith('suffix:')) v = v + op.slice('suffix:'.length)
    // Unknown ops are ignored silently to keep workflows forward-compatible.
  }
  return v
}

/** Per-profile network interception state. Each entry holds the rules and a
 *  reference to the handler so we can detach it on `clearIntercepts` or when
 *  the workflow ends. */
interface InterceptRule {
  urlPattern: string // glob-ish: '*' wildcards
  action: 'block' | 'mock' | 'modify'
  status?: number
  contentType?: string
  body?: string
  headers?: Record<string, string>
}

interface InterceptState {
  rules: InterceptRule[]
  handler: (req: any) => void
  enabled: boolean
}

/** Convert a glob pattern (`*` wildcards) to a RegExp. */
function globToRegex(glob: string): RegExp {
  const escaped = glob.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
  return new RegExp('^' + escaped + '$')
}

/** Tier 2: Debugger control surface attached to each running workflow.
 *  The renderer interacts with these via IPC (`workflows:debug:*`). */
interface DebugControl {
  abort: boolean
  /** Currently paused (manually or by breakpoint) */
  paused: boolean
  /** "Step over" requested — runner advances one step then re-pauses */
  stepOver: boolean
  /** Set of step ids that should pause execution before running */
  breakpoints: Set<string>
  /** Resolver to wait on while paused */
  resumeWaiter: (() => void) | null
}

export class AutomationEngine {
  private static instance: AutomationEngine
  private running = new Map<string, DebugControl>()
  /** Active network intercept state per profileId */
  private intercepts = new Map<string, InterceptState>()
  /** Tier 4: tracks the "active" page per profileId so switchTab can
   *  redirect subsequent steps without changing function signatures.
   *  Cleared when the run ends. */
  private currentPages = new Map<string, import('puppeteer-core').Page>()
  /** Tier 5: per-run execution hooks for before/after step, workflow lifecycle */
  private hooks = new Map<string, Array<{ event: string; handler: (data: any) => Promise<void> }>>()
  /** Tier 7: when set, every step that fails (after retries are exhausted)
   *  captures a screenshot to this directory. Set per run by executeWorkflow. */
  private failureScreenshotDir: string | null = null
  /** Active iframe context set by `switchFrame` action; null = main frame. */
  private activeFrame: import('puppeteer-core').Frame | null = null
  /** Phase 2: Per-run circuit breaker instances. Keyed by runKey. */
  private circuitBreakers = new Map<string, CircuitBreaker>()
  /** Phase 2: Per-run error context stacks. Keyed by runKey. */
  private errorStacks = new Map<string, ErrorContext[]>()
  /** Phase 3: Per-run AI recovery interventions. Keyed by runKey. */
  private aiInterventions = new Map<string, AiRecoveryIntervention[]>()
  /** Phase 3: Per-run AI recovery attempt counter. Keyed by runKey. */
  private aiRecoveryCount = new Map<string, number>()

  static getInstance(): AutomationEngine {
    if (!AutomationEngine.instance) {
      AutomationEngine.instance = new AutomationEngine()
    }
    return AutomationEngine.instance
  }

  /**
   * Phase 18.1: Pre-flight validation of regex patterns in workflow steps.
   * Catches invalid regex early instead of at runtime.
   */
  private validateWorkflowRegex(steps: AutomationStep[]): void {
    for (const step of steps) {
      // Check for regex in various action types
      if (step.action === 'whileLoop' && step.params?.pattern) {
        try {
          new RegExp(step.params.pattern as string)
        } catch (e: any) {
          throw new Error(
            `Invalid regex in step "${step.label}" (whileLoop pattern): ${e.message}`
          )
        }
      }

      if (step.action === 'waitForRequest' && step.params?.urlPattern && step.params?.regex === true) {
        try {
          new RegExp(step.params.urlPattern as string)
        } catch (e: any) {
          throw new Error(
            `Invalid regex in step "${step.label}" (waitForRequest urlPattern): ${e.message}`
          )
        }
      }

      if (step.action === 'waitForResponse' && step.params?.urlPattern && step.params?.regex === true) {
        try {
          new RegExp(step.params.urlPattern as string)
        } catch (e: any) {
          throw new Error(
            `Invalid regex in step "${step.label}" (waitForResponse urlPattern): ${e.message}`
          )
        }
      }

      if (step.action === 'waitForDownload' && step.params?.pattern) {
        try {
          new RegExp(step.params.pattern as string)
        } catch (e: any) {
          throw new Error(
            `Invalid regex in step "${step.label}" (waitForDownload pattern): ${e.message}`
          )
        }
      }

      // Recursively validate nested steps
      if (step.action === 'conditional' && step.params?.thenSteps) {
        this.validateWorkflowRegex(step.params.thenSteps)
      }
      if (step.action === 'conditional' && step.params?.elseSteps) {
        this.validateWorkflowRegex(step.params.elseSteps)
      }
      if (step.action === 'loop' && step.params?.steps) {
        this.validateWorkflowRegex(step.params.steps)
      }
      if (step.action === 'whileLoop' && step.params?.steps) {
        this.validateWorkflowRegex(step.params.steps)
      }
      if (step.action === 'forEachRow' && step.params?.steps) {
        this.validateWorkflowRegex(step.params.steps)
      }
      if (step.action === 'forEachElement' && step.params?.steps) {
        this.validateWorkflowRegex(step.params.steps)
      }
      if (step.action === 'tryCatch' && step.params?.tryBlock) {
        this.validateWorkflowRegex(step.params.tryBlock)
      }
      if (step.action === 'tryCatch' && step.params?.catchBlock) {
        this.validateWorkflowRegex(step.params.catchBlock)
      }
      if (step.action === 'tryCatch' && step.params?.finallyBlock) {
        this.validateWorkflowRegex(step.params.finallyBlock)
      }
      if (step.action === 'parallelSteps' && step.params?.steps) {
        this.validateWorkflowRegex(step.params.steps)
      }
    }
  }

  async executeWorkflow(
    workflowId: string,
    profileId: string,
    runtimeVars?: Record<string, string>,
    webContents?: WebContents,
    debugOpts?: {
      breakpoints?: string[]
      pauseAtStart?: boolean
      // Tier 7: global wall-clock cap; aborts the run if exceeded.
      maxDurationMs?: number
      // Tier 7: enable auto-screenshot on step failure to this directory.
      screenshotOnFailureDir?: string
      // Phase 17.H: abort the run if the pre-flight validator returns `block`.
      // Defaults to false — the renderer is expected to have surfaced the
      // validation card first, and explicit runs should be able to override.
      enforcePreFlight?: boolean
      // Phase 17.H: skip the pre-flight validator entirely (used by debug
      // runs and internal retries where the renderer has already validated).
      skipPreFlight?: boolean
    }
  ): Promise<AutomationRunResult> {
    const db = Database.getInstance()
    const bm = BrowserManager.getInstance()

    const workflowRow = db.getWorkflow(workflowId)
    if (!workflowRow) throw new Error(`Workflow ${workflowId} not found`)

    const workflow: AutomationWorkflow = {
      ...workflowRow,
      steps: JSON.parse(workflowRow.steps),
      variables: workflowRow.variables ? JSON.parse(workflowRow.variables) : undefined,
      variableDefinitions: workflowRow.variable_definitions ? JSON.parse(workflowRow.variable_definitions) : undefined,
      circuitBreaker: workflowRow.circuit_breaker ? JSON.parse(workflowRow.circuit_breaker) : undefined,
      aiRecovery: workflowRow.ai_recovery ? JSON.parse(workflowRow.ai_recovery) : undefined
    }

    // Phase 18.1: Pre-flight validation of regex patterns
    try {
      this.validateWorkflowRegex(workflow.steps)
    } catch (e: any) {
      throw new Error(`Workflow validation failed: ${e.message}`)
    }

    // Resolve profile name for built-in {profileName} variable
    let profileName = profileId
    let profileRowCached: any = null
    try {
      profileRowCached = db.getProfile(profileId)
      if (profileRowCached?.name) profileName = profileRowCached.name
    } catch { /* non-fatal */ }

    // ── Phase 17.H: Platform-Specific Detection Hardening ─────────────────
    // Run the pre-flight validator before we touch the browser.  The result
    // is streamed to the renderer via the `automation:pre-flight` event so
    // the UI can show the validator card + one-click fix buttons.  If the
    // verdict is `block` AND enforcePreFlight is true, we abort the run
    // with a descriptive error.  Otherwise the result is informational and
    // the workflow proceeds as before.
    let preFlight: PreFlightValidationResult | null = null
    if (!debugOpts?.skipPreFlight && profileRowCached) {
      try {
        preFlight = validatePreFlight(workflow, {
          id: profileRowCached.id,
          name: profileRowCached.name,
          fingerprint: profileRowCached.fingerprint,
        })
        if (webContents && !webContents.isDestroyed()) {
          try { webContents.send('automation:pre-flight', preFlight) } catch { /* non-fatal */ }
        }
        if (preFlight.verdict === 'block' && debugOpts?.enforcePreFlight) {
          const blockers = preFlight.issues
            .filter((i) => i.severity === 'critical')
            .map((i) => i.message)
            .join('; ')
          throw new Error(
            `Pre-flight validator blocked run: ${blockers || 'critical platform issues detected'}`
          )
        }
      } catch (err: any) {
        // Re-throw enforced blocks; swallow validator bugs so they never
        // prevent a workflow from running.
        if (err?.message?.startsWith('Pre-flight validator blocked')) throw err
        preFlight = null
      }
    }

    // Phase 1 Typed Variables: Initialize with definitions, legacy vars, runtime overrides, and built-ins
    const builtIns: Record<string, string> = {
      timestamp: new Date().toISOString(),
      runId: `${workflowId}:${profileId}`,
      random: Math.random().toString(36).slice(2),
      profileName
    }
    const { typedVars, stringVars: variables } = initializeTypedVariables(
      workflow.variableDefinitions,
      workflow.variables,
      runtimeVars,
      builtIns
    )

    if (!bm.isRunning(profileId)) {
      throw new Error('Profile must be launched before running automation')
    }

    const page = await this.getActivePage(profileId)
    if (!page) throw new Error('No active page found for profile')

    // Tier 4: seed the active-page pointer so switchTab can update it
    this.currentPages.set(profileId, page)

    const runKey = `${workflowId}:${profileId}`
    const control: DebugControl = {
      abort: false,
      paused: !!debugOpts?.pauseAtStart,
      stepOver: false,
      breakpoints: new Set(debugOpts?.breakpoints ?? []),
      resumeWaiter: null
    }
    this.running.set(runKey, control)

    // Phase 2: Initialize circuit breaker for this run (if configured)
    if (workflow.circuitBreaker) {
      this.circuitBreakers.set(runKey, new CircuitBreaker(workflow.circuitBreaker))
    }
    // Phase 2: Initialize error context stack for this run
    this.errorStacks.set(runKey, [])
    // Phase 3: Initialize AI recovery tracking for this run
    if (workflow.aiRecovery?.enabled) {
      this.aiInterventions.set(runKey, [])
      this.aiRecoveryCount.set(runKey, 0)
    }

    const startedAt = new Date().toISOString()
    const startedAtMs = Date.now()
    const stepResults: AutomationStepResult[] = []
    let status: 'completed' | 'failed' | 'stopped' = 'completed'
    let runError: string | undefined

    // Tier 7: enable failure-screenshot capture for this run.
    this.failureScreenshotDir = debugOpts?.screenshotOnFailureDir ?? null

    // Tier 7: global workflow timeout — schedule an abort timer that flips
    // control.abort when the wall-clock budget is exhausted.
    let globalTimer: NodeJS.Timeout | null = null
    let globalTimedOut = false
    if (debugOpts?.maxDurationMs && debugOpts.maxDurationMs > 0) {
      globalTimer = setTimeout(() => {
        globalTimedOut = true
        control.abort = true
      }, debugOpts.maxDurationMs)
    }

    // Tier 5: emit before-workflow hook
    await this.callHooks(runKey, 'before-workflow', {
      workflowId,
      profileId,
      profileName,
      stepCount: workflow.steps.length
    }).catch(() => { /* non-fatal */ })

    try {
      // Variables are interpolated lazily per-step (not upfront), so actions
      // like `solveCaptcha` can write into the map and have subsequent steps
      // pick up the new values via {captchaToken}-style placeholders.
      const result = await this.executeSteps(page, workflow.steps, control, stepResults, variables, webContents, workflowId, profileId, runKey, typedVars, workflow.variableDefinitions, workflow.aiRecovery)
      if (result === 'stopped') status = 'stopped'
      else if (result === 'failed') {
        status = 'failed'
        const lastFailed = stepResults.findLast((r) => !r.success)
        if (lastFailed) runError = lastFailed.error
      }
    } catch (err: any) {
      status = 'failed'
      runError = err.message
    } finally {
      if (globalTimer) clearTimeout(globalTimer)
      if (globalTimedOut) {
        status = 'failed'
        runError = `Workflow exceeded global timeout of ${debugOpts?.maxDurationMs}ms`
      }
      this.failureScreenshotDir = null
      this.running.delete(runKey)
      this.currentPages.delete(profileId)
      // Phase 2: circuit breaker cleanup is deferred until after metrics are collected
      // Tier 5: emit after-workflow hook
      await this.callHooks(runKey, 'after-workflow', {
        workflowId,
        profileId,
        status,
        stepCount: stepResults.length,
        error: runError
      }).catch(() => { /* non-fatal */ })
      // Clean up hooks for this run
      this.hooks.delete(runKey)
      // Tear down any network interception this run installed so it doesn't
      // leak into subsequent runs / manual browsing sessions.
      await this.teardownIntercepts(profileId, page).catch(() => { /* non-fatal */ })
    }

    const completedAt = new Date().toISOString()

    // Phase 2: Collect run metrics before cleaning up
    const errorStack = this.errorStacks.get(runKey) ?? []
    const cb = this.circuitBreakers.get(runKey)
    const interventions = this.aiInterventions.get(runKey)
    const metrics: AutomationRunMetrics = {
      totalAttempts: stepResults.reduce((sum, r) => {
        const retried = r.output?.retriedAfter ?? 0
        return sum + 1 + retried
      }, 0),
      retriedSteps: stepResults.filter(r => r.retryAttempt && r.retryAttempt > 0).length,
      circuitBreakerState: cb?.getState(),
      errorStack,
      aiInterventions: interventions && interventions.length > 0 ? interventions : undefined
    }

    // Phase 2 + 3: Cleanup run-scoped state
    this.circuitBreakers.delete(runKey)
    this.errorStacks.delete(runKey)
    this.aiInterventions.delete(runKey)
    this.aiRecoveryCount.delete(runKey)

    const runResult: AutomationRunResult = {
      workflowId,
      profileId,
      status,
      startedAt,
      completedAt,
      stepResults,
      error: runError,
      metrics
    }

    // Persist run to DB (Tier 2: includes started_at, duration, variables snapshot)
    db.addWorkflowRun({
      id: uuidv4(),
      workflow_id: workflowId,
      profile_id: profileId,
      status,
      step_results: stepResults,
      error: runError,
      started_at: startedAt,
      completed_at: completedAt,
      duration_ms: Date.now() - startedAtMs,
      variables
    })

    return runResult
  }

  // ── Tier 5: Workflow execution hooks ───────────────────────────────────

  /** Register a hook to be called at workflow lifecycle events.
   *  Available events: before-step, after-step, step-error, before-workflow, after-workflow.
   *  Returns an unsubscribe function. */
  onWorkflowEvent(
    runKey: string,
    event: string,
    handler: (data: any) => void | Promise<void>
  ): () => void {
    if (!this.hooks.has(runKey)) this.hooks.set(runKey, [])
    const list = this.hooks.get(runKey)!
    const entry = { event, handler: async (d: any) => handler(d) }
    list.push(entry)
    return () => {
      const idx = list.indexOf(entry)
      if (idx >= 0) list.splice(idx, 1)
    }
  }

  private async callHooks(runKey: string, event: string, data: any): Promise<void> {
    const list = this.hooks.get(runKey)
    if (!list) return
    for (const h of list) {
      if (h.event === event) {
        try { await h.handler(data) } catch { /* non-fatal */ }
      }
    }
  }

  // ── Tier 2: Debugger control surface ───────────────────────────────────

  /** Pause a running workflow at the next step boundary. */
  pauseWorkflow(workflowId: string, profileId: string): boolean {
    const ctrl = this.running.get(`${workflowId}:${profileId}`)
    if (!ctrl) return false
    ctrl.paused = true
    return true
  }

  /** Resume a paused workflow. */
  resumeWorkflow(workflowId: string, profileId: string): boolean {
    const ctrl = this.running.get(`${workflowId}:${profileId}`)
    if (!ctrl) return false
    ctrl.paused = false
    ctrl.stepOver = false
    if (ctrl.resumeWaiter) {
      const w = ctrl.resumeWaiter
      ctrl.resumeWaiter = null
      w()
    }
    return true
  }

  /** Run exactly one step then re-pause. */
  stepOverWorkflow(workflowId: string, profileId: string): boolean {
    const ctrl = this.running.get(`${workflowId}:${profileId}`)
    if (!ctrl) return false
    ctrl.stepOver = true
    ctrl.paused = false
    if (ctrl.resumeWaiter) {
      const w = ctrl.resumeWaiter
      ctrl.resumeWaiter = null
      w()
    }
    return true
  }

  /** Replace the breakpoint set for a running workflow. */
  setBreakpoints(workflowId: string, profileId: string, stepIds: string[]): boolean {
    const ctrl = this.running.get(`${workflowId}:${profileId}`)
    if (!ctrl) return false
    ctrl.breakpoints = new Set(stepIds)
    return true
  }

  /** Inspect a paused (or running) workflow's current state. */
  getDebugState(workflowId: string, profileId: string): {
    running: boolean
    paused: boolean
    breakpoints: string[]
  } | null {
    const ctrl = this.running.get(`${workflowId}:${profileId}`)
    if (!ctrl) return null
    return {
      running: true,
      paused: ctrl.paused,
      breakpoints: Array.from(ctrl.breakpoints)
    }
  }

  /** Wait while paused. Resolves when caller resumes / steps / aborts. */
  private async waitWhilePaused(control: DebugControl): Promise<void> {
    while (control.paused && !control.abort) {
      await new Promise<void>((resolve) => {
        control.resumeWaiter = resolve
      })
    }
  }

  // ── Tier 2: Dry-run validation ─────────────────────────────────────────

  /**
   * Validate a workflow without executing it. Checks for:
   * - unknown action types
   * - missing required params
   * - jumpToStep targets that don't exist in the same step list
   * - callWorkflow targets that don't exist in the database
   * - unresolved {variable} placeholders
   */
  dryRunWorkflow(workflowId: string, runtimeVars?: Record<string, string>): {
    valid: boolean
    issues: { stepId?: string; severity: 'error' | 'warning'; message: string }[]
    stepCount: number
  } {
    const db = Database.getInstance()
    const row = db.getWorkflow(workflowId)
    if (!row) throw new Error(`Workflow ${workflowId} not found`)

    const steps: AutomationStep[] = JSON.parse(row.steps)
    const storedVars: Record<string, string> = row.variables ? JSON.parse(row.variables) : {}
    const varDefs: VariableDefinition[] = row.variable_definitions ? JSON.parse(row.variable_definitions) : []
    const knownVars = new Set([
      ...Object.keys(storedVars),
      ...Object.keys(runtimeVars ?? {}),
      ...varDefs.map(d => d.name),
      'timestamp', 'runId', 'random', 'profileName'
    ])

    const issues: { stepId?: string; severity: 'error' | 'warning'; message: string }[] = []

    // Phase 1 Typed Variables: Validate variable definitions
    const validTypes = new Set<string>(['string', 'number', 'boolean', 'array', 'object'])
    for (const def of varDefs) {
      if (!def.name || typeof def.name !== 'string') {
        issues.push({ severity: 'error', message: `Variable definition missing name` })
      }
      if (!validTypes.has(def.type)) {
        issues.push({ severity: 'error', message: `Variable "${def.name}" has invalid type "${def.type}"` })
      }
      if (def.required && def.default === undefined && !storedVars[def.name]) {
        issues.push({ severity: 'warning', message: `Required variable "${def.name}" (${def.type}) has no default — must be provided at runtime` })
      }
    }

    // Required params per action type — keep tight: only the must-haves.
    const REQUIRED: Record<string, string[]> = {
      navigate: ['url'],
      click: ['selector'],
      doubleClick: ['selector'],
      rightClick: ['selector'],
      hover: ['selector'],
      type: ['selector', 'text'],
      waitForSelector: ['selector'],
      extractText: ['selector'],
      select: ['selector', 'value'],
      keyPress: ['key'],
      evaluate: ['script'],
      setAttribute: ['selector', 'attribute'],
      httpRequest: ['url'],
      upload: ['selector', 'filePath'],
      download: ['url', 'savePath'],
      solveCaptcha: ['siteKey'],
      injectCaptchaToken: ['token'],
      callWorkflow: ['workflowId'],
      jumpToStep: ['targetStepId'],
      interceptRequest: ['urlPattern'],
      setCookies: [],
      deleteCookies: [],
      getCookies: [],
      // Phase 18 — Data pipelines & advanced control flow
      extractJson: [],               // at least one of: variable | value | script | selector
      forEachElement: ['selector'],
      whileLoop: [],                 // condition validated by runtime
      waitForRequest: ['urlPattern'],
      waitForResponse: ['urlPattern'],
      paginate: ['nextSelector']
    }

    const KNOWN_ACTIONS = new Set([
      'navigate', 'click', 'doubleClick', 'rightClick', 'type', 'wait',
      'waitForSelector', 'waitForNavigation', 'screenshot', 'extractText',
      'scroll', 'select', 'keyPress', 'evaluate', 'hover', 'setAttribute',
      'httpRequest', 'upload', 'download', 'solveCaptcha', 'injectCaptchaToken',
      'useCredential', 'conditional', 'loop',
      'callWorkflow', 'parallelSteps', 'jumpToStep',
      'interceptRequest', 'clearIntercepts',
      'getCookies', 'setCookies', 'deleteCookies',
      // Tier 3-6 additions
      'assert',
      'openTab', 'switchTab', 'closeTab', 'getTabs',
      'switchProxy', 'clickByText',
      'getStorage', 'setStorage', 'clearStorage', 'queryIndexedDB',
      'forEachRow', 'readFile', 'writeFile', 'waitForDownload',
      // Tier 7
      'tryCatch',
      // Tier 9
      'dragAndDrop', 'keyCombo', 'selectContextMenu', 'setRangeInput', 'scrollIntoView', 'switchFrame',
      // Phase 18 — Data pipelines & advanced control flow
      'extractJson', 'forEachElement', 'whileLoop', 'waitForRequest', 'waitForResponse', 'paginate'
    ])

    // Pre-collect ids that produce variables so {var} references resolve.
    const producedVars = new Set<string>(knownVars)
    const collectProduced = (list: AutomationStep[]) => {
      for (const s of list) {
        if (s.params?.saveAs) producedVars.add(String(s.params.saveAs))
        if (s.action === 'useCredential') {
          const prefix = s.params?.prefix || 'cred'
          producedVars.add(`${prefix}.username`)
          producedVars.add(`${prefix}.password`)
        }
        // Phase 18: forEachElement exposes el.* variables inside its body
        if (s.action === 'forEachElement') {
          const prefix = s.params?.prefix || 'el'
          for (const k of ['index', 'total', 'text', 'html', 'tag', 'href', 'value', 'selector']) {
            producedVars.add(`${prefix}.${k}`)
          }
        }
        if (s.action === 'paginate') {
          producedVars.add('pg.index')
          producedVars.add('pg.count')
        }
        // Recurse into nested step containers
        if (Array.isArray(s.params?.thenSteps)) collectProduced(s.params.thenSteps)
        if (Array.isArray(s.params?.elseSteps)) collectProduced(s.params.elseSteps)
        if (Array.isArray(s.params?.steps)) collectProduced(s.params.steps)
        // Tier 7: tryCatch sub-blocks
        if (Array.isArray(s.params?.tryBlock))     collectProduced(s.params.tryBlock)
        if (Array.isArray(s.params?.catchBlock))   collectProduced(s.params.catchBlock)
        if (Array.isArray(s.params?.finallyBlock)) collectProduced(s.params.finallyBlock)
      }
    }
    collectProduced(steps)

    const validateStepList = (list: AutomationStep[], parentIds: Set<string>) => {
      const localIds = new Set(list.map((s) => s.id))
      for (const step of list) {
        // Unknown action
        if (!KNOWN_ACTIONS.has(step.action)) {
          issues.push({ stepId: step.id, severity: 'error', message: `Unknown action: ${step.action}` })
          continue
        }

        // Required params
        const reqs = REQUIRED[step.action] ?? []
        for (const r of reqs) {
          if (step.params == null || step.params[r] === undefined || step.params[r] === '') {
            issues.push({
              stepId: step.id,
              severity: 'error',
              message: `${step.action}: missing required param "${r}"`
            })
          }
        }

        // jumpToStep target must exist somewhere in the workflow tree.
        if (step.action === 'jumpToStep' && step.params?.targetStepId) {
          const target = String(step.params.targetStepId)
          if (!localIds.has(target) && !parentIds.has(target)) {
            issues.push({
              stepId: step.id,
              severity: 'error',
              message: `jumpToStep target "${target}" not found in workflow`
            })
          }
        }

        // callWorkflow target must exist in DB.
        if (step.action === 'callWorkflow' && step.params?.workflowId) {
          const targetId = String(step.params.workflowId)
          const target = db.getWorkflow(targetId)
          if (!target) {
            issues.push({
              stepId: step.id,
              severity: 'error',
              message: `callWorkflow: workflow "${targetId}" does not exist`
            })
          } else if (targetId === workflowId) {
            issues.push({
              stepId: step.id,
              severity: 'warning',
              message: 'callWorkflow targets itself — possible infinite recursion'
            })
          }
        }

        // Unresolved {variable} placeholders in any string param.
        try {
          const json = JSON.stringify(step.params ?? {})
          const refs = json.match(/\{([\w.]+)\}/g) ?? []
          for (const raw of refs) {
            const key = raw.slice(1, -1)
            if (!producedVars.has(key)) {
              issues.push({
                stepId: step.id,
                severity: 'warning',
                message: `${step.action}: references unknown variable "${key}"`
              })
            }
          }
        } catch { /* unstringifiable params, ignore */ }

        // Recurse
        const nextParents = new Set([...parentIds, ...localIds])
        if (Array.isArray(step.params?.thenSteps)) validateStepList(step.params.thenSteps, nextParents)
        if (Array.isArray(step.params?.elseSteps)) validateStepList(step.params.elseSteps, nextParents)
        if (Array.isArray(step.params?.steps)) validateStepList(step.params.steps, nextParents)
        // Tier 7: tryCatch sub-blocks
        if (Array.isArray(step.params?.tryBlock))     validateStepList(step.params.tryBlock, nextParents)
        if (Array.isArray(step.params?.catchBlock))   validateStepList(step.params.catchBlock, nextParents)
        if (Array.isArray(step.params?.finallyBlock)) validateStepList(step.params.finallyBlock, nextParents)
      }
    }

    validateStepList(steps, new Set())

    return {
      valid: issues.filter((i) => i.severity === 'error').length === 0,
      issues,
      stepCount: steps.length
    }
  }

  /** Execute a list of steps, collecting results. Returns overall status. */
  private async executeSteps(
    page: Page,
    steps: AutomationStep[],
    control: DebugControl | { abort: boolean },
    stepResults: AutomationStepResult[],
    variables: Record<string, string>,
    webContents?: WebContents,
    workflowId?: string,
    profileId?: string,
    runKey?: string,
    typedVars?: Map<string, TypedVariable>,
    variableDefinitions?: VariableDefinition[],
    aiRecovery?: AiRecoveryConfig
  ): Promise<'completed' | 'failed' | 'stopped'> {
    // Index-based iteration so `jumpToStep` can change the cursor.
    let i = 0
    let jumpsUsed = 0
    const MAX_JUMPS = 1000 // safety: prevent infinite jump loops

    // Tier 2: Detect debugger-aware control. Sub-step lists (loop bodies,
    // conditional branches, parallelSteps) reuse the parent control so
    // breakpoints work uniformly.
    const isDebug = (c: any): c is DebugControl => c && typeof c.paused === 'boolean'

    while (i < steps.length) {
      if (control.abort) return 'stopped'
      const step = steps[i]

      // Tier 2: pause if a breakpoint is set on this step (or paused manually)
      if (isDebug(control)) {
        if (control.breakpoints.has(step.id)) {
          control.paused = true
        }
        if (control.paused) {
          if (webContents && !webContents.isDestroyed()) {
            try {
              webContents.send('automation:paused', {
                workflowId,
                profileId,
                stepId: step.id,
                action: step.action,
                variables: { ...variables }
              })
            } catch { /* non-fatal */ }
          }
          await this.waitWhilePaused(control)
          if (control.abort) return 'stopped'
          if (webContents && !webContents.isDestroyed()) {
            try {
              webContents.send('automation:resumed', { workflowId, profileId, stepId: step.id })
            } catch { /* non-fatal */ }
          }
        }
      }

      // Interpolate this step's params lazily — variables may have been
      // mutated by an earlier step (e.g. solveCaptcha → {captchaToken}).
      const liveStep: AutomationStep = {
        ...step,
        params: interpolateParams(step.params, variables)
      }

      // Tier 5: emit before-step hook
      if (runKey) {
        await this.callHooks(runKey, 'before-step', {
        stepId: step.id,
        action: step.action,
        label: step.label ?? step.action,
        params: step.params
      }).catch(() => { /* non-fatal */ })
      }

      // Phase 2: Check circuit breaker before executing the step
      const cb = runKey ? this.circuitBreakers.get(runKey) : undefined
      if (cb && !cb.canExecute()) {
        const skipResult: AutomationStepResult = {
          stepId: step.id,
          action: step.action,
          success: false,
          duration_ms: 0,
          error: `Circuit breaker OPEN — step skipped (${cb.getState().tripCount} trip(s), next attempt at ${cb.getState().nextAttemptTime})`,
          errorCategory: 'unknown'
        }
        stepResults.push(skipResult)
        // Emit progress so the UI shows the skip
        if (webContents && !webContents.isDestroyed()) {
          try { webContents.send('automation:step-progress', { workflowId, profileId, step: skipResult }) } catch { /* non-fatal */ }
        }
        i++
        continue
      }
      if (cb) cb.markHalfOpenAttempt()

      const result = await this.executeStep(page, liveStep, control, stepResults, variables, profileId, typedVars, variableDefinitions, runKey)
      stepResults.push(result)

      // Phase 2: Feed result into circuit breaker
      if (cb) {
        if (result.success) {
          cb.recordSuccess()
        } else {
          const tripped = cb.recordFailure()
          if (tripped && webContents && !webContents.isDestroyed()) {
            try {
              webContents.send('automation:circuit-breaker', {
                workflowId, profileId,
                state: cb.getState(),
                triggerStep: step.id,
                triggerError: result.error
              })
            } catch { /* non-fatal */ }
          }
        }
      }

      // Tier 5: emit after-step hook (even on failure)
      if (runKey) {
        if (result.success) {
          await this.callHooks(runKey, 'after-step', {
          stepId: step.id,
          action: step.action,
          output: result.output,
          duration_ms: result.duration_ms
          }).catch(() => { /* non-fatal */ })
        } else {
          await this.callHooks(runKey, 'step-error', {
          stepId: step.id,
          action: step.action,
          error: result.error,
          errorCategory: result.errorCategory,
          duration_ms: result.duration_ms
          }).catch(() => { /* non-fatal */ })

          // ── Phase 17.H: Live adjustment on step failure ─────────────────
          // Feed the error message + current URL into the hardener's
          // runtime-signal analyzer. When a challenge pattern is detected
          // (captcha / slider / rate-limit / selector-miss) we surface a
          // recommended fix on the `automation:live-adjustment` channel so
          // the renderer can display a toast with a "Apply fix" action.
          if (workflowId && profileId && result.error) {
            try {
              let currentUrl: string | undefined
              try { currentUrl = page.url() } catch { /* closed page */ }
              const adjustment = analyzeRuntimeSignal({
                workflowId,
                profileId,
                currentUrl,
                kind: 'step-error',
                detail: `${step.action}: ${result.error}`,
              })
              if (adjustment) {
                await this.callHooks(runKey, 'live-adjustment', adjustment).catch(() => { /* non-fatal */ })
                if (webContents && !webContents.isDestroyed()) {
                  try { webContents.send('automation:live-adjustment', adjustment) } catch { /* non-fatal */ }
                }
              }
            } catch { /* non-fatal */ }
          }
        }
      }

      // Tier 2: re-pause after stepOver
      if (isDebug(control) && control.stepOver) {
        control.stepOver = false
        control.paused = true
      }

      // Stream live progress to renderer
      if (webContents && !webContents.isDestroyed()) {
        try {
          webContents.send('automation:step-progress', { workflowId, profileId, step: result })
        } catch { /* non-fatal */ }
      }

      if (!result.success) {
        // Tier 7: per-step onErrorGoto fallback — convert the failure into a
        // jump to the configured target step. The failed step is still
        // recorded in stepResults (auditable) but the run continues. Errors
        // are exposed via {error.message} so the recovery path can react.
        if (step.onErrorGoto) {
          const targetIdx = steps.findIndex((s) => s.id === step.onErrorGoto)
          if (targetIdx >= 0) {
            variables['error.message'] = result.error ?? 'Unknown error'
            variables['error.action'] = step.action
            variables['error.stepId'] = step.id
            jumpsUsed++
            if (jumpsUsed > MAX_JUMPS) {
              return 'failed'
            }
            i = targetIdx
            continue
          }
          // Target not found — fall through to normal failure
        }

        // ── Phase 3: AI Step Recovery ──────────────────────────────────────
        // When aiRecovery is enabled and the error is recoverable, ask the
        // AI to generate recovery steps and inject them. If recovery succeeds,
        // the workflow continues from the next step after the failed one.
        if (aiRecovery?.enabled && runKey && result.errorCategory) {
          const excluded = new Set(aiRecovery.excludeCategories ?? [])
          const maxPerRun = aiRecovery.maxRecoveriesPerRun ?? 5
          const currentCount = this.aiRecoveryCount.get(runKey) ?? 0

          if (!excluded.has(result.errorCategory) && currentCount < maxPerRun) {
            const recoveryStart = Date.now()
            try {
              // Build error context for the AI
              const errCtx: ErrorContext = result.errorContext?.[result.errorContext.length - 1] ?? {
                stepId: step.id,
                action: step.action,
                errorMessage: result.error ?? 'Unknown error',
                errorCategory: result.errorCategory,
                timestamp: new Date().toISOString(),
                attempt: 1
              }

              // Collect recent steps for context (last 3)
              const recentIdx = Math.max(0, i - 3)
              const recentSteps = steps.slice(recentIdx, i)

              const aiResult = await generateRecoverySteps(
                step,
                errCtx,
                recentSteps,
                aiRecovery.maxSteps ?? 3
              )

              // Notify the renderer of the AI intervention
              if (webContents && !webContents.isDestroyed()) {
                try {
                  webContents.send('automation:ai-recovery', {
                    workflowId, profileId,
                    failedStep: step.id,
                    recoverySteps: aiResult.steps.length,
                    reasoning: aiResult.reasoning,
                    confidence: aiResult.confidence
                  })
                } catch { /* non-fatal */ }
              }

              // Execute the recovery steps
              const recoveryResults: AutomationStepResult[] = []
              const recoveryStatus = await this.executeSteps(
                page, aiResult.steps, control, recoveryResults, variables,
                undefined, undefined, undefined, undefined, typedVars, variableDefinitions
              )

              const intervention: AiRecoveryIntervention = {
                failedStepId: step.id,
                failedAction: step.action,
                failureReason: result.error ?? 'Unknown',
                failureCategory: result.errorCategory,
                recoverySteps: aiResult.steps,
                success: recoveryStatus === 'completed',
                duration_ms: Date.now() - recoveryStart,
                timestamp: new Date().toISOString()
              }

              // Track the intervention
              const interventions = this.aiInterventions.get(runKey)
              if (interventions) interventions.push(intervention)
              this.aiRecoveryCount.set(runKey, currentCount + 1)

              // Add recovery step results to the main results
              stepResults.push(...recoveryResults)

              if (recoveryStatus === 'completed') {
                // Recovery succeeded — continue with the next step
                i++
                continue
              }
              // Recovery failed — fall through to normal failure
            } catch (aiErr: any) {
              // AI call failed (rate limit, API key, etc.) — non-fatal, fall through
              if (webContents && !webContents.isDestroyed()) {
                try {
                  webContents.send('automation:ai-recovery-error', {
                    workflowId, profileId,
                    failedStep: step.id,
                    error: aiErr.message ?? String(aiErr)
                  })
                } catch { /* non-fatal */ }
              }
            }
          }
        }

        return 'failed'
      }

      // Handle jumpToStep — the action stores the target step id in
      // `result.output.jumpTo` (or null if the condition wasn't met).
      const jumpTarget: string | undefined = result.output?.jumpTo
      if (jumpTarget) {
        const targetIdx = steps.findIndex((s) => s.id === jumpTarget)
        if (targetIdx < 0) {
          // Convert into a failed run so users notice the bad reference.
          stepResults[stepResults.length - 1] = {
            ...result,
            success: false,
            error: `jumpToStep target "${jumpTarget}" not found in workflow`
          }
          return 'failed'
        }
        jumpsUsed++
        if (jumpsUsed > MAX_JUMPS) {
          stepResults[stepResults.length - 1] = {
            ...result,
            success: false,
            error: `jumpToStep exceeded ${MAX_JUMPS} jumps (possible infinite loop)`
          }
          return 'failed'
        }
        i = targetIdx
        continue
      }

      i++
    }
    return 'completed'
  }

  stopWorkflow(workflowId: string, profileId: string): void {
    const runKey = `${workflowId}:${profileId}`
    const control = this.running.get(runKey)
    if (control) control.abort = true
  }

  isWorkflowRunning(workflowId: string, profileId: string): boolean {
    return this.running.has(`${workflowId}:${profileId}`)
  }

  /**
   * Phase 10.1 — Run a workflow against multiple profiles in parallel.
   * Each profile must already be launched. Failures on one profile do not
   * stop execution on the others — every profile produces an independent
   * AutomationRunResult.
   */
  async executeWorkflowParallel(
    workflowId: string,
    profileIds: string[],
    runtimeVars?: Record<string, string>,
    concurrency: number = 5,
    webContents?: WebContents
  ): Promise<AutomationRunResult[]> {
    if (profileIds.length === 0) return []

    const results: AutomationRunResult[] = []
    // Run in batches of `concurrency` so we don't overwhelm the host with
    // many simultaneous browser sessions.
    for (let i = 0; i < profileIds.length; i += concurrency) {
      const batch = profileIds.slice(i, i + concurrency)
      const settled = await Promise.allSettled(
        batch.map((pid) => this.executeWorkflow(workflowId, pid, runtimeVars, webContents))
      )
      for (let j = 0; j < settled.length; j++) {
        const r = settled[j]
        if (r.status === 'fulfilled') {
          results.push(r.value)
        } else {
          results.push({
            workflowId,
            profileId: batch[j],
            status: 'failed',
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            stepResults: [],
            error: String(r.reason?.message ?? r.reason)
          })
        }
      }
    }
    return results
  }

  /** Stop a parallel run by aborting all active controls for the workflow. */
  stopWorkflowAll(workflowId: string): number {
    let stopped = 0
    for (const [key, control] of this.running.entries()) {
      if (key.startsWith(`${workflowId}:`)) {
        control.abort = true
        stopped++
      }
    }
    return stopped
  }

  private async executeStep(
    page: Page,
    step: AutomationStep,
    control: DebugControl | { abort: boolean },
    allResults: AutomationStepResult[],
    variables: Record<string, string>,
    profileId?: string,
    typedVars?: Map<string, TypedVariable>,
    variableDefinitions?: VariableDefinition[],
    runKey?: string
  ): Promise<AutomationStepResult> {
    const start = Date.now()
    const { params } = step
    const maxAttempts = Math.max(1, (step.retries ?? 0) + 1)
    const baseDelay = step.retryDelay ?? 1000
    const backoff: 'fixed' | 'linear' | 'exponential' = step.retryBackoff ?? 'fixed'
    const jitter: boolean = step.retryJitter ?? false
    const maxDelay: number = step.retryMaxDelay ?? 30_000
    const retryOn: string[] | undefined = Array.isArray(step.retryOn) && step.retryOn.length > 0
      ? step.retryOn
      : undefined
    let lastError: string = ''
    let lastErrorCategory: ErrorCategory = 'unknown'
    let attemptsTaken = 0
    const attemptErrors: ErrorContext[] = []

    // Tier 7: Match an error against retryOn patterns. Each entry is treated
    // as a substring first, falling back to a regex if it parses.
    const matchesRetryOn = (msg: string): boolean => {
      if (!retryOn) return true
      for (const pat of retryOn) {
        if (!pat) continue
        if (msg.includes(pat)) return true
        try {
          if (new RegExp(pat, 'i').test(msg)) return true
        } catch { /* invalid regex — fall through */ }
      }
      return false
    }

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      attemptsTaken = attempt + 1
      if (control.abort) {
        return { stepId: step.id, action: step.action, success: false, duration_ms: Date.now() - start, error: 'Workflow stopped' }
      }
      try {
        // Tier 7: per-step timeout — race the action against a timer.
        const actionPromise = this.runAction(page, step, control, allResults, variables, profileId, typedVars, variableDefinitions)
        const output = step.timeoutMs && step.timeoutMs > 0
          ? await Promise.race([
              actionPromise,
              new Promise((_, rej) => setTimeout(
                () => rej(new Error(`Step timed out after ${step.timeoutMs}ms`)),
                step.timeoutMs
              ))
            ])
          : await actionPromise

        // Phase 1 Typed Variables: after a successful action, track any
        // saveAs variable in the typed-variable map so downstream steps
        // get type-aware values.
        const savedVariables: Record<string, { value: any; type: VariableType }> = {}
        if (params.saveAs && typedVars) {
          const rawValue = variables[params.saveAs]
          setTypedVariable(typedVars, variables, params.saveAs, rawValue, step.id, step.saveAsType, variableDefinitions)
          const tv = typedVars.get(params.saveAs)
          if (tv) savedVariables[params.saveAs] = { value: tv.value, type: tv.type }
        }

        return {
          stepId: step.id,
          action: step.action,
          success: true,
          duration_ms: Date.now() - start,
          output: attempt > 0 ? { ...(output as any), retriedAfter: attempt } : output,
          retryAttempt: attempt > 0 ? attempt : undefined,
          ...(Object.keys(savedVariables).length > 0 ? { savedVariables } : {})
        }
      } catch (err: any) {
        lastError = err.message ?? String(err)
        lastErrorCategory = categorizeError(lastError)

        // Phase 2: Capture error context for this attempt
        let pageUrl: string | undefined
        try { pageUrl = page.url() } catch { /* closed page */ }
        const errCtx: ErrorContext = {
          stepId: step.id,
          action: step.action,
          errorMessage: lastError,
          errorCategory: lastErrorCategory,
          timestamp: new Date().toISOString(),
          attempt: attemptsTaken,
          pageUrl,
          variableSnapshot: { ...variables }
        }
        attemptErrors.push(errCtx)

        // If retryOn is set and the error doesn't match, abort retries early.
        if (!matchesRetryOn(lastError)) break
        if (attempt < maxAttempts - 1) {
          // Phase 2: Enhanced backoff with jitter and max cap
          const delay = calculateRetryDelay(baseDelay, attempt, backoff, jitter, maxDelay)
          await new Promise((r) => setTimeout(r, delay))
        }
      }
    }

    // Tier 7: Auto-screenshot on final failure if the workflow opted in.
    let failureScreenshot: string | undefined
    if (this.failureScreenshotDir) {
      try {
        const fname = `${step.id}-${Date.now()}.png`
        const target = pathResolve(this.failureScreenshotDir, fname)
        await mkdir(dirname(target), { recursive: true })
        await page.screenshot({ path: target as `${string}.png`, fullPage: false })
        failureScreenshot = target
        // Annotate the last error context with the screenshot path
        if (attemptErrors.length > 0) {
          attemptErrors[attemptErrors.length - 1].screenshotPath = target
        }
      } catch { /* non-fatal */ }
    }

    // Phase 2: Push error contexts to the run-level error stack
    if (runKey) {
      const stack = this.errorStacks.get(runKey)
      if (stack) stack.push(...attemptErrors)
    }

    return {
      stepId: step.id,
      action: step.action,
      success: false,
      duration_ms: Date.now() - start,
      error: attemptsTaken > 1 ? `Failed after ${attemptsTaken} attempts: ${lastError}` : lastError,
      errorCategory: lastErrorCategory,
      errorContext: attemptErrors.length > 0 ? attemptErrors : undefined,
      retryAttempt: attemptsTaken > 1 ? attemptsTaken - 1 : undefined,
      output: failureScreenshot ? { failureScreenshot } : undefined
    }
  }

  private async runAction(
    _page: Page,
    step: AutomationStep,
    control: DebugControl | { abort: boolean },
    allResults: AutomationStepResult[],
    variables: Record<string, string>,
    profileId?: string,
    typedVars?: Map<string, TypedVariable>,
    variableDefinitions?: VariableDefinition[]
  ): Promise<any> {
    // Tier 4: switchTab may have changed the active page — always resolve here
    const page: Page = (profileId ? this.currentPages.get(profileId) : undefined) ?? _page
    const { action, params } = step

    switch (action) {
      case 'navigate':
        await page.goto(params.url, {
          waitUntil: params.waitUntil ?? 'networkidle2',
          timeout: params.timeout ?? 30000
        })
        return { url: params.url }

      case 'click':
        await page.waitForSelector(params.selector, { timeout: params.timeout ?? 10000 })
        await page.click(params.selector)
        return { selector: params.selector }

      case 'type':
        await page.waitForSelector(params.selector, { timeout: params.timeout ?? 10000 })
        if (params.clear) {
          await page.click(params.selector, { clickCount: 3 })
        }
        await page.type(params.selector, params.text, { delay: params.delay ?? 50 })
        return { selector: params.selector, length: params.text.length }

      case 'wait':
        await new Promise((r) => setTimeout(r, params.ms ?? 1000))
        return { waited_ms: params.ms ?? 1000 }

      case 'waitForSelector':
        await page.waitForSelector(params.selector, {
          visible: params.visible ?? true,
          timeout: params.timeout ?? 30000
        })
        return { selector: params.selector }

      case 'screenshot': {
        const buffer = await page.screenshot({
          fullPage: params.fullPage ?? false,
          type: 'png'
        })
        return { size: (buffer as Buffer).length }
      }

      case 'extractText': {
        const text = await page.$eval(
          params.selector,
          (el: Element) => el.textContent ?? ''
        )
        const trimmed = text.trim()
        // Phase 18: optional transform pipeline before saveAs
        const finalValue = applyTransforms(trimmed, params.transform)
        if (params.saveAs) variables[params.saveAs] = finalValue
        return { text: finalValue }
      }

      case 'scroll':
        await page.evaluate(
          (x: number, y: number) => window.scrollBy(x, y),
          params.x ?? 0,
          params.y ?? params.amount ?? 500
        )
        return { scrolled: true }

      case 'select':
        await page.select(params.selector, params.value)
        return { selector: params.selector, value: params.value }

      case 'keyPress':
        await page.keyboard.press(params.key)
        return { key: params.key }

      case 'evaluate': {
        // If switchFrame was called earlier, run in that frame's context.
        const evalCtx = this.activeFrame ?? page
        const result = await evalCtx.evaluate(params.script)
        const raw = result == null
          ? ''
          : typeof result === 'string' ? result : JSON.stringify(result)
        // Phase 18: optional transform pipeline
        const finalValue = applyTransforms(raw, params.transform)
        if (params.saveAs) variables[params.saveAs] = finalValue
        return { result }
      }

      // ── Phase 4 actions ──────────────────────────────────────────────

      case 'hover':
        await page.waitForSelector(params.selector, { timeout: params.timeout ?? 10000 })
        await page.hover(params.selector)
        return { selector: params.selector }

      case 'rightClick':
        await page.waitForSelector(params.selector, { timeout: params.timeout ?? 10000 })
        await page.click(params.selector, { button: 'right' })
        return { selector: params.selector }

      case 'setAttribute':
        await page.waitForSelector(params.selector, { timeout: params.timeout ?? 10000 })
        await page.$eval(
          params.selector,
          (el: Element, attr: string, val: string) => el.setAttribute(attr, val),
          params.attribute,
          params.value
        )
        return { selector: params.selector, attribute: params.attribute, value: params.value }

      case 'httpRequest': {
        const response = await this.makeHttpRequest(
          params.url,
          params.method ?? 'GET',
          params.headers,
          params.body
        )
        // Phase 18: `extractPath` pulls a JSONPath out of the response body
        // before applying any `transform` pipeline. Useful for REST APIs:
        //   { url, extractPath: '$.data.token', saveAs: 'authToken' }
        let toSave: string = response.body
        if (params.extractPath) {
          try {
            const parsed = JSON.parse(response.body)
            const picked = jsonPathGet(parsed, params.extractPath)
            toSave = picked === undefined
              ? ''
              : typeof picked === 'string' ? picked : JSON.stringify(picked)
          } catch {
            toSave = ''
          }
        }
        const finalValue = applyTransforms(toSave, params.transform)
        if (params.saveAs) variables[params.saveAs] = finalValue
        return { ...response, extracted: params.extractPath ? finalValue : undefined }
      }

      // ── Phase 12.B.3: File transfer ──────────────────────────────────

      case 'upload': {
        // Upload a local file into a <input type="file"> element
        await page.waitForSelector(params.selector, { timeout: params.timeout ?? 10000 })
        const handle = (await page.$(params.selector)) as ElementHandle<HTMLInputElement> | null
        if (!handle) throw new Error(`Element not found: ${params.selector}`)
        // Verify the file exists before handing it to puppeteer (clearer error)
        try {
          await stat(params.filePath)
        } catch {
          throw new Error(`File not found: ${params.filePath}`)
        }
        await handle.uploadFile(params.filePath)
        return { selector: params.selector, filePath: params.filePath }
      }

      case 'download': {
        // Stream a remote URL to disk, reusing the active session's cookies
        // so authenticated downloads work. Falls back to no cookies if the
        // page isn't on the same origin.
        const result = await this.downloadToFile(page, params.url, params.savePath, params.timeout ?? 60000)
        return result
      }

      case 'conditional': {
        const conditionType: string = params.conditionType ?? 'selector-exists'
        let matched = false

        if (conditionType === 'selector-exists') {
          matched = !!(await page.$(params.selector).catch(() => null))
        } else if (conditionType === 'text-equals' || conditionType === 'text-contains') {
          const text: string = await page
            .$eval(params.selector, (el: Element) => el.textContent ?? '')
            .catch(() => '')
          const trimmed = text.trim()
          matched = conditionType === 'text-equals'
            ? trimmed === (params.expected ?? '')
            : trimmed.includes(params.expected ?? '')
        } else if (conditionType === 'js-truthy') {
          matched = !!(await page.evaluate(params.script ?? 'false'))
        }

        const branch = matched ? (params.thenSteps ?? []) : (params.elseSteps ?? [])
        if (branch.length > 0) {
          const branchStatus = await this.executeSteps(page, branch, control, allResults, variables, undefined, undefined, undefined, undefined, typedVars, variableDefinitions, aiRecovery)
          if (branchStatus === 'stopped') throw new Error('Workflow stopped')
          if (branchStatus === 'failed') throw new Error('Conditional branch failed')
        }
        return { conditionType, matched, branchSteps: branch.length }
      }

      case 'loop': {
        const times = params.times ?? 1
        const loopSteps: AutomationStep[] = params.steps ?? []
        let iterations = 0
        for (let i = 0; i < times; i++) {
          if (control.abort) throw new Error('Workflow stopped')
          const loopStatus = await this.executeSteps(page, loopSteps, control, allResults, variables, undefined, undefined, undefined, undefined, typedVars, variableDefinitions, aiRecovery)
          if (loopStatus === 'stopped') throw new Error('Workflow stopped')
          if (loopStatus === 'failed') throw new Error(`Loop iteration ${i + 1} failed`)
          iterations++
        }
        return { iterations, totalSteps: loopSteps.length * times }
      }

      // ── Tier 7 RPA: Try / catch / finally block ─────────────────────

      case 'tryCatch': {
        // Execute params.tryBlock; on failure, expose the error in
        // variables (via configurable prefix, default 'error') and run
        // params.catchBlock. params.finallyBlock always runs at the end,
        // success or failure. Mirrors the JS try/catch/finally semantics.
        const tryBlock: AutomationStep[] = params.tryBlock ?? []
        const catchBlock: AutomationStep[] = params.catchBlock ?? []
        const finallyBlock: AutomationStep[] = params.finallyBlock ?? []
        const prefix: string = (params.errorPrefix ?? 'error').replace(/\.$/, '')

        // Snapshot the position in `allResults` so the catch/finally can see
        // the try block's results but the parent run's success status isn't
        // polluted by sub-failures the user explicitly opted to handle.
        const tryStartIdx = allResults.length
        let caught: string | null = null
        let tryStatus: 'completed' | 'failed' | 'stopped' = 'completed'

        try {
          tryStatus = await this.executeSteps(page, tryBlock, control, allResults, variables, undefined, undefined, undefined, undefined, typedVars, variableDefinitions, aiRecovery)
          if (tryStatus === 'stopped') throw new Error('Workflow stopped')
          if (tryStatus === 'failed') {
            // Pull the most recent failed result from the try-block window
            // for a meaningful error message.
            const failed = allResults.slice(tryStartIdx).findLast((r) => !r.success)
            caught = failed?.error ?? 'Unknown error in try block'
          }
        } catch (err: any) {
          tryStatus = 'failed'
          caught = err.message ?? String(err)
        }

        // Stop propagates immediately, even past finally
        if (control.abort) throw new Error('Workflow stopped')

        if (caught !== null) {
          // Inject {error.*} variables for the catch block
          variables[`${prefix}.message`] = caught
          variables[`${prefix}.caughtAt`] = new Date().toISOString()
          try {
            const catchStatus = await this.executeSteps(page, catchBlock, control, allResults, variables, undefined, undefined, undefined, undefined, typedVars, variableDefinitions, aiRecovery)
            if (catchStatus === 'stopped') throw new Error('Workflow stopped')
            // If the catch block ALSO fails, we re-throw — uncaught.
            if (catchStatus === 'failed') {
              const failedInCatch = allResults.findLast((r) => !r.success)
              throw new Error(`Catch block failed: ${failedInCatch?.error ?? 'unknown'}`)
            }
          } finally {
            // Cleanup the injected error variables once catch completes.
            delete variables[`${prefix}.message`]
            delete variables[`${prefix}.caughtAt`]
          }
        }

        if (finallyBlock.length > 0) {
          const finallyStatus = await this.executeSteps(page, finallyBlock, control, allResults, variables, undefined, undefined, undefined, undefined, typedVars, variableDefinitions, aiRecovery)
          if (finallyStatus === 'stopped') throw new Error('Workflow stopped')
          if (finallyStatus === 'failed') {
            const failedInFinally = allResults.findLast((r) => !r.success)
            throw new Error(`Finally block failed: ${failedInFinally?.error ?? 'unknown'}`)
          }
        }

        return {
          caught: caught !== null,
          error: caught,
          tryStepCount: tryBlock.length,
          catchStepCount: catchBlock.length,
          finallyStepCount: finallyBlock.length
        }
      }

      // ── Tier 9 RPA: Advanced element interactions ────────────────────

      case 'dragAndDrop': {
        // Smooth CDP mouse drag from `params.selector` to `params.targetSelector`.
        // Optional `params.steps` (default 20) controls trajectory granularity.
        // Optional `params.offsetX` / `params.offsetY` shift the drop point
        // relative to the target's centre.
        const srcEl = await page.$(params.selector)
        if (!srcEl) throw new Error(`dragAndDrop: source "${params.selector}" not found`)
        const tgtEl = await page.$(params.targetSelector)
        if (!tgtEl) throw new Error(`dragAndDrop: target "${params.targetSelector}" not found`)

        const srcBox = await srcEl.boundingBox()
        const tgtBox = await tgtEl.boundingBox()
        if (!srcBox || !tgtBox) throw new Error('dragAndDrop: element has no bounding box')

        const srcX = srcBox.x + srcBox.width / 2
        const srcY = srcBox.y + srcBox.height / 2
        const tgtX = tgtBox.x + tgtBox.width / 2 + (params.offsetX ?? 0)
        const tgtY = tgtBox.y + tgtBox.height / 2 + (params.offsetY ?? 0)
        const moveSteps = Math.max(5, Number(params.steps ?? 20))

        await page.mouse.move(srcX, srcY)
        await page.mouse.down()
        // Interpolate mouse movement for smooth drag trajectory
        for (let i = 1; i <= moveSteps; i++) {
          const x = srcX + (tgtX - srcX) * (i / moveSteps)
          const y = srcY + (tgtY - srcY) * (i / moveSteps)
          await page.mouse.move(x, y, { steps: 1 })
        }
        await page.mouse.up()
        return { from: { x: srcX, y: srcY }, to: { x: tgtX, y: tgtY }, steps: moveSteps }
      }

      case 'keyCombo': {
        // Send a keyboard shortcut such as "Control+a", "Control+Shift+t",
        // "Meta+v".  Keys are split on '+'; all but the last are held as
        // modifiers, the last is pressed then all modifiers are released in
        // reverse order — matching OS behaviour.
        if (!params.keys) throw new Error('keyCombo: `keys` param required (e.g. "Control+a")')
        const parts: string[] = (params.keys as string).split('+').map((k: string) => k.trim())
        if (parts.length === 0) throw new Error('keyCombo: empty key sequence')
        const modifiers = parts.slice(0, -1)
        const mainKey = parts[parts.length - 1]

        for (const mod of modifiers) await page.keyboard.down(mod as any)
        await page.keyboard.press(mainKey as any)
        for (const mod of [...modifiers].reverse()) await page.keyboard.up(mod as any)

        return { keys: params.keys }
      }

      case 'selectContextMenu': {
        // Right-click `params.selector`, wait for a context menu to appear,
        // then click the first visible element whose text matches
        // `params.menuItemText` (exact match by default; set `exact: false`
        // for a contains check).
        if (!params.selector) throw new Error('selectContextMenu: `selector` required')
        if (!params.menuItemText) throw new Error('selectContextMenu: `menuItemText` required')
        const exact: boolean = params.exact !== false

        await page.click(params.selector, { button: 'right' })
        // Brief pause for context menu animation / DOM insertion
        await new Promise((r) => setTimeout(r, params.menuDelay ?? 300))

        const menuItem: ElementHandle | null = await page.evaluateHandle(
          (text: string, exactMatch: boolean) => {
            const candidates = Array.from(
              document.querySelectorAll<HTMLElement>('li, a, button, [role="menuitem"], [role="option"]')
            )
            return (
              candidates.find((el) => {
                const t = (el.textContent ?? '').trim()
                const visible = !!(el.offsetParent || el.getBoundingClientRect().width)
                return visible && (exactMatch ? t === text : t.includes(text))
              }) ?? null
            )
          },
          params.menuItemText as string,
          exact
        ).then((h) => (h.asElement() as ElementHandle | null))

        if (!menuItem) {
          throw new Error(`selectContextMenu: menu item "${params.menuItemText}" not found`)
        }
        await menuItem.click()
        return { clicked: params.menuItemText }
      }

      case 'setRangeInput': {
        // Set an <input type="range"> (slider) to a precise numeric value and
        // dispatch the events React / Vue / vanilla handlers expect.
        if (!params.selector) throw new Error('setRangeInput: `selector` required')
        const value = Number(params.value ?? 0)

        await page.$eval(
          params.selector,
          (el: Element, val: number) => {
            const input = el as HTMLInputElement
            // Use the native setter to bypass React's controlled-input guard
            const nativeSetter = Object.getOwnPropertyDescriptor(
              HTMLInputElement.prototype,
              'value'
            )?.set
            if (nativeSetter) nativeSetter.call(input, val)
            else input.value = String(val)
            input.dispatchEvent(new Event('input', { bubbles: true }))
            input.dispatchEvent(new Event('change', { bubbles: true }))
          },
          value
        )
        if (params.saveAs) variables[params.saveAs] = String(value)
        return { value }
      }

      case 'scrollIntoView': {
        // Scroll an element into the viewport.  Uses `scrollIntoView` with
        // `block: 'center'` so the element lands in the middle of the screen
        // rather than at the edge — more reliable for subsequent interactions.
        if (!params.selector) throw new Error('scrollIntoView: `selector` required')
        await page.waitForSelector(params.selector, { timeout: params.timeout ?? 30000 })
        const behavior: string = params.behavior ?? 'smooth'
        await page.$eval(
          params.selector,
          (el: Element, beh: string) => {
            el.scrollIntoView({ behavior: beh as ScrollBehavior, block: 'center', inline: 'center' })
          },
          behavior
        )
        // Allow CSS scroll animation to finish before the next step
        if (behavior === 'smooth') await new Promise((r) => setTimeout(r, 350))
        return { scrolled: params.selector }
      }

      case 'switchFrame': {
        // Enter or exit an iframe context.
        //
        // To enter:  supply `selector` (CSS/XPath for the <iframe> element),
        //            `index` (0-based position in page.frames()), or
        //            `urlPattern` (regex string matched against frame.url()).
        // To exit:   set `exit: true` → restores the main-frame context.
        //
        // The resolved frame is stored in `this.activeFrame`.  Subsequent
        // `evaluate` steps automatically run inside the active frame context.
        if (params.exit) {
          this.activeFrame = null
          return { frame: 'main' }
        }

        let targetFrame: import('puppeteer-core').Frame | null = null

        if (params.selector) {
          const frameEl = await page.waitForSelector(params.selector, {
            timeout: params.timeout ?? 10000
          })
          if (!frameEl) throw new Error(`switchFrame: selector "${params.selector}" not found`)
          targetFrame = await (frameEl as ElementHandle).contentFrame()
        } else if (params.index !== undefined) {
          const frames = page.frames()
          const idx = Number(params.index)
          if (idx >= frames.length) {
            throw new Error(`switchFrame: index ${idx} out of range (${frames.length} frames)`)
          }
          targetFrame = frames[idx]
        } else if (params.urlPattern) {
          const regex = new RegExp(params.urlPattern as string)
          targetFrame = page.frames().find((f) => regex.test(f.url())) ?? null
        } else {
          throw new Error('switchFrame: supply `selector`, `index`, `urlPattern`, or `exit: true`')
        }

        if (!targetFrame) throw new Error('switchFrame: no matching frame found')
        this.activeFrame = targetFrame
        if (params.saveAs) variables[params.saveAs] = targetFrame.url()
        return { frameUrl: targetFrame.url() }
      }

      // ── Tier 6 RPA: Data-driven automation & file handling ──────────

      case 'forEachRow': {
        // Load a CSV or JSON file (or inline JSON via params.rows) and run
        // `params.steps` once per row. Each row's columns are exposed as
        // `{row.column}` placeholders for the duration of that iteration.
        // Optional `prefix` overrides the `row.` namespace (e.g. `item.`).
        // `failFast: true` (default) aborts on first iteration error;
        // `false` collects errors and continues.
        const innerSteps: AutomationStep[] = params.steps ?? []
        const prefix: string = (params.prefix ?? 'row').replace(/\.$/, '')
        const failFast: boolean = params.failFast !== false
        const limit: number = Number(params.limit ?? 0)

        let rows: Record<string, any>[] = []
        if (Array.isArray(params.rows)) {
          rows = params.rows
        } else if (params.filePath) {
          const filePath: string = validateFilePath(params.filePath)
          let raw: string
          try {
            raw = await fsReadFile(filePath, 'utf-8')
          } catch (e: any) {
            throw new Error(`forEachRow: cannot read ${filePath}: ${e.message}`)
          }
          const ext = (extname(filePath) || '').toLowerCase()
          if (ext === '.json') {
            const parsed = JSON.parse(raw)
            if (!Array.isArray(parsed)) {
              throw new Error('forEachRow: JSON file must contain an array of row objects')
            }
            rows = parsed
          } else {
            // CSV — minimal RFC 4180 parser supporting quoted fields, CRLF,
            // and embedded commas/newlines/quotes (escaped by doubling).
            rows = parseCsv(raw, params.delimiter ?? ',')
          }
        } else {
          throw new Error('forEachRow: requires `filePath` or inline `rows` array')
        }

        if (limit > 0 && rows.length > limit) {
          rows = rows.slice(0, limit)
        }

        const errors: { index: number; error: string }[] = []
        let completed = 0
        for (let idx = 0; idx < rows.length; idx++) {
          if (control.abort) throw new Error('Workflow stopped')
          const row = rows[idx] ?? {}
          // Snapshot the prior values so we can restore them on the next
          // iteration (avoid leaking row.X variables out of the loop).
          const injected: string[] = []
          for (const [k, v] of Object.entries(row)) {
            const key = `${prefix}.${k}`
            variables[key] = v == null ? '' : String(v)
            injected.push(key)
          }
          variables[`${prefix}._index`] = String(idx)
          variables[`${prefix}._total`] = String(rows.length)
          injected.push(`${prefix}._index`, `${prefix}._total`)

          try {
            const status = await this.executeSteps(page, innerSteps, control, allResults, variables, undefined, undefined, undefined, undefined, typedVars, variableDefinitions, aiRecovery)
            if (status === 'stopped') throw new Error('Workflow stopped')
            if (status === 'failed') throw new Error(`Iteration ${idx + 1} failed`)
            completed++
          } catch (err: any) {
            errors.push({ index: idx, error: err.message ?? String(err) })
            if (failFast) {
              // Cleanup injected vars before bailing out
              for (const k of injected) delete variables[k]
              throw err
            }
          } finally {
            // Remove this iteration's row.* variables to prevent leakage
            // into subsequent iterations / outer scope.
            for (const k of injected) delete variables[k]
          }
        }

        return {
          rowCount: rows.length,
          completed,
          failed: errors.length,
          errors: errors.slice(0, 20) // cap reported errors
        }
      }

      case 'readFile': {
        // Read a text file into a workflow variable. Defaults to UTF-8.
        // Optional `parse: 'json'` parses the contents and stores the
        // serialized JSON string (consumers can re-parse if needed).
        // Paths are restricted to userData directory for security.
        if (!params.filePath) throw new Error('readFile: filePath required')
        const filePath = validateFilePath(params.filePath)
        const enc: BufferEncoding = (params.encoding ?? 'utf-8') as BufferEncoding
        const text = await fsReadFile(filePath, enc)
        let value: string = String(text)
        if (params.parse === 'json') {
          try {
            value = JSON.stringify(JSON.parse(value))
          } catch (e: any) {
            throw new Error(`readFile: invalid JSON in ${params.filePath}: ${e.message}`)
          }
        }
        if (params.saveAs) variables[params.saveAs] = value
        return {
          filePath: params.filePath,
          bytes: Buffer.byteLength(value, enc),
          savedAs: params.saveAs ?? null
        }
      }

      case 'writeFile': {
        // Write `params.content` to disk. Supports `append: true` and
        // automatic parent-directory creation. Returns bytes written.
        // Paths are restricted to userData directory for security.
        if (!params.filePath) throw new Error('writeFile: filePath required')
        const filePath = validateFilePath(params.filePath)
        const content: string = params.content ?? ''
        const enc: BufferEncoding = (params.encoding ?? 'utf-8') as BufferEncoding
        await mkdir(dirname(filePath), { recursive: true })
        if (params.append) {
          await fsAppendFile(filePath, content, enc)
        } else {
          await fsWriteFile(filePath, content, enc)
        }
        return {
          filePath: filePath,
          bytes: Buffer.byteLength(content, enc),
          mode: params.append ? 'append' : 'write'
        }
      }

      case 'waitForDownload': {
        // Wait for a file to appear in the download directory. Polls the
        // filesystem since puppeteer-core's CDP `Browser.downloadProgress`
        // event isn't reliably wired across all Chromium revisions.
        // Either `filePath` (exact match) or `directory` + `pattern` regex.
        const timeoutMs: number = Number(params.timeout ?? 60000)
        const pollMs: number = Number(params.pollInterval ?? 500)
        const start = Date.now()

        if (params.filePath) {
          const target: string = params.filePath
          while (Date.now() - start < timeoutMs) {
            if (control.abort) throw new Error('Workflow stopped')
            try {
              const s = await stat(target)
              if (s.size > 0) {
                // Wait one more poll to ensure the file isn't still being
                // written (size unchanged across two polls).
                await new Promise((r) => setTimeout(r, pollMs))
                const s2 = await stat(target)
                if (s2.size === s.size) {
                  if (params.saveAs) variables[params.saveAs] = target
                  return { filePath: target, bytes: s2.size, waited_ms: Date.now() - start }
                }
              }
            } catch { /* not yet */ }
            await new Promise((r) => setTimeout(r, pollMs))
          }
          throw new Error(`waitForDownload: timed out waiting for ${target}`)
        }

        if (!params.directory) {
          throw new Error('waitForDownload: requires `filePath` or `directory` (+ optional `pattern`)')
        }
        const dir: string = params.directory
        const pattern = params.pattern ? new RegExp(params.pattern) : null
        const { readdir } = await import('fs/promises')
        // Snapshot the directory so we only match newly-created files.
        let baseline: Set<string>
        try {
          baseline = new Set(await readdir(dir))
        } catch (e: any) {
          throw new Error(`waitForDownload: cannot read directory ${dir}: ${e.message}`)
        }

        while (Date.now() - start < timeoutMs) {
          if (control.abort) throw new Error('Workflow stopped')
          try {
            const entries = await readdir(dir)
            const fresh = entries.filter((f) => !baseline.has(f))
            const matches = pattern ? fresh.filter((f) => pattern.test(f)) : fresh
            // Skip Chromium's `.crdownload` partials
            const finished = matches.filter((f) => !f.endsWith('.crdownload') && !f.endsWith('.tmp'))
            if (finished.length > 0) {
              const fresh0 = finished[0]
              const full = pathResolve(dir, fresh0)
              const s = await stat(full)
              if (params.saveAs) variables[params.saveAs] = full
              return { filePath: full, bytes: s.size, waited_ms: Date.now() - start }
            }
          } catch { /* ignore */ }
          await new Promise((r) => setTimeout(r, pollMs))
        }
        throw new Error(`waitForDownload: timed out waiting in ${dir}`)
      }

      // ── Phase 12.B.1: Captcha solving ───────────────────────────────

      case 'solveCaptcha': {
        // Resolve which provider + key to use. `params.provider` overrides
        // the global default; `params.apiKey` overrides the stored key.
        const settings = getSettings()
        const providerId: CaptchaProviderId =
          (params.provider as CaptchaProviderId) || settings.captcha.defaultProvider
        const apiKey: string = params.apiKey || settings.captcha.apiKeys[providerId] || ''
        if (!apiKey) {
          throw new Error(
            `Captcha provider "${providerId}" has no API key — configure it in Settings or pass apiKey in step params`
          )
        }
        const solver = getSolver(providerId)
        const pageUrl: string = params.pageUrl || page.url()
        const type: string = params.type || 'recaptcha-v2'

        let result: SolveResult
        switch (type) {
          case 'recaptcha-v2':
            result = await solver.solveRecaptchaV2(apiKey, {
              siteKey: params.siteKey,
              pageUrl,
              invisible: !!params.invisible
            })
            break
          case 'recaptcha-v3':
            result = await solver.solveRecaptchaV3(apiKey, {
              siteKey: params.siteKey,
              pageUrl,
              action: params.action || 'verify',
              minScore: params.minScore
            })
            break
          case 'hcaptcha':
            result = await solver.solveHCaptcha(apiKey, {
              siteKey: params.siteKey,
              pageUrl
            })
            break
          case 'image':
            result = await solver.solveImage(apiKey, { imageBase64: params.imageBase64 })
            break
          default:
            throw new Error(`Unknown captcha type: ${type}`)
        }

        // Persist the token into the live variables map so subsequent steps
        // can reference it via {captchaToken} (or whatever key was requested).
        const saveAs: string = params.saveAs || 'captchaToken'
        variables[saveAs] = result.token

        return {
          provider: result.provider,
          type: result.type,
          taskId: result.taskId,
          duration_ms: result.duration_ms,
          tokenLength: result.token.length,
          savedAs: saveAs
        }
      }

      // ── Phase 12.C.3: Vault-backed credential injection ─────────────
      case 'useCredential': {
        const vault = getVault()
        if (!vault.isUnlocked()) {
          throw new Error('Vault is locked — unlock it from the Settings page first')
        }
        const id: string | undefined = params.id
        const label: string | undefined = params.label
        let cred
        if (id) {
          cred = vault.get(id)
        } else if (label) {
          const list = vault.list()
          cred = list.find((c) => c.label === label)
          if (!cred) throw new Error(`Vault credential "${label}" not found`)
        } else {
          throw new Error('useCredential requires either id or label')
        }

        // Phase 18.1: Audit log credential access for compliance
        const db = Database.getInstance()
        try {
          db.addAuditEntry({
            id: uuidv4(),
            user_id: 'system',  // TODO: Get from IPC context
            user_name: 'automation',
            action: 'credential_access',
            target_id: cred.id,
            target_name: cred.label
          })
        } catch (auditErr) {
          // Log audit failure but don't fail the workflow
          console.error('[useCredential] Failed to record audit log:', auditErr)
        }

        const prefix: string = params.prefix || 'cred'
        variables[`${prefix}.username`] = cred.username
        variables[`${prefix}.password`] = cred.password
        for (const [k, v] of Object.entries(cred.fields ?? {})) {
          variables[`${prefix}.${k}`] = String(v)
        }
        return {
          loaded: true,
          label: cred.label,
          prefix,
          fields: Object.keys(cred.fields ?? {}).length
        }
      }

      case 'injectCaptchaToken': {
        // Inject a previously-solved token into the standard reCAPTCHA / hCaptcha
        // hidden textarea so the form submit picks it up. Selector defaults to
        // the canonical reCAPTCHA hidden field.
        const token: string = params.token
        if (!token) throw new Error('injectCaptchaToken requires a token (use {captchaToken})')
        const selector: string = params.selector || '#g-recaptcha-response'
        const injected = await page.evaluate(
          (sel: string, value: string) => {
            const el = document.querySelector(sel) as HTMLTextAreaElement | HTMLInputElement | null
            if (!el) return { found: false, count: 0 }
            // Both reCAPTCHA and hCaptcha hide their textarea with display:none — set
            // the value directly and dispatch a synthetic event so any listeners notice.
            ;(el as any).value = value
            el.style.display = 'block'
            el.dispatchEvent(new Event('input', { bubbles: true }))
            el.dispatchEvent(new Event('change', { bubbles: true }))
            return { found: true, count: 1 }
          },
          selector,
          token
        )
        if (!injected.found) throw new Error(`Captcha target selector not found: ${selector}`)
        return { selector, tokenLength: token.length }
      }

      case 'doubleClick':
        await page.waitForSelector(params.selector, { timeout: params.timeout ?? 10000 })
        await page.click(params.selector, { clickCount: 2 })
        return { selector: params.selector }

      case 'waitForNavigation':
        await page.waitForNavigation({
          waitUntil: params.waitUntil ?? 'networkidle2',
          timeout: params.timeout ?? 30000
        })
        return { waitUntil: params.waitUntil ?? 'networkidle2' }

      // ── Tier 1: Workflow chaining ───────────────────────────────────
      case 'callWorkflow': {
        // Execute another workflow's steps inline using the current page
        // and variables map. Useful for building reusable sub-workflows
        // (login, cookie check, retry helpers).
        const targetId: string = params.workflowId
        if (!targetId) throw new Error('callWorkflow requires workflowId')

        const db = Database.getInstance()
        const row = db.getWorkflow(targetId)
        if (!row) throw new Error(`callWorkflow: workflow ${targetId} not found`)
        const subSteps: AutomationStep[] = JSON.parse(row.steps)
        const subVars: Record<string, string> =
          row.variables ? JSON.parse(row.variables) : {}

        // Optional input variables provided by the caller override the
        // sub-workflow's stored defaults but live in a scoped copy so
        // they don't leak back into the parent.
        const inputVars: Record<string, string> = params.inputVars ?? {}
        const childVars: Record<string, string> = {
          ...subVars,
          ...variables, // parent variables visible by default
          ...inputVars
        }

        const childResults: AutomationStepResult[] = []
        // Phase 1: Child workflows inherit parent typed vars + child definitions
        const childRow = row.variable_definitions ? JSON.parse(row.variable_definitions) : undefined
        const childStatus = await this.executeSteps(
          page, subSteps, control, childResults, childVars,
          undefined, undefined, undefined, undefined, typedVars, childRow ?? variableDefinitions, aiRecovery
        )

        // Merge selected outputs back into parent variables under a prefix.
        const outputPrefix: string | undefined = params.outputPrefix
        if (outputPrefix) {
          for (const [k, v] of Object.entries(childVars)) {
            // Only export keys that didn't exist in the parent — these were
            // produced by the sub-workflow.
            if (!(k in variables)) {
              variables[`${outputPrefix}.${k}`] = v
            }
          }
        }

        if (childStatus === 'stopped') throw new Error('Sub-workflow stopped')
        if (childStatus === 'failed') {
          const failed = childResults.findLast((r) => !r.success)
          throw new Error(
            `Sub-workflow "${row.name}" failed${failed ? `: ${failed.error}` : ''}`
          )
        }
        return {
          workflowId: targetId,
          name: row.name,
          steps: childResults.length,
          status: childStatus
        }
      }

      // ── Tier 1: Parallel step execution ─────────────────────────────
      case 'parallelSteps': {
        // Run a list of independent steps concurrently against the same
        // page. The caller is responsible for ensuring the steps don't
        // race on the same DOM nodes — typical usage is N independent
        // extractText / httpRequest steps.
        const branchSteps: AutomationStep[] = params.steps ?? []
        if (branchSteps.length === 0) return { ran: 0 }

        const settled = await Promise.allSettled(
          branchSteps.map((s) => {
            const liveStep: AutomationStep = {
              ...s,
              params: interpolateParams(s.params, variables)
            }
            return this.executeStep(page, liveStep, control, allResults, variables, profileId, typedVars, variableDefinitions, undefined)
          })
        )

        const results: AutomationStepResult[] = []
        let failures = 0
        for (let idx = 0; idx < settled.length; idx++) {
          const r = settled[idx]
          if (r.status === 'fulfilled') {
            results.push(r.value)
            if (!r.value.success) failures++
          } else {
            failures++
            results.push({
              stepId: branchSteps[idx].id,
              action: branchSteps[idx].action,
              success: false,
              duration_ms: 0,
              error: String(r.reason?.message ?? r.reason)
            })
          }
        }

        // Append child results to the parent results trail for visibility.
        for (const r of results) allResults.push(r)

        const failFast = params.failFast !== false // default true
        if (failures > 0 && failFast) {
          throw new Error(`parallelSteps: ${failures}/${results.length} step(s) failed`)
        }
        return { ran: results.length, failures }
      }

      // ── Tier 1: Output-driven branching ─────────────────────────────
      case 'jumpToStep': {
        // Conditionally instruct the runner to jump the cursor to another
        // step by id. Returns `jumpTo` in `output` which the executor
        // inspects to perform the jump.
        const conditionType: string =
          params.conditionType ?? 'var-equals'
        const variable: string = params.variable ?? ''
        const value: string = String(variables[variable] ?? '')
        const expected: string = String(params.expected ?? '')
        let matched = false

        switch (conditionType) {
          case 'always':
            matched = true
            break
          case 'var-equals':
            matched = value === expected
            break
          case 'var-not-equals':
            matched = value !== expected
            break
          case 'var-contains':
            matched = value.includes(expected)
            break
          case 'var-truthy':
            matched = value !== '' && value !== '0' && value !== 'false'
            break
          case 'var-empty':
            matched = value === '' || value === 'undefined' || value === 'null'
            break
          case 'var-gt':
            matched = Number(value) > Number(expected)
            break
          case 'var-lt':
            matched = Number(value) < Number(expected)
            break
          default:
            throw new Error(`Unknown jumpToStep conditionType: ${conditionType}`)
        }

        return {
          conditionType,
          variable,
          value,
          expected,
          matched,
          jumpTo: matched ? params.targetStepId : undefined
        }
      }

      // ── Tier 1: Network interception ────────────────────────────────
      case 'interceptRequest': {
        // Install a request interceptor for the active page. Multiple
        // rules can be added; each call appends a rule unless `replace`
        // is true. Tear down via `clearIntercepts` or workflow end.
        const rule: InterceptRule = {
          urlPattern: params.urlPattern ?? '*',
          action: params.action ?? 'block',
          status: params.status ?? 200,
          contentType: params.contentType ?? 'application/json',
          body: params.body ?? '',
          headers: params.headers ?? {}
        }
        const replace: boolean = params.replace === true

        const pid = profileId ?? '_anon'
        let state = this.intercepts.get(pid)

        if (!state || replace) {
          // Detach previous handler before re-installing
          if (state) {
            try { page.off('request', state.handler as any) } catch { /* noop */ }
          }
          await page.setRequestInterception(true).catch((err) => {
            throw new Error(`Failed to enable request interception: ${err.message}`)
          })

          const handler = (req: any) => {
            try {
              const url: string = req.url()
              const current = this.intercepts.get(pid)
              if (!current || !current.enabled) {
                req.continue().catch(() => { /* noop */ })
                return
              }
              // First matching rule wins
              const matched = current.rules.find((r) => globToRegex(r.urlPattern).test(url))
              if (!matched) {
                req.continue().catch(() => { /* noop */ })
                return
              }
              if (matched.action === 'block') {
                req.abort('blockedbyclient').catch(() => { /* noop */ })
              } else if (matched.action === 'mock') {
                req.respond({
                  status: matched.status ?? 200,
                  contentType: matched.contentType ?? 'application/json',
                  headers: matched.headers ?? {},
                  body: matched.body ?? ''
                }).catch(() => { /* noop */ })
              } else if (matched.action === 'modify') {
                // Forward but with modified headers
                req.continue({
                  headers: { ...req.headers(), ...(matched.headers ?? {}) }
                }).catch(() => { /* noop */ })
              } else {
                req.continue().catch(() => { /* noop */ })
              }
            } catch {
              try { req.continue() } catch { /* noop */ }
            }
          }

          state = { rules: replace ? [rule] : [rule], handler, enabled: true }
          page.on('request', handler)
          this.intercepts.set(pid, state)
        } else {
          state.rules.push(rule)
        }
        return { rules: state.rules.length, urlPattern: rule.urlPattern, action: rule.action }
      }

      case 'clearIntercepts': {
        const pid = profileId ?? '_anon'
        await this.teardownIntercepts(pid, page)
        return { cleared: true }
      }

      // ── Tier 1: Cookie management ───────────────────────────────────
      case 'getCookies': {
        const url: string | undefined = params.url
        const cookies = url
          ? await page.cookies(url)
          : await page.cookies()
        if (params.saveAs) {
          variables[params.saveAs] = JSON.stringify(cookies)
        }
        return { count: cookies.length, cookies }
      }

      case 'setCookies': {
        // Accept either a `cookies` array param or a JSON string in `json`
        let list: any[] = []
        if (Array.isArray(params.cookies)) list = params.cookies
        else if (typeof params.json === 'string' && params.json.trim()) {
          try { list = JSON.parse(params.json) } catch (err: any) {
            throw new Error(`setCookies: invalid JSON — ${err.message}`)
          }
        } else if (params.name) {
          list = [{
            name: params.name,
            value: params.value ?? '',
            domain: params.domain,
            path: params.path ?? '/',
            url: params.url,
            secure: params.secure,
            httpOnly: params.httpOnly,
            sameSite: params.sameSite,
            expires: params.expires
          }]
        }
        if (list.length === 0) throw new Error('setCookies: no cookies provided')
        // Strip undefined fields so puppeteer accepts the payload
        const cleaned = list.map((c) => {
          const out: Record<string, any> = {}
          for (const [k, v] of Object.entries(c)) if (v !== undefined) out[k] = v
          return out
        })
        await page.setCookie(...(cleaned as any[]))
        return { set: cleaned.length }
      }

      case 'deleteCookies': {
        // Delete by name (single or array). If `all` is true, clear every
        // cookie visible to the current page.
        if (params.all) {
          const all = await page.cookies()
          if (all.length > 0) await page.deleteCookie(...all)
          return { deleted: all.length, mode: 'all' }
        }
        const names: string[] = Array.isArray(params.names)
          ? params.names
          : params.name
            ? [params.name]
            : []
        if (names.length === 0) throw new Error('deleteCookies: provide name, names[], or all=true')
        const targets = names.map((n) => ({
          name: n,
          url: params.url,
          domain: params.domain,
          path: params.path
        }))
        await page.deleteCookie(...(targets as any[]))
        return { deleted: targets.length, names }
      }

      // ── Tier 3: Assertion framework ─────────────────────────────────
      case 'assert': {
        const assertType: AssertType = params.assertType ?? 'element-exists'
        const onFail: 'stop' | 'warn' | 'continue' = params.onFail ?? 'stop'
        let passed = false
        let actual: string | undefined
        let failureMessage = ''
        const expected: string = String(params.expected ?? '')

        switch (assertType) {
          case 'element-exists': {
            const el = await page.$(params.selector ?? '').catch(() => null)
            passed = el !== null
            actual = passed ? 'found' : 'not found'
            if (!passed) failureMessage = `Expected "${params.selector}" to exist`
            break
          }
          case 'element-not-exists': {
            const el = await page.$(params.selector ?? '').catch(() => null)
            passed = el === null
            actual = passed ? 'not found' : 'found'
            if (!passed) failureMessage = `Expected "${params.selector}" to NOT exist`
            break
          }
          case 'text-equals':
          case 'text-contains':
          case 'text-not-contains': {
            actual = await page
              .$eval(params.selector ?? 'body', (el: Element) => el.textContent ?? '')
              .catch(() => '')
            actual = actual.trim()
            if (assertType === 'text-equals') {
              passed = actual === expected
              if (!passed) failureMessage = `Expected text "${expected}", got "${actual}"`
            } else if (assertType === 'text-contains') {
              passed = actual.includes(expected)
              if (!passed) failureMessage = `Expected text to contain "${expected}", got "${actual}"`
            } else {
              passed = !actual.includes(expected)
              if (!passed) failureMessage = `Expected text NOT to contain "${expected}"`
            }
            break
          }
          case 'url-matches': {
            actual = page.url()
            const regex = new RegExp(expected)
            passed = regex.test(actual)
            if (!passed) failureMessage = `URL "${actual}" does not match /${expected}/`
            break
          }
          case 'url-contains': {
            actual = page.url()
            passed = actual.includes(expected)
            if (!passed) failureMessage = `URL "${actual}" does not contain "${expected}"`
            break
          }
          case 'variable-equals': {
            const varName: string = params.variable ?? ''
            actual = variables[varName] ?? ''
            passed = actual === expected
            if (!passed) failureMessage = `Variable "${varName}" is "${actual}", expected "${expected}"`
            break
          }
          case 'variable-contains': {
            const varName: string = params.variable ?? ''
            actual = variables[varName] ?? ''
            passed = actual.includes(expected)
            if (!passed) failureMessage = `Variable "${varName}" ("${actual}") does not contain "${expected}"`
            break
          }
          case 'variable-truthy': {
            const varName: string = params.variable ?? ''
            actual = variables[varName] ?? ''
            passed = actual !== '' && actual !== '0' && actual !== 'false' && actual !== 'null' && actual !== 'undefined'
            if (!passed) failureMessage = `Variable "${varName}" is falsy: "${actual}"`
            break
          }
          case 'element-count': {
            const els = await page.$$(params.selector ?? '')
            actual = String(els.length)
            const op: string = params.operator ?? 'eq'
            const count = Number(expected)
            if (op === 'eq') passed = els.length === count
            else if (op === 'gt') passed = els.length > count
            else if (op === 'gte') passed = els.length >= count
            else if (op === 'lt') passed = els.length < count
            else if (op === 'lte') passed = els.length <= count
            else passed = els.length === count
            if (!passed) failureMessage = `Expected ${params.selector} count ${op} ${count}, got ${els.length}`
            break
          }
          case 'page-title-contains': {
            actual = await page.title()
            passed = actual.includes(expected)
            if (!passed) failureMessage = `Page title "${actual}" does not contain "${expected}"`
            break
          }
          case 'js-truthy': {
            const result = await page.evaluate(params.script ?? 'false')
            actual = String(result)
            passed = !!result
            if (!passed) failureMessage = `Script returned falsy: ${actual}`
            break
          }
          default:
            throw new Error(`Unknown assertType: ${assertType}`)
        }

        const assertResult: AssertResult = {
          assertType,
          passed,
          failureMessage,
          actual,
          expected: expected || undefined
        }

        if (!passed) {
          if (onFail === 'stop') throw new Error(failureMessage || `Assertion failed: ${assertType}`)
          if (onFail === 'warn') {
            // Mark as succeeded but include failure info so the UI shows a warning badge
            return { ...assertResult, warning: true }
          }
          // onFail === 'continue': swallow, return failed result without throwing
          return { ...assertResult, continued: true }
        }
        return assertResult
      }

      // ── Tier 4: Multi-tab management ────────────────────────────────

      case 'openTab': {
        // Open a new tab in the profile's browser, inject fingerprint, and
        // optionally navigate to a URL. The new tab becomes the active page.
        if (!profileId) throw new Error('openTab requires a profileId context')
        const bm = BrowserManager.getInstance()
        const session = (bm as any).sessions.get(profileId)
        if (!session) throw new Error('openTab: profile session not found')

        const db = Database.getInstance()
        const profileRow: any = db.getProfile(profileId)
        if (!profileRow) throw new Error('openTab: profile not found in DB')
        const fingerprint = JSON.parse(profileRow.fingerprint)

        const newPage = await session.browser.newPage()
        // Inject fingerprint scripts so the new tab has the same identity
        try {
          const injector = (bm as any).injector
          if (injector) await injector.injectAll(newPage, fingerprint)
        } catch { /* non-fatal — tab still opens */ }

        const url: string | undefined = params.url
        if (url) {
          await newPage.goto(url, {
            waitUntil: params.waitUntil ?? 'networkidle2',
            timeout: params.timeout ?? 30000
          })
        }

        // Make the new tab the active page for subsequent steps
        this.currentPages.set(profileId, newPage)

        const pages = await session.browser.pages()
        const tabIndex = pages.indexOf(newPage)
        if (params.saveAs) variables[params.saveAs] = String(tabIndex)
        return { tabIndex, url: newPage.url(), totalTabs: pages.length }
      }

      case 'switchTab': {
        // Switch the active page to the tab identified by index, URL pattern,
        // or title pattern.
        if (!profileId) throw new Error('switchTab requires a profileId context')
        const bm = BrowserManager.getInstance()
        const session = (bm as any).sessions.get(profileId)
        if (!session) throw new Error('switchTab: profile session not found')

        const pages: Page[] = (await session.browser.pages()).filter((p: Page) => !p.isClosed())
        if (pages.length === 0) throw new Error('switchTab: no open tabs')

        let targetPage: Page | undefined

        if (params.index !== undefined) {
          const idx = Number(params.index)
          if (idx < 0 || idx >= pages.length) {
            throw new Error(`switchTab: tab index ${idx} out of range (0–${pages.length - 1})`)
          }
          targetPage = pages[idx]
        } else if (params.urlPattern) {
          const re = new RegExp(String(params.urlPattern))
          targetPage = pages.find((p: Page) => re.test(p.url()))
          if (!targetPage) throw new Error(`switchTab: no tab matches urlPattern "${params.urlPattern}"`)
        } else if (params.titlePattern) {
          const re = new RegExp(String(params.titlePattern))
          const titles = await Promise.all(pages.map((p: Page) => p.title()))
          const matchIdx = titles.findIndex((t) => re.test(t))
          if (matchIdx < 0) throw new Error(`switchTab: no tab matches titlePattern "${params.titlePattern}"`)
          targetPage = pages[matchIdx]
        } else {
          throw new Error('switchTab: provide index, urlPattern, or titlePattern')
        }

        this.currentPages.set(profileId, targetPage)
        if (params.saveAs) variables[params.saveAs] = targetPage.url()
        return { url: targetPage.url(), title: await targetPage.title() }
      }

      case 'closeTab': {
        // Close the current tab (or a tab by index) and switch focus to the
        // next available tab. Refuses to close the last remaining tab.
        if (!profileId) throw new Error('closeTab requires a profileId context')
        const bm = BrowserManager.getInstance()
        const session = (bm as any).sessions.get(profileId)
        if (!session) throw new Error('closeTab: profile session not found')

        const pages: Page[] = (await session.browser.pages()).filter((p: Page) => !p.isClosed())
        if (pages.length <= 1) throw new Error('closeTab: cannot close the last tab')

        let tabToClose: Page
        if (params.index !== undefined) {
          const idx = Number(params.index)
          if (idx < 0 || idx >= pages.length) throw new Error(`closeTab: tab index ${idx} out of range`)
          tabToClose = pages[idx]
        } else {
          // Close whichever tab is currently active
          tabToClose = this.currentPages.get(profileId) ?? pages[pages.length - 1]
        }

        const closedUrl = tabToClose.url()
        await tabToClose.close()

        // Switch active page to the last remaining open tab
        const remaining: Page[] = (await session.browser.pages()).filter((p: Page) => !p.isClosed())
        const nextPage = remaining[remaining.length - 1]
        this.currentPages.set(profileId, nextPage)
        return { closedUrl, activatedUrl: nextPage.url(), remaining: remaining.length }
      }

      case 'getTabs': {
        // List all open tabs for the current profile.
        if (!profileId) throw new Error('getTabs requires a profileId context')
        const bm = BrowserManager.getInstance()
        const session = (bm as any).sessions.get(profileId)
        if (!session) throw new Error('getTabs: profile session not found')

        const pages: Page[] = (await session.browser.pages()).filter((p: Page) => !p.isClosed())
        const tabs = await Promise.all(
          pages.map(async (p: Page, i: number) => ({
            index: i,
            url: p.url(),
            title: await p.title(),
            isActive: p === (this.currentPages.get(profileId) ?? pages[pages.length - 1])
          }))
        )
        if (params.saveAs) variables[params.saveAs] = JSON.stringify(tabs)
        return { tabs, count: tabs.length }
      }

      // ── Tier 4: Proxy rotation mid-workflow ─────────────────────────

      case 'switchProxy': {
        // Change the proxy in use for the current workflow.
        //
        // Architectural limitation: Chromium's `--proxy-server` flag is set at
        // launch time and cannot be changed for an existing browser process.
        // What we CAN do per-session:
        //   1. Update proxy auth via page.authenticate() (covers HTTP proxy auth).
        //   2. Store the new proxy values in workflow variables so subsequent
        //      `httpRequest` steps pick them up.
        //   3. Persist the change to the profile's proxy_id so the NEXT launch
        //      uses the new proxy.
        //
        // For applications requiring true per-request proxy rotation, use the
        // `httpRequest` action with explicit `headers` / proxy settings.
        const db = Database.getInstance()
        let proxyRow: any = null

        if (params.proxyId) {
          proxyRow = db.getProxy(params.proxyId)
          if (!proxyRow) throw new Error(`switchProxy: proxy "${params.proxyId}" not found`)
        } else if (params.strategy === 'random') {
          proxyRow = db.getRandomProxy()
          if (!proxyRow) throw new Error('switchProxy: no proxies available')
        } else if (params.strategy === 'round-robin' && profileId) {
          const profileRow: any = db.getProfile(profileId)
          proxyRow = db.getNextProxy(profileRow?.proxy_id ?? '')
          if (!proxyRow) throw new Error('switchProxy: no proxies available for round-robin')
        } else {
          throw new Error('switchProxy: provide proxyId or strategy (random | round-robin)')
        }

        // 1. Update proxy auth on the current page if credentials present
        if (proxyRow.username && proxyRow.password) {
          await page.authenticate({ username: proxyRow.username, password: proxyRow.password })
        }

        // 2. Expose proxy details in workflow variables
        const prefix: string = params.prefix || 'proxy'
        variables[`${prefix}.host`] = proxyRow.host
        variables[`${prefix}.port`] = String(proxyRow.port)
        variables[`${prefix}.type`] = proxyRow.type
        if (proxyRow.username) variables[`${prefix}.username`] = proxyRow.username
        if (proxyRow.password) variables[`${prefix}.password`] = proxyRow.password

        // 3. Persist to profile so next launch uses this proxy
        if (profileId && params.persistToProfile !== false) {
          db.updateProfileProxy(profileId, proxyRow.id)
        }

        return {
          proxyId: proxyRow.id,
          name: proxyRow.name,
          host: proxyRow.host,
          port: proxyRow.port,
          type: proxyRow.type,
          note: '--proxy-server takes effect on next profile launch; auth updated for current session'
        }
      }

      // ── Tier 4: Text-based click (DOM XPath) ────────────────────────

      case 'clickByText': {
        // Find the first visible element whose text content (or ARIA label)
        // matches the given string, then click its centre.
        //
        // Strategy flow:
        //   1. XPath text() search — exact or contains match
        //   2. aria-label attribute match
        //   3. placeholder / title attribute match
        //   4. If `clickCoordinates` is true and nothing found, falls back to
        //      a best-effort coordinate click at the position where the text was
        //      visually located (requires the text to be visible in the viewport).
        //
        // No OCR dependency is required for text rendered as DOM nodes (99% of
        // cases). For canvas-rendered text, use the `evaluate` action.
        const text: string = params.text
        if (!text) throw new Error('clickByText requires text param')
        const exact: boolean = params.exact === true
        const timeout: number = params.timeout ?? 10000
        const clickCount: number = params.clickCount ?? 1

        // Build XPath — prefer exact first, fall back to contains
        const xpathExact = `//*[normalize-space(text())="${text}" or normalize-space(.)="${text}"]`
        const xpathContains = `//*[contains(normalize-space(text()),"${text}") or contains(normalize-space(.),"${text}")]`
        const xpath = exact ? xpathExact : xpathContains

        // Wait for matching element to appear
        await page.waitForFunction(
          (xp: string, vis: boolean) => {
            const result = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null)
            const el = result.singleNodeValue as HTMLElement | null
            if (!el) return false
            if (!vis) return true
            const rect = el.getBoundingClientRect()
            return rect.width > 0 && rect.height > 0
          },
          { timeout },
          xpath,
          params.visible !== false // default: require visible
        ).catch(() => { throw new Error(`clickByText: no element found with text "${text}"`) })

        // Find and click
        const clicked: boolean = await page.evaluate(
          (xp: string, count: number, btn: string) => {
            const result = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null)
            const el = result.singleNodeValue as HTMLElement | null
            if (!el) return false
            // Use dispatchEvent for synthetic click — more reliable in SPAs
            for (let i = 0; i < count; i++) {
              el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: btn === 'right' ? 2 : 0 }))
            }
            return true
          },
          xpath,
          clickCount,
          params.button ?? 'left'
        )

        if (!clicked) throw new Error(`clickByText: element disappeared before click — text "${text}"`)

        // Optionally save the matched element's selector to a variable
        if (params.saveAs) {
          const sel: string = await page.evaluate((xp: string) => {
            const result = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null)
            const el = result.singleNodeValue as HTMLElement | null
            if (!el) return ''
            if (el.id) return `#${el.id}`
            if (el.getAttribute('data-testid')) return `[data-testid="${el.getAttribute('data-testid')}"]`
            return el.tagName.toLowerCase()
          }, xpath)
          variables[params.saveAs] = sel
        }

        return { text, exact, clickCount, button: params.button ?? 'left' }
      }

      // ── Tier 5: Storage inspection ──────────────────────────────────

      case 'getStorage': {
        // Tier 5: read localStorage, sessionStorage, or IndexedDB keys.
        const type: string = params.type ?? 'localStorage' // 'localStorage' | 'sessionStorage'
        const saveAs: string = params.saveAs
        const storage: Record<string, string> = {}
        try {
          const data = await page.evaluate((t: string) => {
            if (t === 'localStorage') return { ...localStorage }
            if (t === 'sessionStorage') return { ...sessionStorage }
            return {}
          }, type)
          Object.assign(storage, data as any)
        } catch { /* non-fatal */ }
        if (saveAs) variables[saveAs] = JSON.stringify(storage)
        return { type, count: Object.keys(storage).length, keys: Object.keys(storage) }
      }

      case 'setStorage': {
        // Tier 5: write key-value pairs to localStorage or sessionStorage.
        const type: string = params.type ?? 'localStorage'
        const key: string = params.key
        const value: string = params.value
        if (!key) throw new Error('setStorage requires key param')
        await page.evaluate((t: string, k: string, v: string) => {
          const store = t === 'localStorage' ? localStorage : sessionStorage
          store.setItem(k, v)
        }, type, key, value)
        return { type, key, value }
      }

      case 'clearStorage': {
        // Tier 5: clear all keys from localStorage, sessionStorage, or both.
        const type: string = params.type ?? 'all' // 'all' | 'localStorage' | 'sessionStorage'
        await page.evaluate((t: string) => {
          if (t === 'all' || t === 'localStorage') localStorage.clear()
          if (t === 'all' || t === 'sessionStorage') sessionStorage.clear()
        }, type)
        return { type, cleared: true }
      }

      case 'queryIndexedDB': {
        // Tier 5: read-only IndexedDB inspection.
        // Returns list of databases + store names without querying individual records.
        // (Full record enumeration would require passing IndexedDB cursors through page.evaluate.)
        const databases: any[] = await page.evaluate(() => {
          // Non-standard: indexedDB.databases() is Chrome 124+
          return (indexedDB as any).databases?.() ?? []
        }).catch(() => [])
        const summary = {
          databases: databases.map((db: any) => db.name),
          count: databases.length
        }
        if (params.saveAs) variables[params.saveAs] = JSON.stringify(summary)
        return summary
      }

      // ── Phase 18: Data pipelines & advanced control flow ────────────

      case 'extractJson': {
        // Pull a nested field out of a JSON source using a JSONPath expression.
        // Source priority: `variable` > `value` > `script` (page.evaluate) >
        // `selector` (read textContent). The result is stringified into the
        // target variable (or the step return value) so downstream steps can
        // reference it as any other variable.
        let raw: string = ''
        if (params.variable) {
          raw = variables[params.variable] ?? ''
        } else if (typeof params.value === 'string') {
          raw = params.value
        } else if (params.script) {
          const evalCtx = this.activeFrame ?? page
          const result = await evalCtx.evaluate(params.script)
          raw = typeof result === 'string' ? result : JSON.stringify(result ?? '')
        } else if (params.selector) {
          raw = await page
            .$eval(params.selector, (el: Element) => el.textContent ?? '')
            .catch(() => '')
          raw = raw.trim()
        } else {
          throw new Error('extractJson: provide one of variable, value, script, or selector')
        }

        if (!raw) {
          const def: string = params.default ?? ''
          if (params.saveAs) variables[params.saveAs] = def
          return { path: params.path ?? '$', found: false, value: def }
        }

        let parsed: any
        try {
          parsed = JSON.parse(raw)
        } catch (e: any) {
          if (params.optional) {
            const def: string = params.default ?? ''
            if (params.saveAs) variables[params.saveAs] = def
            return { path: params.path ?? '$', found: false, value: def, parseError: e.message }
          }
          throw new Error(`extractJson: invalid JSON — ${e.message}`)
        }

        const path: string = params.path ?? '$'
        const extracted = jsonPathGet(parsed, path)
        const asString = extracted === undefined
          ? (params.default ?? '')
          : typeof extracted === 'string'
            ? extracted
            : JSON.stringify(extracted)
        const finalValue = applyTransforms(asString, params.transform)
        if (params.saveAs) variables[params.saveAs] = finalValue
        return { path, found: extracted !== undefined, value: finalValue }
      }

      case 'forEachElement': {
        // Iterate over every DOM element matching `params.selector`.
        //
        // IMPORTANT: Use {el.selector} in inner steps to reliably reference the
        // current element, even if the DOM mutates. Example:
        //   step 'click' { selector: '{el.selector}' }
        //
        // Inside the inner steps the current element is exposed via variables:
        //   {el.index}     — 0-based position
        //   {el.total}     — total matched count (before limit/skip)
        //   {el.text}      — textContent (trimmed, clipped to 500 chars)
        //   {el.html}      — innerHTML (clipped to 500 chars)
        //   {el.tag}       — tagName (lowercase)
        //   {el.href}      — href attribute (for <a>)
        //   {el.value}     — value attribute (for inputs)
        //   {el.selector}  — a precise [data-sd-fee-*="n"] selector that
        //                    reliably targets this specific element even if
        //                    the DOM mutates during iteration
        //
        // Supports: prefix, limit, skip, reverse, failFast (default true).
        // Hard-capped at MAX_ELEMENTS=1,000 to prevent memory exhaustion.
        // Tagging is per-run-unique so concurrent forEachElement loops do
        // not collide on the same attribute.
        if (!params.selector) throw new Error('forEachElement: selector required')

        const MAX_ELEMENTS = 1_000
        const innerSteps: AutomationStep[] = params.steps ?? []
        const prefix: string = (params.prefix ?? 'el').replace(/\.$/, '')
        const limit: number = Number(params.limit ?? 0)
        const skip: number = Number(params.skip ?? 0)
        const failFast: boolean = params.failFast !== false
        const reverse: boolean = params.reverse === true

        // A unique attribute so nested loops (or concurrent profiles running
        // the same workflow in parallel) don't stomp on each other.
        const tagAttr = `data-sd-fee-${Date.now().toString(36).slice(-6)}-${Math.random().toString(36).slice(2, 6)}`

        let total: number = await page.$$eval(
          params.selector,
          (els: Element[], attr: string) => {
            els.forEach((el, i) => el.setAttribute(attr, String(i)))
            return els.length
          },
          tagAttr
        )

        // Hard cap to prevent memory exhaustion and performance issues
        if (total > MAX_ELEMENTS) {
          throw new Error(
            `forEachElement: ${total} elements exceed max ${MAX_ELEMENTS}. ` +
            `Use 'limit' param or adjust selector to be more specific.`
          )
        }

        if (total === 0) {
          return { selector: params.selector, total: 0, iterations: 0, completed: 0, failed: 0 }
        }

        let indices: number[] = Array.from({ length: total }, (_, i) => i).slice(skip)
        if (limit > 0) indices = indices.slice(0, limit)
        if (reverse) indices.reverse()

        const errors: { index: number; error: string }[] = []
        let completed = 0

        try {
          for (const idx of indices) {
            if (control.abort) throw new Error('Workflow stopped')

            // Re-read element metadata each iteration — the DOM may have
            // mutated due to the previous iteration's steps.
            const meta = await page.$eval(
              `[${tagAttr}="${idx}"]`,
              (el: Element) => ({
                text: (el.textContent ?? '').trim().slice(0, 500),
                html: ((el as HTMLElement).innerHTML ?? '').slice(0, 500),
                tag: el.tagName.toLowerCase(),
                href: (el as HTMLAnchorElement).href ?? '',
                value: (el as HTMLInputElement).value ?? ''
              })
            ).catch(() => null)

            if (!meta) {
              // Element vanished (e.g. list refreshed, DOM mutation).
              // Log and skip unless failFast is true.
              const msg = `Element at index ${idx} disappeared (DOM mutation)`
              errors.push({ index: idx, error: msg })
              if (failFast) {
                throw new Error(msg)
              }
              continue
            }

            const injected: string[] = []
            const set = (k: string, v: string) => {
              variables[`${prefix}.${k}`] = v
              injected.push(`${prefix}.${k}`)
            }
            set('index', String(idx))
            set('total', String(total))
            set('text', meta.text)
            set('html', meta.html)
            set('tag', meta.tag)
            set('href', meta.href)
            set('value', meta.value)
            set('selector', `[${tagAttr}="${idx}"]`)

            try {
              const status = await this.executeSteps(page, innerSteps, control, allResults, variables, undefined, undefined, undefined, undefined, typedVars, variableDefinitions, aiRecovery)
              if (status === 'stopped') throw new Error('Workflow stopped')
              if (status === 'failed') throw new Error(`Iteration ${idx} failed`)
              completed++
            } catch (err: any) {
              errors.push({ index: idx, error: err.message ?? String(err) })
              if (failFast) {
                for (const k of injected) delete variables[k]
                throw err
              }
            } finally {
              for (const k of injected) delete variables[k]
            }
          }
        } finally {
          // Best-effort cleanup of the tagging attribute so subsequent steps
          // / DOM inspectors don't see our bookkeeping.
          try {
            await page.$$eval(
              `[${tagAttr}]`,
              (els: Element[], attr: string) => els.forEach((el) => el.removeAttribute(attr)),
              tagAttr
            )
          } catch { /* page may have navigated away — non-fatal */ }
        }

        return {
          selector: params.selector,
          total,
          iterations: indices.length,
          completed,
          failed: errors.length,
          errors: errors.slice(0, 20)
        }
      }

      case 'whileLoop': {
        // Conditional loop: run `params.steps` while a condition holds.
        //
        // conditionType:
        //   selector-exists  — params.selector must be present in the DOM
        //   selector-missing — params.selector must NOT be present
        //   text-contains    — params.selector's textContent includes expected
        //   js-truthy        — params.script returns truthy in page context
        //   var-equals       — variables[params.variable] === params.expected
        //   var-truthy       — variables[params.variable] is not empty/false/0
        //
        // Safety: hard-capped at MAX_ITERATIONS = 10,000 to prevent
        // runaway loops. Set `invert: true` to flip the condition (acts as
        // an "until" loop). Optional `delayMs` adds a pause between passes.
        const MAX_ITERATIONS = 10_000
        const innerSteps: AutomationStep[] = params.steps ?? []
        let maxIterations: number = Number(params.maxIterations ?? 100)
        // Enforce hard cap to prevent infinite loops
        if (maxIterations > MAX_ITERATIONS) {
          maxIterations = MAX_ITERATIONS
        }
        const delayMs: number = Number(params.delayMs ?? 0)
        const conditionType: string = params.conditionType ?? 'selector-exists'
        const invert: boolean = params.invert === true

        const checkCondition = async (): Promise<boolean> => {
          let matched = false
          switch (conditionType) {
            case 'selector-exists':
              matched = !!(await page.$(params.selector ?? '').catch(() => null))
              break
            case 'selector-missing':
              matched = !(await page.$(params.selector ?? '').catch(() => null))
              break
            case 'text-contains': {
              const text: string = await page
                .$eval(params.selector ?? 'body', (el: Element) => el.textContent ?? '')
                .catch(() => '')
              matched = text.includes(params.expected ?? '')
              break
            }
            case 'js-truthy':
              matched = !!(await page.evaluate(params.script ?? 'false').catch(() => false))
              break
            case 'var-equals':
              matched = String(variables[params.variable ?? ''] ?? '') === String(params.expected ?? '')
              break
            case 'var-truthy': {
              const val = String(variables[params.variable ?? ''] ?? '')
              matched = val !== '' && val !== '0' && val !== 'false' && val !== 'null' && val !== 'undefined'
              break
            }
            default:
              throw new Error(`whileLoop: unknown conditionType "${conditionType}"`)
          }
          return invert ? !matched : matched
        }

        let iterations = 0
        const loopStart = Date.now()
        const MAX_DURATION_MS = 5 * 60 * 1000  // 5 minutes max total time

        while (iterations < maxIterations) {
          if (control.abort) throw new Error('Workflow stopped')

          // Check for overall timeout
          if (Date.now() - loopStart > MAX_DURATION_MS) {
            throw new Error(`whileLoop exceeded maximum duration of 5 minutes after ${iterations} iterations`)
          }

          const shouldRun = await checkCondition()
          if (!shouldRun) break

          const status = await this.executeSteps(page, innerSteps, control, allResults, variables, undefined, undefined, undefined, undefined, typedVars, variableDefinitions, aiRecovery)
          if (status === 'stopped') throw new Error('Workflow stopped')
          if (status === 'failed') throw new Error(`whileLoop: iteration ${iterations + 1} failed`)
          iterations++

          if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs))
        }

        const hitMax = iterations >= maxIterations
        if (hitMax) {
          throw new Error(`whileLoop exceeded maximum of ${maxIterations} iterations (hard limit)`)
        }

        return { iterations, maxIterations, conditionType, invert }
      }

      case 'waitForRequest': {
        // Block until a request matching `urlPattern` is sent. `urlPattern`
        // supports glob-ish `*` wildcards; set `regex: true` to treat it
        // as a full regular expression. Optional `method` filter constrains
        // to a specific HTTP verb.
        if (!params.urlPattern) throw new Error('waitForRequest: urlPattern required')
        const timeout = Number(params.timeout ?? 30000)
        const method: string | undefined = params.method
          ? String(params.method).toUpperCase()
          : undefined
        const re = params.regex === true
          ? new RegExp(params.urlPattern as string)
          : globToRegex(params.urlPattern as string)

        try {
          const req = await page.waitForRequest(
            (request) => re.test(request.url())
              && (!method || request.method().toUpperCase() === method),
            { timeout }
          )
          const url = req.url()
          if (params.saveAs) variables[params.saveAs] = url
          return { url, method: req.method(), headers: req.headers() }
        } catch (err: any) {
          throw new Error(`waitForRequest: timed out after ${timeout}ms (${err.message})`)
        }
      }

      case 'waitForResponse': {
        // Block until a response matching `urlPattern` arrives. Optional
        // `status` filter (e.g. 200) requires a matching HTTP status code.
        // By default the response body is captured — set `captureBody: false`
        // for binary / large responses where the body is not needed.
        if (!params.urlPattern) throw new Error('waitForResponse: urlPattern required')
        const timeout = Number(params.timeout ?? 30000)
        const status: number | undefined = params.status !== undefined
          ? Number(params.status)
          : undefined
        const re = params.regex === true
          ? new RegExp(params.urlPattern as string)
          : globToRegex(params.urlPattern as string)

        try {
          const res = await page.waitForResponse(
            (response) => {
              if (!re.test(response.url())) return false
              if (status !== undefined && response.status() !== status) return false
              return true
            },
            { timeout }
          )
          const url = res.url()
          const resStatus = res.status()
          let body: string = ''
          if (params.captureBody !== false) {
            try { body = await res.text() } catch { /* binary / drained — leave empty */ }
          }
          // Phase 18: support optional JSONPath extraction + transforms on the
          // response body before assigning it to a variable. Keeps the
          // common "wait for API call, pull out a field" pattern one step.
          let toSave: string = body
          if (params.extractPath) {
            try {
              const parsed = JSON.parse(body)
              const picked = jsonPathGet(parsed, params.extractPath)
              toSave = picked === undefined
                ? ''
                : typeof picked === 'string' ? picked : JSON.stringify(picked)
            } catch { toSave = '' }
          }
          const finalValue = applyTransforms(toSave, params.transform)
          if (params.saveAs) variables[params.saveAs] = finalValue
          return {
            url,
            status: resStatus,
            bytes: body.length,
            extracted: params.extractPath ? finalValue : undefined
          }
        } catch (err: any) {
          throw new Error(`waitForResponse: timed out after ${timeout}ms (${err.message})`)
        }
      }

      case 'paginate': {
        // Pagination helper: run `steps` against the current page, then click
        // `nextSelector` and repeat until:
        //   - `maxPages` iterations exhausted
        //   - `nextSelector` is no longer visible / present
        //   - `nextSelector` is disabled (unless stopWhenDisabled: false)
        //
        // Inside each page iteration the 0-based counter is exposed as
        // `{pg.index}` and a 1-based counter as `{pg.count}`. `waitForNavigation`
        // should be set to true for classic multi-page pagination (new URL
        // per page); leave false for SPA / XHR pagination and rely on
        // `waitAfterClick` + a `waitForSelector` step inside `steps`.
        const nextSelector: string = params.nextSelector
        if (!nextSelector) throw new Error('paginate: nextSelector required')
        const innerSteps: AutomationStep[] = params.steps ?? []
        const maxPages: number = Number(params.maxPages ?? 50)
        const waitAfterClick: number = Number(params.waitAfterClick ?? 1000)
        const waitNav: boolean = params.waitForNavigation === true
        const stopWhenDisabled: boolean = params.stopWhenDisabled !== false

        let pagesVisited = 0
        let reason: 'max-pages' | 'no-next' | 'next-disabled' = 'max-pages'

        for (pagesVisited = 0; pagesVisited < maxPages; pagesVisited++) {
          if (control.abort) throw new Error('Workflow stopped')

          variables['pg.index'] = String(pagesVisited)
          variables['pg.count'] = String(pagesVisited + 1)
          try {
            const status = await this.executeSteps(page, innerSteps, control, allResults, variables, undefined, undefined, undefined, undefined, typedVars, variableDefinitions, aiRecovery)
            if (status === 'stopped') throw new Error('Workflow stopped')
            if (status === 'failed') throw new Error(`paginate: page ${pagesVisited + 1} steps failed`)
          } finally {
            delete variables['pg.index']
            delete variables['pg.count']
          }

          // Probe the next button's state before clicking.
          const nextState = await page.$eval(nextSelector, (el: Element) => {
            const html = el as HTMLElement
            const disabled = (html as any).disabled === true
              || el.getAttribute('aria-disabled') === 'true'
              || el.classList.contains('disabled')
            // offsetParent is null for display:none — best proxy for "visible"
            // without paying for getBoundingClientRect on hidden ancestors.
            const visible = html.offsetParent !== null
              || html.getClientRects().length > 0
            return { disabled, visible }
          }).catch(() => null)

          if (!nextState || !nextState.visible) {
            reason = 'no-next'
            pagesVisited++
            break
          }
          if (stopWhenDisabled && nextState.disabled) {
            reason = 'next-disabled'
            pagesVisited++
            break
          }

          await page.click(nextSelector)
          if (waitNav) {
            await page.waitForNavigation({
              waitUntil: 'networkidle2',
              timeout: 30000
            }).catch(() => { /* SPA — no nav event, fall through to delay */ })
          }
          if (waitAfterClick > 0) {
            await new Promise((r) => setTimeout(r, waitAfterClick))
          }
        }

        if (params.saveAs) variables[params.saveAs] = String(pagesVisited)
        return { pages: pagesVisited, reason, nextSelector }
      }

      default:
        throw new Error(`Unknown action: ${action}`)
    }
  }

  private makeHttpRequest(
    url: string,
    method: string,
    headers?: Record<string, string>,
    body?: string
  ): Promise<{ status: number; body: string }> {
    return new Promise((resolve, reject) => {
      const lib = url.startsWith('https') ? https : http
      const req = lib.request(url, { method, headers: headers ?? {} }, (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }))
      })
      req.on('error', reject)
      if (body) req.write(body)
      req.end()
    })
  }

  /**
   * Phase 12.B.3 — Stream a remote URL to a local file path.
   * Reuses cookies from the active page so authenticated downloads work
   * when the URL is on (or near) the same origin as the current page.
   */
  private async downloadToFile(
    page: Page,
    url: string,
    savePath: string,
    timeoutMs: number
  ): Promise<{ url: string; savePath: string; bytes: number; status: number }> {
    // Pull cookies the browser would send for this URL.
    let cookieHeader = ''
    try {
      const cookies = await page.cookies(url)
      if (cookies.length > 0) {
        cookieHeader = cookies.map((c: any) => `${c.name}=${c.value}`).join('; ')
      }
    } catch {
      // Non-fatal — proceed without cookies.
    }

    // Ensure parent directory exists.
    await mkdir(dirname(savePath), { recursive: true })

    const followRedirect = async (
      currentUrl: string,
      redirectsLeft: number
    ): Promise<{ status: number; bytes: number }> => {
      return new Promise((resolve, reject) => {
        let parsed: URL
        try {
          parsed = new URL(currentUrl)
        } catch (err) {
          reject(new Error(`Invalid URL: ${currentUrl}`))
          return
        }

        const lib = parsed.protocol === 'https:' ? https : http
        const headers: Record<string, string> = {}
        if (cookieHeader) headers['Cookie'] = cookieHeader

        const req = lib.request(
          parsed,
          { method: 'GET', headers, timeout: timeoutMs },
          (res) => {
            const status = res.statusCode ?? 0

            // Handle redirects (3xx with Location header)
            if (status >= 300 && status < 400 && res.headers.location) {
              res.resume()
              if (redirectsLeft <= 0) {
                reject(new Error(`Too many redirects fetching ${url}`))
                return
              }
              const next = new URL(res.headers.location, parsed).toString()
              followRedirect(next, redirectsLeft - 1).then(resolve, reject)
              return
            }

            if (status < 200 || status >= 300) {
              res.resume()
              reject(new Error(`Download failed: HTTP ${status}`))
              return
            }

            const out = createWriteStream(savePath)
            let bytes = 0
            res.on('data', (chunk: Buffer) => {
              bytes += chunk.length
            })
            res.pipe(out)
            out.on('finish', () => out.close(() => resolve({ status, bytes })))
            out.on('error', reject)
            res.on('error', reject)
          }
        )

        req.on('timeout', () => {
          req.destroy(new Error(`Download timed out after ${timeoutMs}ms`))
        })
        req.on('error', reject)
        req.end()
      })
    }

    const { status, bytes } = await followRedirect(url, 5)
    return { url, savePath, bytes, status }
  }

  /** Detach the request handler and disable interception on the page.
   *  Safe to call multiple times. */
  private async teardownIntercepts(profileId: string, page: Page | null): Promise<void> {
    const state = this.intercepts.get(profileId)
    if (!state) return
    state.enabled = false
    if (page) {
      try { page.off('request', state.handler as any) } catch { /* noop */ }
      try { await page.setRequestInterception(false) } catch { /* noop */ }
    }
    this.intercepts.delete(profileId)
  }

  private async getActivePage(profileId: string): Promise<Page | null> {
    const bm = BrowserManager.getInstance()
    const session = (bm as any).sessions.get(profileId)
    if (!session) return null

    const pages = await session.browser.pages()
    return pages.length > 0 ? pages[pages.length - 1] : null
  }
}
