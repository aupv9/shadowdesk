import { app } from 'electron'
import { apiRequest, getApiBaseUrl, loadTokens } from './api-client'
import { getMachineId } from './license'

/**
 * Phase 2 — In-App Support & Feedback Service
 *
 * Provides endpoints for:
 * - Creating support tickets with diagnostic info
 * - Viewing ticket history and status
 * - Replying to tickets
 * - Submitting feature requests / feedback
 * - Collecting diagnostic bundles for debugging
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface SupportTicket {
  id: string
  subject: string
  category: TicketCategory
  priority: TicketPriority
  status: TicketStatus
  created_at: string
  updated_at: string
  last_reply_at: string | null
  message_count: number
}

export type TicketCategory =
  | 'bug'
  | 'feature_request'
  | 'billing'
  | 'account'
  | 'detection'
  | 'proxy'
  | 'general'

export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent'
export type TicketStatus = 'open' | 'in_progress' | 'waiting_reply' | 'resolved' | 'closed'

export interface TicketMessage {
  id: string
  ticket_id: string
  author_type: 'user' | 'support' | 'system'
  author_name: string
  content: string
  attachments: TicketAttachment[]
  created_at: string
}

export interface TicketAttachment {
  id: string
  filename: string
  size_bytes: number
  content_type: string
  url: string
}

export interface CreateTicketInput {
  subject: string
  category: TicketCategory
  priority?: TicketPriority
  message: string
  include_diagnostics?: boolean
}

export interface DiagnosticBundle {
  app_version: string
  electron_version: string
  chrome_version: string
  os: string
  os_version: string
  arch: string
  machine_id: string
  node_version: string
  memory_mb: number
  uptime_hours: number
  profile_count: number
  proxy_count: number
  settings_snapshot: Record<string, unknown>
}

export interface FeedbackInput {
  type: 'feature_request' | 'improvement' | 'praise' | 'other'
  message: string
  rating?: number // 1-5
  context?: string // current section/page
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Create a support ticket. */
export async function createTicket(input: CreateTicketInput): Promise<SupportTicket> {
  const body: Record<string, unknown> = {
    subject: input.subject,
    category: input.category,
    priority: input.priority ?? 'normal',
    message: input.message
  }

  if (input.include_diagnostics !== false) {
    body.diagnostics = collectDiagnostics()
  }

  return apiRequest<SupportTicket>('/support/tickets', {
    method: 'POST',
    body
  })
}

/** List user's support tickets. */
export async function listTickets(params?: {
  page?: number
  limit?: number
  status?: TicketStatus
}): Promise<{ tickets: SupportTicket[]; total: number }> {
  const query = new URLSearchParams()
  if (params?.page) query.set('page', String(params.page))
  if (params?.limit) query.set('limit', String(params.limit))
  if (params?.status) query.set('status', params.status)
  const qs = query.toString()

  return apiRequest<{ tickets: SupportTicket[]; total: number }>(
    `/support/tickets${qs ? `?${qs}` : ''}`
  )
}

/** Get ticket details with messages. */
export async function getTicket(ticketId: string): Promise<{
  ticket: SupportTicket
  messages: TicketMessage[]
}> {
  return apiRequest(`/support/tickets/${ticketId}`)
}

/** Reply to a ticket. */
export async function replyToTicket(ticketId: string, message: string): Promise<TicketMessage> {
  return apiRequest<TicketMessage>(`/support/tickets/${ticketId}/replies`, {
    method: 'POST',
    body: { message }
  })
}

/** Close a ticket. */
export async function closeTicket(ticketId: string): Promise<SupportTicket> {
  return apiRequest<SupportTicket>(`/support/tickets/${ticketId}/close`, {
    method: 'POST'
  })
}

/** Reopen a resolved/closed ticket. */
export async function reopenTicket(ticketId: string): Promise<SupportTicket> {
  return apiRequest<SupportTicket>(`/support/tickets/${ticketId}/reopen`, {
    method: 'POST'
  })
}

/** Submit feedback (no ticket created). */
export async function submitFeedback(input: FeedbackInput): Promise<{ id: string }> {
  return apiRequest<{ id: string }>('/support/feedback', {
    method: 'POST',
    body: {
      ...input,
      app_version: app.getVersion(),
      platform: process.platform
    }
  })
}

/** Upload an attachment to a ticket. Uses multipart/form-data. */
export async function uploadAttachment(
  ticketId: string,
  fileBuffer: Buffer,
  filename: string,
  contentType: string
): Promise<TicketAttachment> {
  const tokens = loadTokens()
  if (!tokens?.access_token) throw new Error('AUTH_EXPIRED')

  const formData = new FormData()
  const blob = new Blob([fileBuffer as unknown as BlobPart], { type: contentType })
  formData.append('file', blob, filename)

  const res = await fetch(
    `${getApiBaseUrl()}/support/tickets/${ticketId}/attachments`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`
      },
      body: formData
    }
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err?.error?.message ?? err.message ?? `Upload failed: ${res.status}`)
  }

  const json = await res.json()
  return json?.data ?? json
}

// ── Diagnostics ──────────────────────────────────────────────────────────────

/** Collect a diagnostic bundle for support tickets. */
export function collectDiagnostics(): DiagnosticBundle {
  let profileCount = 0
  let proxyCount = 0
  let settingsSnapshot: Record<string, unknown> = {}

  try {
    const { Database } = require('./database') as typeof import('./database')
    const db = Database.getInstance()
    profileCount = db.getAllProfiles().length
    proxyCount = db.getAllProxies().length

    // Get non-sensitive settings
    const { getSettings } = require('./settings') as typeof import('./settings')
    const settings = getSettings()
    settingsSnapshot = {
      theme: (settings as any)?.theme,
      language: (settings as any)?.language,
      autoSyncBinaryUA: (settings as any)?.autoSyncBinaryUA
    }
  } catch {
    // Ignore — diagnostics are best-effort
  }

  return {
    app_version: app.getVersion(),
    electron_version: process.versions.electron,
    chrome_version: process.versions.chrome,
    os: process.platform,
    os_version: require('os').release(),
    arch: process.arch,
    machine_id: getMachineId(),
    node_version: process.versions.node,
    memory_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    uptime_hours: Math.round(process.uptime() / 3600 * 100) / 100,
    profile_count: profileCount,
    proxy_count: proxyCount,
    settings_snapshot: settingsSnapshot
  }
}

/** Get diagnostics as a formatted string for manual copying. */
export function getDiagnosticsText(): string {
  const d = collectDiagnostics()
  return [
    `Ghost Browser Diagnostics`,
    `========================`,
    `App Version: ${d.app_version}`,
    `Electron: ${d.electron_version}`,
    `Chrome: ${d.chrome_version}`,
    `OS: ${d.os} ${d.os_version} (${d.arch})`,
    `Node: ${d.node_version}`,
    `Memory: ${d.memory_mb} MB`,
    `Uptime: ${d.uptime_hours}h`,
    `Profiles: ${d.profile_count}`,
    `Proxies: ${d.proxy_count}`,
    `Machine: ${d.machine_id}`
  ].join('\n')
}
