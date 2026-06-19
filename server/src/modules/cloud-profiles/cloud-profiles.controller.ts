import { Request, Response } from 'express'
import { cloudProfileService, BackupInput } from './cloud-profiles.service'
import { validate, backupProfileSchema, updateCloudTagsSchema, bulkDeleteSchema } from '../../utils/validators'
import { unauthorized } from '../../utils/errors'

function uid(req: Request): string {
  if (!req.userId) throw unauthorized('User not authenticated')
  return req.userId
}

export class CloudProfileController {
  async list(req: Request, res: Response): Promise<void> {
    const userId = uid(req)
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20))
    const search = req.query.search ? String(req.query.search) : undefined
    const tag = req.query.tag ? String(req.query.tag) : undefined
    res.json(await cloudProfileService.list(userId, { page, limit, search, tag }))
  }

  async backup(req: Request, res: Response): Promise<void> {
    const userId = uid(req)
    const input = validate<BackupInput>(req.body, backupProfileSchema)
    res.status(201).json(await cloudProfileService.backup(userId, input))
  }

  async usage(req: Request, res: Response): Promise<void> {
    const userId = uid(req)
    res.json(await cloudProfileService.usage(userId))
  }

  async bulkDelete(req: Request, res: Response): Promise<void> {
    const userId = uid(req)
    const { ids } = validate<{ ids: string[] }>(req.body, bulkDeleteSchema)
    await cloudProfileService.bulkDelete(userId, ids)
    res.status(204).send()
  }

  async getDetail(req: Request, res: Response): Promise<void> {
    const userId = uid(req)
    res.json(await cloudProfileService.getDetail(userId, req.params.id))
  }

  async updateTags(req: Request, res: Response): Promise<void> {
    const userId = uid(req)
    const { tags } = validate<{ tags: string[] }>(req.body, updateCloudTagsSchema)
    res.json(await cloudProfileService.updateTags(userId, req.params.id, tags))
  }

  async remove(req: Request, res: Response): Promise<void> {
    const userId = uid(req)
    await cloudProfileService.remove(userId, req.params.id)
    res.status(204).send()
  }
}

export const cloudProfileController = new CloudProfileController()
