import { Router } from 'express'
import { licenseController } from './license.controller'
import { asyncHandler } from '../../utils/async-handler'

const router = Router()

router.post('/activate', asyncHandler(licenseController.activate.bind(licenseController)))
router.get('/current', asyncHandler(licenseController.fetchCurrent.bind(licenseController)))
router.post('/deactivate', asyncHandler(licenseController.deactivate.bind(licenseController)))
router.get('/devices', asyncHandler(licenseController.listDevices.bind(licenseController)))
router.post('/devices/deactivate', asyncHandler(licenseController.deactivateDevice.bind(licenseController)))

export default router
