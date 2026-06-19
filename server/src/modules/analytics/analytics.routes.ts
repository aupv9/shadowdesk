import { Router } from 'express'
import { analyticsController } from './analytics.controller'
import { asyncHandler } from '../../utils/async-handler'

const router = Router()

router.post('/usage', asyncHandler(analyticsController.reportUsage.bind(analyticsController)))
router.post('/detection-scores', asyncHandler(analyticsController.reportDetection.bind(analyticsController)))
router.post('/events', asyncHandler(analyticsController.reportEvents.bind(analyticsController)))
router.get('/dashboard', asyncHandler(analyticsController.dashboard.bind(analyticsController)))

export default router
