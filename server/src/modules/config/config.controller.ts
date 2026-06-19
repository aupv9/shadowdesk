import { Request, Response } from 'express'
import { configService } from './config.service'
import { validate, remoteConfigClientSchema } from '../../utils/validators'
import { unauthorized } from '../../utils/errors'

function uid(req: Request): string {
  if (!req.userId) throw unauthorized('User not authenticated')
  return req.userId
}

export class ConfigController {
  async client(req: Request, res: Response): Promise<void> {
    const userId = uid(req)
    // Validate the client context envelope (app_version / machine_id / platform).
    validate(req.body, remoteConfigClientSchema)
    res.json(await configService.getClientConfig(userId))
  }

  async presetUpdates(req: Request, res: Response): Promise<void> {
    uid(req)
    res.json(await configService.getPresetUpdates())
  }

  async dismiss(req: Request, res: Response): Promise<void> {
    const userId = uid(req)
    await configService.dismissAnnouncement(userId, req.params.id)
    res.status(204).send()
  }
}

export const configController = new ConfigController()
