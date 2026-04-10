import { v4 as uuid } from 'uuid'
import { getDatabase } from '../../config/database'
import { teamService } from './team.service'
import type { AuditLogEntry } from '../../types'

export interface AuditInput {
  teamId: string
  userId: string
  userName?: string
  action: string
  resourceType?: string
  resourceId?: string
  resourceName?: string
  changes?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
}

export interface AuditQueryParams {
  page?: number
  limit?: number
  userId?: string
  action?: string
}

export class AuditService {
  /**
   * Log an audit event. Fire-and-forget — never throws.
   */
  async log(input: AuditInput): Promise<void> {
    try {
      const db = getDatabase()
      await db('audit_log').insert({
        id: uuid(),
        team_id: input.teamId,
        user_id: input.userId,
        action: input.action,
        resource_type: input.resourceType ?? null,
        resource_id: input.resourceId ?? null,
        changes: input.changes ? JSON.stringify(input.changes) : null,
        ip_address: input.ipAddress ?? null,
        user_agent: input.userAgent ?? null,
        status: 'success',
        created_at: new Date()
      })
    } catch {
      // Audit logging should never break the main flow
    }
  }

  /**
   * Log a failure event.
   */
  async logFailure(input: AuditInput, errorMessage: string): Promise<void> {
    try {
      const db = getDatabase()
      await db('audit_log').insert({
        id: uuid(),
        team_id: input.teamId,
        user_id: input.userId,
        action: input.action,
        resource_type: input.resourceType ?? null,
        resource_id: input.resourceId ?? null,
        changes: input.changes ? JSON.stringify(input.changes) : null,
        ip_address: input.ipAddress ?? null,
        user_agent: input.userAgent ?? null,
        status: 'failure',
        error_message: errorMessage,
        created_at: new Date()
      })
    } catch {
      // Audit logging should never break the main flow
    }
  }

  /**
   * Query audit log for a team. Requires owner/admin role.
   */
  async getAuditLog(
    teamId: string,
    requestedByUserId: string,
    params: AuditQueryParams = {}
  ): Promise<{ entries: AuditLogEntry[]; total: number }> {
    await teamService.requireRole(teamId, requestedByUserId, ['owner', 'admin'])

    const db = getDatabase()
    const page = params.page ?? 1
    const limit = Math.min(params.limit ?? 50, 100)
    const offset = (page - 1) * limit

    let query = db('audit_log')
      .leftJoin('users', 'audit_log.user_id', 'users.id')
      .where('audit_log.team_id', teamId)

    if (params.userId) {
      query = query.where('audit_log.user_id', params.userId)
    }
    if (params.action) {
      query = query.where('audit_log.action', params.action)
    }

    // Count total
    const countQuery = query.clone()
    const [{ count }] = await countQuery.count('audit_log.id as count')

    // Fetch page
    const rows = await query
      .select(
        'audit_log.*',
        'users.email as user_email',
        'users.full_name as user_name'
      )
      .orderBy('audit_log.created_at', 'desc')
      .limit(limit)
      .offset(offset)

    const entries: AuditLogEntry[] = rows.map((r) => ({
      id: r.id,
      team_id: r.team_id,
      user_id: r.user_id,
      action: r.action,
      resource_type: r.resource_type,
      resource_id: r.resource_id,
      changes: r.changes ? (typeof r.changes === 'string' ? JSON.parse(r.changes) : r.changes) : undefined,
      ip_address: r.ip_address,
      user_agent: r.user_agent,
      status: r.status,
      error_message: r.error_message,
      created_at: r.created_at,
      user_email: r.user_email,
      user_name: r.user_name
    }))

    return { entries, total: parseInt(count as string, 10) }
  }
}

export const auditService = new AuditService()
