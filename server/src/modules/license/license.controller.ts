import { Request, Response } from 'express'
import { licenseService } from './license.service'
import { validate, activateLicenseSchema } from '../../utils/validators'
import { unauthorized } from '../../utils/errors'
import { logger } from '../../utils/logger'

export class LicenseController {
  async activate(req: Request, res: Response): Promise<void> {
    if (!req.userId) {
      throw unauthorized('User not authenticated')
    }

    const input = validate(req.body, activateLicenseSchema)
    const license = await licenseService.activateLicense(req.userId, input.license_key, input.machine_id)

    logger.info('License activated', { userId: req.userId, licenseKey: input.license_key })
    res.json(license)
  }

  async fetchCurrent(req: Request, res: Response): Promise<void> {
    if (!req.userId) {
      throw unauthorized('User not authenticated')
    }

    const license = await licenseService.fetchLicense(req.userId)
    res.json(license)
  }

  async deactivate(req: Request, res: Response): Promise<void> {
    if (!req.userId) {
      throw unauthorized('User not authenticated')
    }

    await licenseService.deactivateLicense(req.userId)

    logger.info('License deactivated', { userId: req.userId })
    res.status(204).send()
  }

  async listDevices(req: Request, res: Response): Promise<void> {
    if (!req.userId) {
      throw unauthorized('User not authenticated')
    }

    const devices = await licenseService.listLicenseDevices(req.userId)
    res.json(devices)
  }

  async deactivateDevice(req: Request, res: Response): Promise<void> {
    if (!req.userId) {
      throw unauthorized('User not authenticated')
    }

    const { machine_id } = validate(req.body, {
      machine_id: {
        $validate: (v: unknown) => typeof v === 'string' ? { value: v } : { error: 'Machine ID required' }
      }
    } as any)

    await licenseService.deactivateDevice(req.userId, machine_id)

    logger.info('Device deactivated', { userId: req.userId, machineId: machine_id })
    res.status(204).send()
  }
}

export const licenseController = new LicenseController()
