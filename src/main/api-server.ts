import http from 'http'
import { Database } from './database'
import { BrowserManager } from './browser-manager'
import { AutomationEngine } from './automation'
import type { ApiServerConfig, ApiServerStatus } from '../shared/types'

/**
 * Local REST API server for external automation control.
 * Exposes profile management, workflow execution, and browser control
 * via HTTP on a configurable port (default 9222).
 */
export class ApiServer {
  private static instance: ApiServer
  private server: http.Server | null = null
  private config: ApiServerConfig = { enabled: false, port: 9222 }

  static getInstance(): ApiServer {
    if (!ApiServer.instance) {
      ApiServer.instance = new ApiServer()
    }
    return ApiServer.instance
  }

  getStatus(): ApiServerStatus {
    return {
      running: this.server !== null && this.server.listening,
      port: this.config.port,
      url: `http://127.0.0.1:${this.config.port}`
    }
  }

  getConfig(): ApiServerConfig {
    return { ...this.config }
  }

  async start(config: Partial<ApiServerConfig> = {}): Promise<ApiServerStatus> {
    if (this.server?.listening) {
      await this.stop()
    }

    this.config = { ...this.config, ...config, enabled: true }

    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => this.handleRequest(req, res))

      this.server.on('error', (err) => {
        this.server = null
        reject(err)
      })

      this.server.listen(this.config.port, '127.0.0.1', () => {
        resolve(this.getStatus())
      })
    })
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.server) {
        resolve()
        return
      }
      this.server.close(() => {
        this.server = null
        this.config.enabled = false
        resolve()
      })
    })
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    // CORS headers for local development tools
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.setHeader('Content-Type', 'application/json')

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    // Auth check
    if (this.config.authToken) {
      const auth = req.headers.authorization
      if (!auth || auth !== `Bearer ${this.config.authToken}`) {
        this.sendJson(res, 401, { error: 'Unauthorized' })
        return
      }
    }

    try {
      const body = await this.readBody(req)
      await this.route(req, res, body)
    } catch (err: any) {
      this.sendJson(res, 500, { error: err.message })
    }
  }

  private async route(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    body: any
  ): Promise<void> {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`)
    const path = url.pathname
    const method = req.method ?? 'GET'

    const db = Database.getInstance()
    const bm = BrowserManager.getInstance()
    const engine = AutomationEngine.getInstance()

    // ── Health ─────────────────────────────────────────────────────────
    if (path === '/api/health' && method === 'GET') {
      this.sendJson(res, 200, { status: 'ok', version: '0.3.0' })
      return
    }

    // ── Profiles ───────────────────────────────────────────────────────
    if (path === '/api/profiles' && method === 'GET') {
      this.sendJson(res, 200, db.getAllProfiles())
      return
    }

    if (path === '/api/profiles/active' && method === 'GET') {
      this.sendJson(res, 200, bm.getActiveSessions())
      return
    }

    const profileMatch = path.match(/^\/api\/profiles\/([^/]+)$/)
    if (profileMatch && method === 'GET') {
      const profile = db.getProfile(profileMatch[1])
      if (!profile) { this.sendJson(res, 404, { error: 'Profile not found' }); return }
      this.sendJson(res, 200, profile)
      return
    }

    const profileLaunchMatch = path.match(/^\/api\/profiles\/([^/]+)\/launch$/)
    if (profileLaunchMatch && method === 'POST') {
      const id = profileLaunchMatch[1]
      const profile = db.getProfile(id) as any
      if (!profile) { this.sendJson(res, 404, { error: 'Profile not found' }); return }

      const fingerprint = typeof profile.fingerprint === 'string'
        ? JSON.parse(profile.fingerprint)
        : profile.fingerprint
      const allProxies = db.getAllProxies() as any[]
      const { proxy } = bm.pickProxy(profile, allProxies)
      let cookies: any[] = []
      try { cookies = JSON.parse(profile.cookies || '[]') } catch { /* ignore */ }

      await bm.launchProfile(id, fingerprint, proxy, cookies.length > 0 ? cookies : undefined)
      db.updateProfileLastUsed(id)
      this.sendJson(res, 200, { launched: true, profileId: id })
      return
    }

    const profileCloseMatch = path.match(/^\/api\/profiles\/([^/]+)\/close$/)
    if (profileCloseMatch && method === 'POST') {
      await bm.closeProfile(profileCloseMatch[1])
      this.sendJson(res, 200, { closed: true })
      return
    }

    // ── Workflows ──────────────────────────────────────────────────────
    if (path === '/api/workflows' && method === 'GET') {
      const rows = db.getAllWorkflows()
      this.sendJson(res, 200, rows.map((r: any) => ({
        ...r,
        steps: JSON.parse(r.steps),
        variables: r.variables ? JSON.parse(r.variables) : {},
        variableDefinitions: r.variable_definitions ? JSON.parse(r.variable_definitions) : undefined,
        circuitBreaker: r.circuit_breaker ? JSON.parse(r.circuit_breaker) : undefined,
        aiRecovery: r.ai_recovery ? JSON.parse(r.ai_recovery) : undefined
      })))
      return
    }

    const workflowMatch = path.match(/^\/api\/workflows\/([^/]+)$/)
    if (workflowMatch && method === 'GET') {
      const row = db.getWorkflow(workflowMatch[1])
      if (!row) { this.sendJson(res, 404, { error: 'Workflow not found' }); return }
      this.sendJson(res, 200, {
        ...row,
        steps: JSON.parse(row.steps),
        variables: row.variables ? JSON.parse(row.variables) : {},
        variableDefinitions: row.variable_definitions ? JSON.parse(row.variable_definitions) : undefined,
        circuitBreaker: row.circuit_breaker ? JSON.parse(row.circuit_breaker) : undefined,
        aiRecovery: row.ai_recovery ? JSON.parse(row.ai_recovery) : undefined
      })
      return
    }

    const workflowRunMatch = path.match(/^\/api\/workflows\/([^/]+)\/run$/)
    if (workflowRunMatch && method === 'POST') {
      const workflowId = workflowRunMatch[1]
      const profileId = body?.profileId
      if (!profileId) { this.sendJson(res, 400, { error: 'profileId required in body' }); return }
      const result = await engine.executeWorkflow(workflowId, profileId)
      this.sendJson(res, 200, result)
      return
    }

    const workflowStopMatch = path.match(/^\/api\/workflows\/([^/]+)\/stop$/)
    if (workflowStopMatch && method === 'POST') {
      const profileId = body?.profileId
      if (!profileId) { this.sendJson(res, 400, { error: 'profileId required in body' }); return }
      engine.stopWorkflow(workflowStopMatch[1], profileId)
      this.sendJson(res, 200, { stopped: true })
      return
    }

    // ── Proxies ────────────────────────────────────────────────────────
    if (path === '/api/proxies' && method === 'GET') {
      this.sendJson(res, 200, db.getAllProxies())
      return
    }

    if (path === '/api/proxies' && method === 'POST') {
      const { v4: uuidv4 } = await import('uuid')
      const id = uuidv4()
      db.createProxy({ id, ...body })
      this.sendJson(res, 201, { id, ...body })
      return
    }

    const proxyMatch = path.match(/^\/api\/proxies\/([^/]+)$/)
    if (proxyMatch && method === 'GET') {
      const proxies = db.getAllProxies() as any[]
      const proxy = proxies.find((p) => p.id === proxyMatch[1])
      if (!proxy) { this.sendJson(res, 404, { error: 'Proxy not found' }); return }
      this.sendJson(res, 200, proxy)
      return
    }

    if (proxyMatch && method === 'DELETE') {
      db.deleteProxy(proxyMatch[1])
      this.sendJson(res, 200, { deleted: true })
      return
    }

    // ── Workflows (create + delete) ────────────────────────────────────
    if (path === '/api/workflows' && method === 'POST') {
      const { v4: uuidv4 } = await import('uuid')
      const id = uuidv4()
      db.createWorkflow({ id, name: body.name, description: body.description, steps: body.steps ?? [] })
      this.sendJson(res, 201, { id, ...body })
      return
    }

    if (workflowMatch && method === 'DELETE') {
      db.deleteWorkflow(workflowMatch[1])
      this.sendJson(res, 200, { deleted: true })
      return
    }

    // ── Detection ──────────────────────────────────────────────────────
    if (path === '/api/detection/summary' && method === 'GET') {
      this.sendJson(res, 200, db.getDetectionTestSummary())
      return
    }

    const detectionResultsMatch = path.match(/^\/api\/detection\/results\/([^/]+)$/)
    if (detectionResultsMatch && method === 'GET') {
      const { DetectionTestRunner } = await import('./detection-test')
      const runner = DetectionTestRunner.getInstance()
      this.sendJson(res, 200, runner.getResults(detectionResultsMatch[1]))
      return
    }

    const detectionRunMatch = path.match(/^\/api\/detection\/run\/([^/]+)$/)
    if (detectionRunMatch && method === 'POST') {
      const { DetectionTestRunner } = await import('./detection-test')
      const runner = DetectionTestRunner.getInstance()
      const result = await runner.runTest(detectionRunMatch[1])
      this.sendJson(res, 200, result)
      return
    }

    // ── Patches ────────────────────────────────────────────────────────
    if (path === '/api/patches/status' && method === 'GET') {
      const { ChromiumPatchManager } = await import('./fingerprint/chromium-patches')
      this.sendJson(res, 200, ChromiumPatchManager.getInstance().getStatus())
      return
    }

    // ── Tier 4: Schedule Webhook Triggers ──────────────────────────────
    // GET  /api/schedules                    — list all schedules
    // POST /api/webhooks/schedules/:id/trigger — trigger a schedule externally

    if (path === '/api/schedules' && method === 'GET') {
      const rows = db.getAllSchedules()
      this.sendJson(res, 200, rows.map((r: any) => ({
        ...r,
        enabled: !!r.enabled,
        profile_ids: JSON.parse(r.profile_ids || '[]')
      })))
      return
    }

    const webhookTriggerMatch = path.match(/^\/api\/webhooks\/schedules\/([^/]+)\/trigger$/)
    if (webhookTriggerMatch && method === 'POST') {
      const scheduleId = webhookTriggerMatch[1]
      const schedRow = db.getAllSchedules().find((r: any) => r.id === scheduleId)
      if (!schedRow) { this.sendJson(res, 404, { error: 'Schedule not found' }); return }

      const body = await this.readBody(req)
      // Body may override profile_ids and/or inject runtime variables
      const profileIds: string[] = (body?.profileIds && Array.isArray(body.profileIds))
        ? body.profileIds
        : JSON.parse(schedRow.profile_ids || '[]')
      const variables: Record<string, string> = body?.variables ?? {}

      if (profileIds.length === 0) {
        this.sendJson(res, 400, { error: 'No profile ids configured for this schedule' })
        return
      }

      const { WorkflowScheduler } = await import('./scheduler')
      const scheduler = WorkflowScheduler.getInstance()
      // runSchedule auto-launches profiles and runs in parallel
      await scheduler.runSchedule(scheduleId, schedRow.workflow_id, profileIds)
      // If runtime variables were passed, run the workflow again with them
      // (variables aren't supported by the base scheduler — advanced callers
      // should use POST /api/workflows/:id/run with explicit profileId instead)
      this.sendJson(res, 200, {
        scheduleId,
        workflowId: schedRow.workflow_id,
        triggered: profileIds.length,
        profileIds,
        note: variables && Object.keys(variables).length > 0
          ? 'Runtime variables passed — use POST /api/workflows/:id/run for per-variable execution'
          : undefined
      })
      return
    }

    // ── Phase 18: Inbound workflow webhook triggers ────────────────────
    // POST /api/webhooks/workflows/:id/run — Fire-and-forget execution.
    //   • Auto-launches profile if not already running.
    //   • Accepts runtime `variables` and optional `profileId`.
    //   • Returns 202 Accepted with a runId reference so the caller can
    //     poll `/api/workflows/:id/runs/last` for the result.
    //   • Errors during background execution are logged to the run history.
    const webhookWorkflowMatch = path.match(/^\/api\/webhooks\/workflows\/([^/]+)\/run$/)
    if (webhookWorkflowMatch && method === 'POST') {
      const workflowId = webhookWorkflowMatch[1]
      const wfRow = db.getWorkflow(workflowId) as any
      if (!wfRow) { this.sendJson(res, 404, { error: 'Workflow not found' }); return }

      const profileId: string | undefined = body?.profileId
      if (!profileId) { this.sendJson(res, 400, { error: 'profileId required in body' }); return }

      const profileRow = db.getProfile(profileId) as any
      if (!profileRow) { this.sendJson(res, 404, { error: 'Profile not found' }); return }

      const variables: Record<string, string> = (body?.variables && typeof body.variables === 'object')
        ? body.variables
        : {}

      const runId = `webhook-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

      // Launch profile if it is not already running, then fire the workflow.
      // Intentionally do NOT await — respond 202 immediately, execute async.
      const runPromise = (async () => {
        try {
          if (!bm.isRunning(profileId)) {
            const fingerprint = typeof profileRow.fingerprint === 'string'
              ? JSON.parse(profileRow.fingerprint)
              : profileRow.fingerprint
            const allProxies = db.getAllProxies() as any[]
            const { proxy } = bm.pickProxy(profileRow, allProxies)
            let cookies: any[] = []
            try { cookies = JSON.parse(profileRow.cookies || '[]') } catch { /* ignore */ }
            await bm.launchProfile(profileId, fingerprint, proxy, cookies.length > 0 ? cookies : undefined)
            db.updateProfileLastUsed(profileId)
          }
          return await engine.executeWorkflow(workflowId, profileId, variables)
        } catch (err: any) {
          console.error(`[webhook ${runId}] workflow ${workflowId} failed:`, err?.message ?? err)
          return { status: 'failed', error: err?.message ?? String(err) }
        }
      })()
      // Avoid unhandled-rejection crashes if caller never observes the promise.
      runPromise.catch(() => { /* already logged */ })

      res.writeHead(202)
      res.end(JSON.stringify({
        accepted: true,
        runId,
        workflowId,
        profileId,
        message: 'Workflow execution started. Poll /api/workflows/:id/runs/last for result.'
      }))
      return
    }

    // GET /api/workflows/:id/runs/last — Latest run for external callers polling after a webhook trigger.
    const workflowRunsLastMatch = path.match(/^\/api\/workflows\/([^/]+)\/runs\/last$/)
    if (workflowRunsLastMatch && method === 'GET') {
      const rows = db.getWorkflowRuns(workflowRunsLastMatch[1], 1)
      if (!rows || rows.length === 0) { this.sendJson(res, 404, { error: 'No runs for workflow' }); return }
      const r = rows[0] as any
      this.sendJson(res, 200, {
        ...r,
        step_results: (() => { try { return JSON.parse(r.step_results) } catch { return [] } })(),
        variables: (() => { try { return r.variables ? JSON.parse(r.variables) : null } catch { return null } })()
      })
      return
    }

    // GET /api/workflows/:id/runs/export?format=csv|json&limit=500&perStep=1
    // Exports workflow run history inline for retrieval by external tools.
    const workflowRunsExportMatch = path.match(/^\/api\/workflows\/([^/]+)\/runs\/export$/)
    if (workflowRunsExportMatch && method === 'GET') {
      const workflowId = workflowRunsExportMatch[1]
      const format = (url.searchParams.get('format') ?? 'csv').toLowerCase()
      const limitRaw = Number(url.searchParams.get('limit') ?? '500')
      const limit = Math.max(1, Math.min(isNaN(limitRaw) ? 500 : limitRaw, 5000))
      const perStep = url.searchParams.get('perStep') === '1' || url.searchParams.get('perStep') === 'true'
      const statusFilter = url.searchParams.get('status') ?? undefined

      const rawRows = db.getWorkflowRuns(workflowId, limit)
      const rows = statusFilter ? rawRows.filter((r: any) => r.status === statusFilter) : rawRows

      if (format === 'json') {
        const payload = rows.map((r: any) => ({
          run_id: r.id,
          workflow_id: r.workflow_id,
          profile_id: r.profile_id,
          status: r.status,
          started_at: r.started_at,
          completed_at: r.completed_at,
          duration_ms: r.duration_ms,
          error: r.error,
          steps: (() => { try { return JSON.parse(r.step_results || '[]') } catch { return [] } })(),
          variables: (() => { try { return r.variables ? JSON.parse(r.variables) : null } catch { return null } })()
        }))
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ exportedAt: new Date().toISOString(), count: payload.length, runs: payload }))
        return
      }

      // CSV branch — reuse the same column layout as the IPC export.
      const csvEscape = (v: unknown): string => {
        if (v == null) return ''
        const s = typeof v === 'string' ? v : JSON.stringify(v)
        return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
      }
      const lines: string[] = []
      if (perStep) {
        lines.push(['run_id','workflow_id','profile_id','run_status','step_index','step_id','action','success','error','duration_ms','started_at'].join(','))
        for (const r of rows as any[]) {
          let steps: any[] = []
          try { steps = JSON.parse(r.step_results || '[]') } catch { /* ignore */ }
          steps.forEach((s, idx) => {
            lines.push([
              csvEscape(r.id), csvEscape(r.workflow_id), csvEscape(r.profile_id), csvEscape(r.status),
              csvEscape(idx), csvEscape(s?.stepId ?? s?.id ?? ''), csvEscape(s?.action ?? ''),
              csvEscape(s?.success !== false), csvEscape(s?.error ?? ''),
              csvEscape(typeof s?.durationMs === 'number' ? s.durationMs : ''),
              csvEscape(r.started_at)
            ].join(','))
          })
        }
      } else {
        lines.push(['run_id','workflow_id','profile_id','status','started_at','completed_at','duration_ms','step_count','failed_steps','error'].join(','))
        for (const r of rows as any[]) {
          let steps: any[] = []
          try { steps = JSON.parse(r.step_results || '[]') } catch { /* ignore */ }
          const failed = steps.filter((s: any) => s && s.success === false).length
          lines.push([
            csvEscape(r.id), csvEscape(r.workflow_id), csvEscape(r.profile_id), csvEscape(r.status),
            csvEscape(r.started_at), csvEscape(r.completed_at), csvEscape(r.duration_ms ?? ''),
            csvEscape(steps.length), csvEscape(failed), csvEscape(r.error ?? '')
          ].join(','))
        }
      }
      res.writeHead(200, { 'Content-Type': 'text/csv' })
      res.end(lines.join('\n'))
      return
    }

    // ── 404 ────────────────────────────────────────────────────────────
    this.sendJson(res, 404, { error: 'Not found', path, method })
  }

  private sendJson(res: http.ServerResponse, status: number, data: any): void {
    res.writeHead(status)
    res.end(JSON.stringify(data))
  }

  private readBody(req: http.IncomingMessage): Promise<any> {
    return new Promise((resolve) => {
      const chunks: Buffer[] = []
      req.on('data', (chunk) => chunks.push(chunk))
      req.on('end', () => {
        if (chunks.length === 0) { resolve(null); return }
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
        } catch {
          resolve(null)
        }
      })
    })
  }
}
