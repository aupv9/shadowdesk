import { Router } from 'express'
import multer from 'multer'
import { supportController } from './support.controller'
import { asyncHandler } from '../../utils/async-handler'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

router.post('/feedback', asyncHandler(supportController.feedback.bind(supportController)))
router.post('/tickets', asyncHandler(supportController.create.bind(supportController)))
router.get('/tickets', asyncHandler(supportController.list.bind(supportController)))
router.get('/tickets/:id', asyncHandler(supportController.get.bind(supportController)))
router.post('/tickets/:id/replies', asyncHandler(supportController.reply.bind(supportController)))
router.post('/tickets/:id/close', asyncHandler(supportController.close.bind(supportController)))
router.post('/tickets/:id/reopen', asyncHandler(supportController.reopen.bind(supportController)))
router.post(
  '/tickets/:id/attachments',
  upload.single('file'),
  asyncHandler(supportController.uploadAttachment.bind(supportController))
)

export default router
