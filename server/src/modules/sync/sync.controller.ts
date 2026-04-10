import { Request, Response } from 'express'
import { syncService } from './sync.service'
import { validate, pushSyncSchema } from '../../utils/validators'
import { unauthorized } from '../../utils/errors'
import { logger } from '../../utils/logger'

export class SyncController {
  async push(req: Request, res: Response): Promise<void> {
    if (!req.userId) {
      throw unauthorized('User not authenticated')
    }

    const input = validate(req.body, pushSyncSchema)
    const data = Buffer.from(input.data, 'base64')

    await syncService.pushProfiles(req.userId, data, input.checksum, input.profile_count)

    logger.info('Profiles pushed', {
      userId: req.userId,
      profileCount: input.profile_count
    })

    res.status(204).send()
  }

  async pull(req: Request, res: Response): Promise<void> {
    if (!req.userId) {
      throw unauthorized('User not authenticated')
    }

    const result = await syncService.pullProfiles(req.userId)

    logger.info('Profiles pulled', { userId: req.userId })

    res.json({
      data: result.data.toString('base64'),
      checksum: result.checksum
    })
  }

  async getManifest(req: Request, res: Response): Promise<void> {
    if (!req.userId) {
      throw unauthorized('User not authenticated')
    }

    const manifest = await syncService.getSyncManifest(req.userId)
    res.json(manifest)
  }
}

export const syncController = new SyncController()
