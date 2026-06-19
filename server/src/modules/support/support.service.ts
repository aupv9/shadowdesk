import { v4 as uuid } from 'uuid'
import { getDatabase } from '../../config/database'
import { notFound, forbidden } from '../../utils/errors'
import type { SupportTicket, TicketMessage, TicketAttachment } from '../../types'

export interface CreateTicketInput {
  subject: string
  category: string
  priority: string
  message: string
  diagnostics?: Record<string, unknown>
}

export interface FeedbackInput {
  type: string
  message: string
  rating?: number
  context?: string | null
  app_version?: string | null
  platform?: string | null
}

export class SupportService {
  async createTicket(userId: string, input: CreateTicketInput): Promise<SupportTicket> {
    const db = getDatabase()
    const now = new Date()
    const ticketId = uuid()

    await db('support_tickets').insert({
      id: ticketId,
      user_id: userId,
      subject: input.subject,
      category: input.category,
      priority: input.priority || 'normal',
      status: 'open',
      last_reply_at: now,
      diagnostics: input.diagnostics ? JSON.stringify(input.diagnostics) : null,
      created_at: now,
      updated_at: now
    })

    await db('ticket_messages').insert({
      id: uuid(),
      ticket_id: ticketId,
      author_type: 'user',
      author_name: 'You',
      content: input.message,
      created_at: now
    })

    const row = await db('support_tickets').where({ id: ticketId }).first()
    return this.formatTicket(row, 1)
  }

  async listTickets(
    userId: string,
    opts: { page: number; limit: number; status?: string }
  ): Promise<{ tickets: SupportTicket[]; total: number }> {
    const db = getDatabase()
    const scoped = () => {
      const q = db('support_tickets').where({ user_id: userId })
      return opts.status ? q.andWhere({ status: opts.status }) : q
    }

    const rows = await scoped().orderBy('updated_at', 'desc').limit(opts.limit).offset((opts.page - 1) * opts.limit)
    const totalRow = await scoped().count({ count: '*' }).first()

    const ids = rows.map((r) => r.id)
    const countMap = new Map<string, number>()
    if (ids.length) {
      const counts = await db('ticket_messages')
        .whereIn('ticket_id', ids)
        .select('ticket_id')
        .count({ c: '*' })
        .groupBy('ticket_id')
      for (const c of counts) countMap.set((c as any).ticket_id, Number((c as any).c))
    }

    return {
      tickets: rows.map((r) => this.formatTicket(r, countMap.get(r.id) ?? 0)),
      total: Number(totalRow?.count ?? 0)
    }
  }

  async getTicket(userId: string, id: string): Promise<{ ticket: SupportTicket; messages: TicketMessage[] }> {
    const db = getDatabase()
    const row = await this.requireOwned(userId, id)

    const messages = await db('ticket_messages').where({ ticket_id: id }).orderBy('created_at', 'asc')
    const attachments = await db('ticket_attachments').where({ ticket_id: id })

    const byMessage = new Map<string, any[]>()
    for (const a of attachments) {
      const key = a.message_id ?? ''
      const list = byMessage.get(key) ?? []
      list.push(a)
      byMessage.set(key, list)
    }

    return {
      ticket: this.formatTicket(row, messages.length),
      messages: messages.map((m) => ({
        id: m.id,
        ticket_id: m.ticket_id,
        author_type: m.author_type,
        author_name: m.author_name ?? '',
        content: m.content,
        attachments: (byMessage.get(m.id) ?? []).map((a) => this.formatAttachment(a)),
        created_at: m.created_at
      }))
    }
  }

  async reply(userId: string, id: string, message: string): Promise<TicketMessage> {
    const db = getDatabase()
    await this.requireOwned(userId, id)
    const now = new Date()
    const messageId = uuid()

    await db('ticket_messages').insert({
      id: messageId,
      ticket_id: id,
      author_type: 'user',
      author_name: 'You',
      content: message,
      created_at: now
    })
    await db('support_tickets').where({ id }).update({ last_reply_at: now, status: 'open', updated_at: now })

    const m = await db('ticket_messages').where({ id: messageId }).first()
    return {
      id: m.id,
      ticket_id: m.ticket_id,
      author_type: m.author_type,
      author_name: m.author_name ?? '',
      content: m.content,
      attachments: [],
      created_at: m.created_at
    }
  }

  async setStatus(userId: string, id: string, status: string): Promise<SupportTicket> {
    const db = getDatabase()
    await this.requireOwned(userId, id)
    await db('support_tickets').where({ id }).update({ status, updated_at: new Date() })
    const row = await db('support_tickets').where({ id }).first()
    const countRow = await db('ticket_messages').where({ ticket_id: id }).count({ count: '*' }).first()
    return this.formatTicket(row, Number(countRow?.count ?? 0))
  }

  async submitFeedback(userId: string, input: FeedbackInput): Promise<{ id: string }> {
    const db = getDatabase()
    const id = uuid()
    await db('feedback').insert({
      id,
      user_id: userId,
      type: input.type,
      message: input.message,
      rating: input.rating ?? null,
      context: input.context ?? null,
      app_version: input.app_version ?? null,
      platform: input.platform ?? null,
      created_at: new Date()
    })
    return { id }
  }

  async addAttachment(
    userId: string,
    id: string,
    attachment: { filename: string; size_bytes: number; content_type: string; url: string; storage_path: string }
  ): Promise<TicketAttachment> {
    const db = getDatabase()
    await this.requireOwned(userId, id)
    const attId = uuid()
    await db('ticket_attachments').insert({
      id: attId,
      ticket_id: id,
      message_id: null,
      filename: attachment.filename,
      size_bytes: attachment.size_bytes,
      content_type: attachment.content_type,
      url: attachment.url,
      storage_path: attachment.storage_path,
      created_at: new Date()
    })
    const row = await db('ticket_attachments').where({ id: attId }).first()
    return this.formatAttachment(row)
  }

  private async requireOwned(userId: string, id: string): Promise<any> {
    const db = getDatabase()
    const row = await db('support_tickets').where({ id }).first()
    if (!row) throw notFound('Ticket not found')
    if (row.user_id !== userId) throw forbidden('Not your ticket')
    return row
  }

  private formatTicket(row: any, messageCount: number): SupportTicket {
    return {
      id: row.id,
      subject: row.subject,
      category: row.category,
      priority: row.priority,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      last_reply_at: row.last_reply_at ?? null,
      message_count: messageCount
    }
  }

  private formatAttachment(row: any): TicketAttachment {
    return {
      id: row.id,
      filename: row.filename,
      size_bytes: row.size_bytes ?? 0,
      content_type: row.content_type ?? 'application/octet-stream',
      url: row.url ?? ''
    }
  }
}

export const supportService = new SupportService()
