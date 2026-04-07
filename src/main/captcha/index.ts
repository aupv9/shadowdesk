/**
 * Phase 12.B.1 — Captcha solver integration.
 *
 * Adapter pattern over the three most common captcha services. All adapters
 * speak the same `CaptchaSolver` interface so the automation engine doesn't
 * care which one is selected.
 *
 * Networking uses Node's built-in `https` so we don't introduce a fetch
 * dependency in the main process.
 */
import https from 'https'
import { URL } from 'url'

export type CaptchaProviderId = '2captcha' | 'anticaptcha' | 'capmonster'

export type CaptchaTaskType =
  | 'recaptcha-v2'
  | 'recaptcha-v3'
  | 'hcaptcha'
  | 'image'

export interface SolveRecaptchaV2Input {
  siteKey: string
  pageUrl: string
  invisible?: boolean
}

export interface SolveRecaptchaV3Input {
  siteKey: string
  pageUrl: string
  action: string
  minScore?: number
}

export interface SolveHCaptchaInput {
  siteKey: string
  pageUrl: string
}

export interface SolveImageInput {
  imageBase64: string
}

/** Common shape returned by every adapter. The token is the form-ready value. */
export interface SolveResult {
  provider: CaptchaProviderId
  type: CaptchaTaskType
  token: string
  /** Provider task id (useful for refunds / debugging). */
  taskId?: string
  /** Solve duration in milliseconds, end-to-end (submit → fetch). */
  duration_ms: number
}

export interface CaptchaSolver {
  readonly id: CaptchaProviderId
  readonly displayName: string

  /** Returns the user's account balance in USD (or whatever the provider exposes). */
  getBalance(apiKey: string): Promise<number>

  solveRecaptchaV2(apiKey: string, input: SolveRecaptchaV2Input): Promise<SolveResult>
  solveRecaptchaV3(apiKey: string, input: SolveRecaptchaV3Input): Promise<SolveResult>
  solveHCaptcha(apiKey: string, input: SolveHCaptchaInput): Promise<SolveResult>
  solveImage(apiKey: string, input: SolveImageInput): Promise<SolveResult>
}

// ── HTTP helpers ───────────────────────────────────────────────────────────

interface JsonRequestOptions {
  url: string
  method?: 'GET' | 'POST'
  body?: any
  timeoutMs?: number
}

function jsonRequest<T = any>(opts: JsonRequestOptions): Promise<T> {
  const { url, method = 'POST', body, timeoutMs = 30000 } = opts
  return new Promise((resolve, reject) => {
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch (err) {
      reject(new Error(`Invalid URL: ${url}`))
      return
    }
    const payload = body !== undefined ? JSON.stringify(body) : undefined
    const req = https.request(
      parsed,
      {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload).toString() } : {})
        },
        timeout: timeoutMs
      },
      (res) => {
        let chunks = ''
        res.on('data', (c) => (chunks += c))
        res.on('end', () => {
          try {
            const parsed = chunks ? JSON.parse(chunks) : {}
            resolve(parsed as T)
          } catch (err) {
            reject(new Error(`Bad JSON response from ${url}: ${chunks.substring(0, 200)}`))
          }
        })
      }
    )
    req.on('timeout', () => req.destroy(new Error(`Request timed out after ${timeoutMs}ms`)))
    req.on('error', reject)
    if (payload) req.write(payload)
    req.end()
  })
}

/** Wait helper. */
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

// ── 2Captcha adapter ───────────────────────────────────────────────────────
//
// API docs: https://2captcha.com/2captcha-api
// Uses the REST endpoints: POST /createTask, POST /getTaskResult, POST /getBalance.

class TwoCaptchaSolver implements CaptchaSolver {
  readonly id: CaptchaProviderId = '2captcha'
  readonly displayName = '2Captcha'
  private readonly base = 'https://api.2captcha.com'

  async getBalance(apiKey: string): Promise<number> {
    const r = await jsonRequest<{ errorId?: number; errorCode?: string; balance?: number }>({
      url: `${this.base}/getBalance`,
      body: { clientKey: apiKey }
    })
    if (r.errorId && r.errorId !== 0) throw new Error(`2Captcha: ${r.errorCode ?? 'unknown error'}`)
    return r.balance ?? 0
  }

  solveRecaptchaV2(apiKey: string, input: SolveRecaptchaV2Input): Promise<SolveResult> {
    return this.solveTask(apiKey, 'recaptcha-v2', {
      type: input.invisible ? 'RecaptchaV2TaskProxyless' : 'RecaptchaV2TaskProxyless',
      websiteURL: input.pageUrl,
      websiteKey: input.siteKey,
      isInvisible: !!input.invisible
    }, 'gRecaptchaResponse')
  }

  solveRecaptchaV3(apiKey: string, input: SolveRecaptchaV3Input): Promise<SolveResult> {
    return this.solveTask(apiKey, 'recaptcha-v3', {
      type: 'RecaptchaV3TaskProxyless',
      websiteURL: input.pageUrl,
      websiteKey: input.siteKey,
      pageAction: input.action,
      minScore: input.minScore ?? 0.7
    }, 'gRecaptchaResponse')
  }

  solveHCaptcha(apiKey: string, input: SolveHCaptchaInput): Promise<SolveResult> {
    return this.solveTask(apiKey, 'hcaptcha', {
      type: 'HCaptchaTaskProxyless',
      websiteURL: input.pageUrl,
      websiteKey: input.siteKey
    }, 'gRecaptchaResponse')
  }

  solveImage(apiKey: string, input: SolveImageInput): Promise<SolveResult> {
    return this.solveTask(apiKey, 'image', {
      type: 'ImageToTextTask',
      body: input.imageBase64
    }, 'text')
  }

  private async solveTask(
    apiKey: string,
    type: CaptchaTaskType,
    task: Record<string, any>,
    solutionField: string
  ): Promise<SolveResult> {
    const start = Date.now()
    const create = await jsonRequest<{ errorId: number; errorCode?: string; taskId?: number }>({
      url: `${this.base}/createTask`,
      body: { clientKey: apiKey, task }
    })
    if (create.errorId !== 0) throw new Error(`2Captcha createTask: ${create.errorCode ?? 'unknown'}`)
    const taskId = create.taskId!

    // Poll for the result. 2Captcha recommends 5–10s initial wait then 5s intervals.
    await sleep(5000)
    for (let attempt = 0; attempt < 24; attempt++) {
      const res = await jsonRequest<{
        errorId: number
        errorCode?: string
        status: 'processing' | 'ready'
        solution?: Record<string, string>
      }>({
        url: `${this.base}/getTaskResult`,
        body: { clientKey: apiKey, taskId }
      })
      if (res.errorId !== 0) throw new Error(`2Captcha getTaskResult: ${res.errorCode ?? 'unknown'}`)
      if (res.status === 'ready' && res.solution) {
        const token = res.solution[solutionField] || res.solution.text || ''
        if (!token) throw new Error('2Captcha returned empty solution')
        return {
          provider: this.id,
          type,
          token,
          taskId: String(taskId),
          duration_ms: Date.now() - start
        }
      }
      await sleep(5000)
    }
    throw new Error('2Captcha solve timed out after ~125s')
  }
}

// ── Anti-Captcha adapter ───────────────────────────────────────────────────
//
// API docs: https://anti-captcha.com/apidoc
// Wire format is identical to 2Captcha (same vendor heritage), only the host
// changes. We share the polling logic.

class AntiCaptchaSolver implements CaptchaSolver {
  readonly id: CaptchaProviderId = 'anticaptcha'
  readonly displayName = 'Anti-Captcha'
  private readonly base = 'https://api.anti-captcha.com'

  async getBalance(apiKey: string): Promise<number> {
    const r = await jsonRequest<{ errorId?: number; errorCode?: string; balance?: number }>({
      url: `${this.base}/getBalance`,
      body: { clientKey: apiKey }
    })
    if (r.errorId && r.errorId !== 0) throw new Error(`Anti-Captcha: ${r.errorCode ?? 'unknown error'}`)
    return r.balance ?? 0
  }

  solveRecaptchaV2(apiKey: string, input: SolveRecaptchaV2Input): Promise<SolveResult> {
    return this.solveTask(apiKey, 'recaptcha-v2', {
      type: 'NoCaptchaTaskProxyless',
      websiteURL: input.pageUrl,
      websiteKey: input.siteKey,
      isInvisible: !!input.invisible
    }, 'gRecaptchaResponse')
  }

  solveRecaptchaV3(apiKey: string, input: SolveRecaptchaV3Input): Promise<SolveResult> {
    return this.solveTask(apiKey, 'recaptcha-v3', {
      type: 'RecaptchaV3TaskProxyless',
      websiteURL: input.pageUrl,
      websiteKey: input.siteKey,
      pageAction: input.action,
      minScore: input.minScore ?? 0.7
    }, 'gRecaptchaResponse')
  }

  solveHCaptcha(apiKey: string, input: SolveHCaptchaInput): Promise<SolveResult> {
    return this.solveTask(apiKey, 'hcaptcha', {
      type: 'HCaptchaTaskProxyless',
      websiteURL: input.pageUrl,
      websiteKey: input.siteKey
    }, 'gRecaptchaResponse')
  }

  solveImage(apiKey: string, input: SolveImageInput): Promise<SolveResult> {
    return this.solveTask(apiKey, 'image', {
      type: 'ImageToTextTask',
      body: input.imageBase64
    }, 'text')
  }

  private async solveTask(
    apiKey: string,
    type: CaptchaTaskType,
    task: Record<string, any>,
    solutionField: string
  ): Promise<SolveResult> {
    const start = Date.now()
    const create = await jsonRequest<{ errorId: number; errorCode?: string; taskId?: number }>({
      url: `${this.base}/createTask`,
      body: { clientKey: apiKey, task }
    })
    if (create.errorId !== 0) throw new Error(`Anti-Captcha createTask: ${create.errorCode ?? 'unknown'}`)
    const taskId = create.taskId!

    await sleep(5000)
    for (let attempt = 0; attempt < 24; attempt++) {
      const res = await jsonRequest<{
        errorId: number
        errorCode?: string
        status: 'processing' | 'ready'
        solution?: Record<string, string>
      }>({
        url: `${this.base}/getTaskResult`,
        body: { clientKey: apiKey, taskId }
      })
      if (res.errorId !== 0) throw new Error(`Anti-Captcha getTaskResult: ${res.errorCode ?? 'unknown'}`)
      if (res.status === 'ready' && res.solution) {
        const token = res.solution[solutionField] || res.solution.text || ''
        if (!token) throw new Error('Anti-Captcha returned empty solution')
        return {
          provider: this.id,
          type,
          token,
          taskId: String(taskId),
          duration_ms: Date.now() - start
        }
      }
      await sleep(5000)
    }
    throw new Error('Anti-Captcha solve timed out after ~125s')
  }
}

// ── CapMonster adapter ─────────────────────────────────────────────────────
//
// API docs: https://docs.capmonster.cloud/
// Wire format is also Anti-Captcha-compatible.

class CapMonsterSolver implements CaptchaSolver {
  readonly id: CaptchaProviderId = 'capmonster'
  readonly displayName = 'CapMonster'
  private readonly base = 'https://api.capmonster.cloud'

  async getBalance(apiKey: string): Promise<number> {
    const r = await jsonRequest<{ errorId?: number; errorCode?: string; balance?: number }>({
      url: `${this.base}/getBalance`,
      body: { clientKey: apiKey }
    })
    if (r.errorId && r.errorId !== 0) throw new Error(`CapMonster: ${r.errorCode ?? 'unknown error'}`)
    return r.balance ?? 0
  }

  solveRecaptchaV2(apiKey: string, input: SolveRecaptchaV2Input): Promise<SolveResult> {
    return this.solveTask(apiKey, 'recaptcha-v2', {
      type: 'NoCaptchaTaskProxyless',
      websiteURL: input.pageUrl,
      websiteKey: input.siteKey,
      isInvisible: !!input.invisible
    }, 'gRecaptchaResponse')
  }

  solveRecaptchaV3(apiKey: string, input: SolveRecaptchaV3Input): Promise<SolveResult> {
    return this.solveTask(apiKey, 'recaptcha-v3', {
      type: 'RecaptchaV3TaskProxyless',
      websiteURL: input.pageUrl,
      websiteKey: input.siteKey,
      pageAction: input.action,
      minScore: input.minScore ?? 0.7
    }, 'gRecaptchaResponse')
  }

  solveHCaptcha(apiKey: string, input: SolveHCaptchaInput): Promise<SolveResult> {
    return this.solveTask(apiKey, 'hcaptcha', {
      type: 'HCaptchaTaskProxyless',
      websiteURL: input.pageUrl,
      websiteKey: input.siteKey
    }, 'gRecaptchaResponse')
  }

  solveImage(apiKey: string, input: SolveImageInput): Promise<SolveResult> {
    return this.solveTask(apiKey, 'image', {
      type: 'ImageToTextTask',
      body: input.imageBase64
    }, 'text')
  }

  private async solveTask(
    apiKey: string,
    type: CaptchaTaskType,
    task: Record<string, any>,
    solutionField: string
  ): Promise<SolveResult> {
    const start = Date.now()
    const create = await jsonRequest<{ errorId: number; errorCode?: string; taskId?: number }>({
      url: `${this.base}/createTask`,
      body: { clientKey: apiKey, task }
    })
    if (create.errorId !== 0) throw new Error(`CapMonster createTask: ${create.errorCode ?? 'unknown'}`)
    const taskId = create.taskId!

    await sleep(5000)
    for (let attempt = 0; attempt < 24; attempt++) {
      const res = await jsonRequest<{
        errorId: number
        errorCode?: string
        status: 'processing' | 'ready'
        solution?: Record<string, string>
      }>({
        url: `${this.base}/getTaskResult`,
        body: { clientKey: apiKey, taskId }
      })
      if (res.errorId !== 0) throw new Error(`CapMonster getTaskResult: ${res.errorCode ?? 'unknown'}`)
      if (res.status === 'ready' && res.solution) {
        const token = res.solution[solutionField] || res.solution.text || ''
        if (!token) throw new Error('CapMonster returned empty solution')
        return {
          provider: this.id,
          type,
          token,
          taskId: String(taskId),
          duration_ms: Date.now() - start
        }
      }
      await sleep(5000)
    }
    throw new Error('CapMonster solve timed out after ~125s')
  }
}

// ── Registry ───────────────────────────────────────────────────────────────

const SOLVERS: Record<CaptchaProviderId, CaptchaSolver> = {
  '2captcha':    new TwoCaptchaSolver(),
  'anticaptcha': new AntiCaptchaSolver(),
  'capmonster':  new CapMonsterSolver()
}

export function getSolver(id: CaptchaProviderId): CaptchaSolver {
  const s = SOLVERS[id]
  if (!s) throw new Error(`Unknown captcha provider: ${id}`)
  return s
}

export function listSolvers(): { id: CaptchaProviderId; displayName: string }[] {
  return Object.values(SOLVERS).map((s) => ({ id: s.id, displayName: s.displayName }))
}
