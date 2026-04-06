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
      this.sendJson(res, 200, rows.map((r: any) => ({ ...r, steps: JSON.parse(r.steps) })))
      return
    }

    const workflowMatch = path.match(/^\/api\/workflows\/([^/]+)$/)
    if (workflowMatch && method === 'GET') {
      const row = db.getWorkflow(workflowMatch[1])
      if (!row) { this.sendJson(res, 404, { error: 'Workflow not found' }); return }
      this.sendJson(res, 200, { ...row, steps: JSON.parse(row.steps) })
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
