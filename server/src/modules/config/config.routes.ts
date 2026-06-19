import { Router } from 'express'
import { configController } from './config.controller'
import { asyncHandler } from '../../utils/async-handler'

const router = Router()

router.post('/client', asyncHandler(configController.client.bind(configController)))
router.get('/preset-updates', asyncHandler(configController.presetUpdates.bind(configController)))
router.post('/announcements/:id/dismiss', asyncHandler(configController.dismiss.bind(configController)))

export default router
