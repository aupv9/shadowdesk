import { Router } from 'express'
import { notificationController } from './notifications.controller'
import { asyncHandler } from '../../utils/async-handler'

const router = Router()

router.get('/', asyncHandler(notificationController.list.bind(notificationController)))
router.post('/read-all', asyncHandler(notificationController.markAllRead.bind(notificationController)))
router.post('/:id/read', asyncHandler(notificationController.markRead.bind(notificationController)))
router.delete('/:id', asyncHandler(notificationController.remove.bind(notificationController)))

export default router
