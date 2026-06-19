import { Router } from 'express'
import multer from 'multer'
import { profileController } from './profiles.controller'
import { asyncHandler } from '../../utils/async-handler'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })

router.get('/:userId', asyncHandler(profileController.get.bind(profileController)))
router.put('/:userId', asyncHandler(profileController.update.bind(profileController)))
router.post(
  '/:userId/avatar',
  upload.single('avatar'),
  asyncHandler(profileController.uploadAvatar.bind(profileController))
)

export default router
