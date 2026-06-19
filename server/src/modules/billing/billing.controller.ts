import { Request, Response } from 'express'
import { billingService } from './billing.service'
import { validate, checkoutSchema, promoSchema } from '../../utils/validators'
import { unauthorized } from '../../utils/errors'

function uid(req: Request): string {
  if (!req.userId) throw unauthorized('User not authenticated')
  return req.userId
}

interface CheckoutBody {
  plan_id: string
  interval: 'monthly' | 'yearly'
}

export class BillingController {
  async overview(req: Request, res: Response): Promise<void> {
    res.json(await billingService.getOverview(uid(req)))
  }

  async plans(req: Request, res: Response): Promise<void> {
    uid(req)
    res.json(billingService.getPlans())
  }

  async checkout(req: Request, res: Response): Promise<void> {
    const userId = uid(req)
    const { plan_id, interval } = validate<CheckoutBody>(req.body, checkoutSchema)
    res.json(await billingService.checkout(userId, plan_id, interval))
  }

  async portal(req: Request, res: Response): Promise<void> {
    res.json(await billingService.portal(uid(req)))
  }

  async changePlan(req: Request, res: Response): Promise<void> {
    const userId = uid(req)
    const { plan_id, interval } = validate<CheckoutBody>(req.body, checkoutSchema)
    res.json(await billingService.changePlan(userId, plan_id, interval))
  }

  async cancel(req: Request, res: Response): Promise<void> {
    res.json(await billingService.cancel(uid(req)))
  }

  async resume(req: Request, res: Response): Promise<void> {
    res.json(await billingService.resume(uid(req)))
  }

  async invoices(req: Request, res: Response): Promise<void> {
    const userId = uid(req)
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20))
    const status = req.query.status ? String(req.query.status) : undefined
    res.json(await billingService.listInvoices(userId, { page, limit, status }))
  }

  async invoice(req: Request, res: Response): Promise<void> {
    res.json(await billingService.getInvoice(uid(req), req.params.id))
  }

  async usage(req: Request, res: Response): Promise<void> {
    res.json(await billingService.getUsage(uid(req)))
  }

  async promo(req: Request, res: Response): Promise<void> {
    uid(req)
    const { code } = validate<{ code: string }>(req.body, promoSchema)
    res.json(billingService.applyPromo(code))
  }
}

export const billingController = new BillingController()
