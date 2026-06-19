import { Router } from 'express'
import { cloudProfileController } from './cloud-profiles.controller'
import { asyncHandler } from '../../utils/async-handler'

const router = Router()

// Specific paths must precede the `/:id` param routes (e.g. so GET /usage
// isn't captured as GET /:id with id="usage").
router.get('/', asyncHandler(cloudProfileController.list.bind(cloudProfileController)))
router.post('/', asyncHandler(cloudProfileController.backup.bind(cloudProfileController)))
router.get('/usage', asyncHandler(cloudProfileController.usage.bind(cloudProfileController)))
router.post('/bulk-delete', asyncHandler(cloudProfileController.bulkDelete.bind(cloudProfileController)))
router.get('/:id', asyncHandler(cloudProfileController.getDetail.bind(cloudProfileController)))
router.patch('/:id', asyncHandler(cloudProfileController.updateTags.bind(cloudProfileController)))
router.delete('/:id', asyncHandler(cloudProfileController.remove.bind(cloudProfileController)))

export default router
