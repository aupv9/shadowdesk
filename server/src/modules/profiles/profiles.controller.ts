import { Request, Response } from 'express'
import { profileService, UpdateProfileInput } from './profiles.service'
import { validate, updateUserProfileSchema } from '../../utils/validators'
import { unauthorized, forbidden, badRequest } from '../../utils/errors'
import { uploadBlob } from '../../utils/storage'
import { env } from '../../config/env'
import { logger } from '../../utils/logger'

/** Resolve the authenticated user and enforce that the path :userId is self. */
function ensureSelf(req: Request): string {
  if (!req.userId) throw unauthorized('User not authenticated')
  if (req.params.userId !== req.userId) throw forbidden('Cannot access another user profile')
  return req.userId
}

export class ProfileController {
  async get(req: Request, res: Response): Promise<void> {
    const userId = ensureSelf(req)
    res.json(await profileService.getProfile(userId))
  }

  async update(req: Request, res: Response): Promise<void> {
    const userId = ensureSelf(req)
    const data = validate<UpdateProfileInput>(req.body, updateUserProfileSchema)
    res.json(await profileService.updateProfile(userId, data))
  }

  async uploadAvatar(req: Request, res: Response): Promise<void> {
    const userId = ensureSelf(req)
    const file = req.file
    if (!file) throw badRequest('No avatar file uploaded', 'no_file')

    const ext = (file.mimetype?.split('/')[1] || 'png').replace(/[^a-z0-9]/gi, '').slice(0, 8)
    const storagePath = `${userId}/avatar-${Date.now()}.${ext}`
    const url = await uploadBlob(env.SUPABASE_BUCKET_AVATARS, storagePath, file.buffer, file.mimetype || 'image/png')

    await profileService.setAvatar(userId, url, storagePath)
    logger.info('Avatar uploaded', { userId })
    res.json({ avatar_url: url })
  }
}

export const profileController = new ProfileController()
