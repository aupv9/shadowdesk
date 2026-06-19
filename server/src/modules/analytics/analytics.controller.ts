import { Request, Response } from 'express'
import { analyticsService } from './analytics.service'
import { validate, usageSnapshotSchema, detectionScoreSchema, analyticsEventsSchema } from '../../utils/validators'
import { unauthorized } from '../../utils/errors'

function uid(req: Request): string {
  if (!req.userId) throw unauthorized('User not authenticated')
  return req.userId
}

export class AnalyticsController {
  async reportUsage(req: Request, res: Response): Promise<void> {
    const userId = uid(req)
    const snapshot = validate<any>(req.body, usageSnapshotSchema)
    await analyticsService.recordUsage(userId, snapshot)
    res.status(204).send()
  }

  async reportDetection(req: Request, res: Response): Promise<void> {
    const userId = uid(req)
    const report = validate<any>(req.body, detectionScoreSchema)
    await analyticsService.recordDetectionScore(userId, report)
    res.status(204).send()
  }

  async reportEvents(req: Request, res: Response): Promise<void> {
    const userId = uid(req)
    const { events } = validate<{ events: any[] }>(req.body, analyticsEventsSchema)
    await analyticsService.recordEvents(userId, events)
    res.status(204).send()
  }

  async dashboard(req: Request, res: Response): Promise<void> {
    const userId = uid(req)
    res.json(await analyticsService.dashboard(userId))
  }
}

export const analyticsController = new AnalyticsController()
