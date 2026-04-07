/**
 * Phase 14.A — Remote Browser Nodes
 *
 * Manages a registry of remote Chromium nodes that can host profile sessions
 * for distributed browsing. Persistence is via a JSON file under userData
 * (no DB migration needed). Health checks ping `<url>/health` over HTTP.
 *
 * The least-loaded healthy node is picked when scheduling work.
 */

import { app } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'
import type { RemoteBrowserNode, CreateNodeInput, NodeHealth, NodeStatus } from '../shared/types'

const FILE_NAME = 'remote-nodes.json'

export class NodeManager {
  private static instance: NodeManager | null = null
  private nodes: RemoteBrowserNode[] = []
  private filePath: string
  private loaded = false
  /** Allow tests to inject a fetch implementation. */
  public fetchImpl: (url: string, init?: any) => Promise<{ ok: boolean; status: number }> =
    (typeof fetch !== 'undefined' ? (fetch as any) : (async () => ({ ok: false, status: 0 })))

  private constructor(filePath?: string) {
    this.filePath = filePath ?? join(
      (() => { try { return app.getPath('userData') } catch { return process.cwd() } })(),
      FILE_NAME
    )
  }

  static getInstance(): NodeManager {
    if (!this.instance) this.instance = new NodeManager()
    return this.instance
  }

  /** Reset singleton (test-only). */
  static _reset(filePath?: string): NodeManager {
    this.instance = new NodeManager(filePath)
    return this.instance
  }

  async load(): Promise<void> {
    if (this.loaded) return
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8')
      this.nodes = JSON.parse(raw)
    } catch {
      this.nodes = []
    }
    this.loaded = true
  }

  private async save(): Promise<void> {
    await fs.writeFile(this.filePath, JSON.stringify(this.nodes, null, 2), 'utf-8')
  }

  async list(): Promise<RemoteBrowserNode[]> {
    await this.load()
    return [...this.nodes]
  }

  async add(input: CreateNodeInput): Promise<RemoteBrowserNode> {
    await this.load()
    if (!input.name?.trim()) throw new Error('Node name is required')
    if (!input.url?.trim()) throw new Error('Node URL is required')
    try { new URL(input.url) } catch { throw new Error('Node URL is not a valid URL') }

    const node: RemoteBrowserNode = {
      id: uuidv4(),
      name: input.name.trim(),
      url: input.url.replace(/\/$/, ''),
      authToken: input.authToken,
      region: input.region,
      capacity: Math.max(1, input.capacity ?? 5),
      activeProfiles: 0,
      status: 'unknown',
      createdAt: new Date().toISOString()
    }
    this.nodes.push(node)
    await this.save()
    return node
  }

  async remove(id: string): Promise<void> {
    await this.load()
    this.nodes = this.nodes.filter((n) => n.id !== id)
    await this.save()
  }

  async update(id: string, patch: Partial<RemoteBrowserNode>): Promise<RemoteBrowserNode | null> {
    await this.load()
    const idx = this.nodes.findIndex((n) => n.id === id)
    if (idx < 0) return null
    this.nodes[idx] = { ...this.nodes[idx], ...patch }
    await this.save()
    return this.nodes[idx]
  }

  /** Ping `<url>/health` and update the node's status/latency. */
  async ping(id: string): Promise<NodeHealth> {
    await this.load()
    const node = this.nodes.find((n) => n.id === id)
    if (!node) return { status: 'error', error: 'Node not found' }

    const t0 = Date.now()
    let status: NodeStatus = 'offline'
    let error: string | undefined
    try {
      const headers: Record<string, string> = {}
      if (node.authToken) headers['Authorization'] = `Bearer ${node.authToken}`
      const res = await this.fetchImpl(`${node.url}/health`, { method: 'GET', headers })
      status = res.ok ? 'online' : 'error'
      if (!res.ok) error = `HTTP ${res.status}`
    } catch (e: any) {
      status = 'offline'
      error = e?.message ?? String(e)
    }
    const latencyMs = Date.now() - t0
    await this.update(id, { status, latencyMs, lastCheckedAt: new Date().toISOString() })
    return { status, latencyMs, error }
  }

  /** Pick the healthy node with the most free slots (least-loaded balancer). */
  async pickBestNode(): Promise<RemoteBrowserNode | null> {
    await this.load()
    const candidates = this.nodes
      .filter((n) => n.status === 'online' && n.activeProfiles < n.capacity)
      .sort((a, b) => (a.activeProfiles / a.capacity) - (b.activeProfiles / b.capacity))
    return candidates[0] ?? null
  }
}

export function getNodeManager(): NodeManager {
  return NodeManager.getInstance()
}
