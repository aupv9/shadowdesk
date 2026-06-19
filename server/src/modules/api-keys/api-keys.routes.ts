import { Router } from 'express'
import { apiKeyController } from './api-keys.controller'
import { asyncHandler } from '../../utils/async-handler'

const router = Router()

router.get('/users/:userId', asyncHandler(apiKeyController.list.bind(apiKeyController)))
router.post('/users/:userId', asyncHandler(apiKeyController.create.bind(apiKeyController)))
router.post('/:keyId/rotate', asyncHandler(apiKeyController.rotate.bind(apiKeyController)))
router.delete('/:keyId', asyncHandler(apiKeyController.remove.bind(apiKeyController)))
router.get('/:keyId/usage', asyncHandler(apiKeyController.usage.bind(apiKeyController)))

export default router
