import { Router } from 'express'
import { syncController } from './sync.controller'
import { asyncHandler } from '../../utils/async-handler'

const router = Router()

router.post('/push', asyncHandler(syncController.push.bind(syncController)))
router.get('/pull', asyncHandler(syncController.pull.bind(syncController)))
router.get('/manifest', asyncHandler(syncController.getManifest.bind(syncController)))

export default router
