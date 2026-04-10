import { v4 as uuid } from 'uuid'
import { getDatabase } from '../../config/database'
import { notFound, conflict, unauthorized } from '../../utils/errors'
import type { License, LicenseDevice } from '../../types'

export class LicenseService {
  async activateLicense(
    userId: string,
    licenseKey: string,
    machineId: string,
    machineName?: string
  ): Promise<License> {
    const db = getDatabase()

    // Find license by key
    const license = await db('licenses').where({ license_key: licenseKey }).first()
    if (!license) {
      throw notFound('License key not found')
    }

    if (license.status !== 'active') {
      throw conflict('License is not active')
    }

    // Validate expiry
    if (license.valid_until && new Date(license.valid_until) < new Date()) {
      throw conflict('License has expired')
    }

    // Check if user owns this license
    if (license.user_id !== userId) {
      throw unauthorized('You do not own this license')
    }

    // Add device
    await db('license_devices')
      .insert({
        id: uuid(),
        license_id: license.id,
        machine_id: machineId,
        machine_name: machineName || null,
        activated_at: new Date()
      })
      .onConflict(['license_id', 'machine_id'])
      .merge({ machine_name: machineName, activated_at: new Date() })

    return this.formatLicense(license)
  }

  async fetchLicense(userId: string): Promise<License | null> {
    const db = getDatabase()

    const license = await db('licenses')
      .where({ user_id: userId, status: 'active' })
      .orderBy('created_at', 'desc')
      .first()

    if (!license) {
      return null
    }

    return this.formatLicense(license)
  }

  async deactivateLicense(userId: string): Promise<void> {
    const db = getDatabase()

    const license = await db('licenses').where({ user_id: userId }).first()
    if (!license) {
      throw notFound('License not found')
    }

    // Mark as expired
    await db('licenses').where({ id: license.id }).update({
      status: 'expired',
      updated_at: new Date()
    })
  }

  async listLicenseDevices(userId: string): Promise<LicenseDevice[]> {
    const db = getDatabase()

    const license = await db('licenses').where({ user_id: userId }).first()
    if (!license) {
      return []
    }

    const devices = await db('license_devices').where({ license_id: license.id })

    return devices.map((d) => ({
      id: d.id,
      license_id: d.license_id,
      machine_id: d.machine_id,
      machine_name: d.machine_name,
      activated_at: d.activated_at,
      last_used_at: d.last_used_at
    }))
  }

  async deactivateDevice(userId: string, machineId: string): Promise<void> {
    const db = getDatabase()

    // Get user's license
    const license = await db('licenses').where({ user_id: userId }).first()
    if (!license) {
      throw notFound('License not found')
    }

    // Remove device
    await db('license_devices')
      .where({ license_id: license.id, machine_id: machineId })
      .delete()
  }

  private formatLicense(license: any): License {
    return {
      id: license.id,
      user_id: license.user_id,
      license_key: license.license_key,
      plan: license.plan,
      max_profiles: license.max_profiles,
      max_team_members: license.max_team_members,
      cloud_sync_enabled: license.cloud_sync_enabled,
      activated_at: license.activated_at,
      valid_until: license.valid_until,
      status: license.status,
      created_at: license.created_at,
      updated_at: license.updated_at
    }
  }
}

export const licenseService = new LicenseService()
