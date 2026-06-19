import { Request, Response } from 'express'
import { notificationService } from './notifications.service'
import { unauthorized } from '../../utils/errors'

function uid(req: Request): string {
  if (!req.userId) throw unauthorized('User not authenticated')
  return req.userId
}

export class NotificationController {
  async list(req: Request, res: Response): Promise<void> {
    const userId = uid(req)
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20))
    const unreadOnly = String(req.query.unread_only ?? '') === 'true'
    res.json(await notificationService.list(userId, { page, limit, unreadOnly }))
  }

  async markRead(req: Request, res: Response): Promise<void> {
    const userId = uid(req)
    await notificationService.markRead(userId, req.params.id)
    res.status(204).send()
  }

  async markAllRead(req: Request, res: Response): Promise<void> {
    const userId = uid(req)
    await notificationService.markAllRead(userId)
    res.status(204).send()
  }

  async remove(req: Request, res: Response): Promise<void> {
    const userId = uid(req)
    await notificationService.remove(userId, req.params.id)
    res.status(204).send()
  }
}

export const notificationController = new NotificationController()
