import { Router } from 'express'
import { billingController } from './billing.controller'
import { asyncHandler } from '../../utils/async-handler'

const router = Router()

router.get('/overview', asyncHandler(billingController.overview.bind(billingController)))
router.get('/plans', asyncHandler(billingController.plans.bind(billingController)))
router.post('/checkout', asyncHandler(billingController.checkout.bind(billingController)))
router.post('/portal', asyncHandler(billingController.portal.bind(billingController)))
router.post('/subscription/change', asyncHandler(billingController.changePlan.bind(billingController)))
router.post('/subscription/cancel', asyncHandler(billingController.cancel.bind(billingController)))
router.post('/subscription/resume', asyncHandler(billingController.resume.bind(billingController)))
router.get('/usage', asyncHandler(billingController.usage.bind(billingController)))
router.post('/promo', asyncHandler(billingController.promo.bind(billingController)))
router.get('/invoices', asyncHandler(billingController.invoices.bind(billingController)))
router.get('/invoices/:id', asyncHandler(billingController.invoice.bind(billingController)))

export default router
