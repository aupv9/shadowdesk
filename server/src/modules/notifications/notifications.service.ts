import { getDatabase } from '../../config/database'
import type { AppNotification } from '../../types'

export class NotificationService {
  async list(
    userId: string,
    opts: { page: number; limit: number; unreadOnly: boolean }
  ): Promise<{ notifications: AppNotification[]; total: number; unread_count: number }> {
    const db = getDatabase()

    const scoped = () => {
      const q = db('notifications').where({ user_id: userId })
      return opts.unreadOnly ? q.whereNull('read_at') : q
    }

    const rows = await scoped()
      .orderBy('created_at', 'desc')
      .limit(opts.limit)
      .offset((opts.page - 1) * opts.limit)

    const totalRow = await scoped().count({ count: '*' }).first()
    const unreadRow = await db('notifications')
      .where({ user_id: userId })
      .whereNull('read_at')
      .count({ count: '*' })
      .first()

    return {
      notifications: rows.map((r) => this.format(r)),
      total: Number(totalRow?.count ?? 0),
      unread_count: Number(unreadRow?.count ?? 0)
    }
  }

  async markRead(userId: string, id: string): Promise<void> {
    const db = getDatabase()
    await db('notifications').where({ id, user_id: userId }).update({ read_at: new Date() })
  }

  async markAllRead(userId: string): Promise<void> {
    const db = getDatabase()
    await db('notifications').where({ user_id: userId }).whereNull('read_at').update({ read_at: new Date() })
  }

  async remove(userId: string, id: string): Promise<void> {
    const db = getDatabase()
    await db('notifications').where({ id, user_id: userId }).delete()
  }

  private format(row: any): AppNotification {
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      message: row.body ?? '',
      read: Boolean(row.read_at),
      created_at: row.created_at,
      action_url: row.action_url ?? undefined,
      metadata: row.metadata ?? undefined
    }
  }
}

export const notificationService = new NotificationService()
