import { networkInterfaces, cpus } from 'os'
import { createHash } from 'crypto'
import { apiRequest } from './api-client'
import { Database } from './database'
import type { License, LicenseDevice } from '../shared/types'

/**
 * Ghost Browser License Service
 *
 * Server endpoints (mounted at /licenses):
 *   POST /licenses/activate          — Activate license key on machine
 *   GET  /licenses/current           — Fetch current license
 *   POST /licenses/deactivate        — Deactivate license
 *   GET  /licenses/devices           — List activated devices
 *   POST /licenses/devices/deactivate — Deactivate specific device { machine_id }
 */

let cachedLicense: License | null = null

export function getMachineId(): string {
  const nets = networkInterfaces()
  const macs: string[] = []
  for (const name of Object.keys(nets)) {
    for (const iface of nets[name] ?? []) {
      if (!iface.internal && iface.mac !== '00:00:00:00:00:00') {
        macs.push(iface.mac)
      }
    }
  }
  macs.sort()

  const cpuModel = cpus()[0]?.model ?? 'unknown'
  const raw = `${macs.join(',')}|${cpuModel}`
  return createHash('sha256').update(raw).digest('hex').slice(0, 32)
}

/**
 * POST /licenses/activate
 * Request: { license_key, machine_id }
 * Response: License object
 */
export async function activateLicense(licenseKey: string): Promise<License> {
  const machineId = getMachineId()
  const license = await apiRequest<License>('/licenses/activate', {
    method: 'POST',
    body: { license_key: licenseKey, machine_id: machineId }
  })
  cachedLicense = license
  return license
}

/**
 * GET /licenses/current
 * Response: License object or null
 */
export async function fetchLicense(): Promise<License | null> {
  if (cachedLicense) return cachedLicense

  try {
    const license = await apiRequest<License>('/licenses/current')
    cachedLicense = license
    return license
  } catch {
    return null
  }
}

/**
 * POST /licenses/deactivate
 * Response: 204 No Content
 */
export async function deactivateLicense(): Promise<void> {
  await apiRequest('/licenses/deactivate', { method: 'POST' })
  cachedLicense = null
}

/**
 * GET /licenses/devices
 * Response: LicenseDevice[]
 */
export async function listLicenseDevices(): Promise<LicenseDevice[]> {
  try {
    const devices = await apiRequest<LicenseDevice[]>('/licenses/devices')
    const currentMachineId = getMachineId()
    return devices.map((d) => ({ ...d, is_current: d.machine_id === currentMachineId }))
  } catch {
    return []
  }
}

/**
 * POST /licenses/devices/deactivate
 * Request: { machine_id }
 * Response: 204 No Content
 */
export async function deactivateDevice(machineId: string): Promise<void> {
  if (machineId === getMachineId()) {
    throw new Error('Use "Deactivate license from this machine" for the current device')
  }
  await apiRequest('/licenses/devices/deactivate', {
    method: 'POST',
    body: { machine_id: machineId }
  })
}

export function getFreePlanLicense(): License {
  return {
    id: 'free',
    plan: 'free',
    max_profiles: 5,
    max_team_members: 1,
    cloud_sync_enabled: false,
    valid_until: '2099-12-31T23:59:59Z',
    machine_id: getMachineId(),
    activated_at: new Date().toISOString()
  }
}

const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000

export function getCurrentLicense(): License {
  if (!cachedLicense) return getFreePlanLicense()
  if (cachedLicense.plan === 'free') return cachedLicense

  const validUntil = new Date(cachedLicense.valid_until).getTime()
  if (Number.isNaN(validUntil)) return cachedLicense

  if (Date.now() > validUntil + GRACE_PERIOD_MS) {
    return getFreePlanLicense()
  }
  return cachedLicense
}

export function getLicenseStatus(): {
  status: 'active' | 'grace' | 'expired' | 'free'
  days_until_expiry: number
  in_grace_period: boolean
} {
  if (!cachedLicense || cachedLicense.plan === 'free') {
    return { status: 'free', days_until_expiry: 0, in_grace_period: false }
  }
  const validUntil = new Date(cachedLicense.valid_until).getTime()
  if (Number.isNaN(validUntil)) {
    return { status: 'active', days_until_expiry: 0, in_grace_period: false }
  }
  const diffMs = validUntil - Date.now()
  const days = Math.ceil(diffMs / (24 * 60 * 60 * 1000))
  if (diffMs > 0) {
    return { status: 'active', days_until_expiry: days, in_grace_period: false }
  }
  if (-diffMs <= GRACE_PERIOD_MS) {
    return { status: 'grace', days_until_expiry: days, in_grace_period: true }
  }
  return { status: 'expired', days_until_expiry: days, in_grace_period: false }
}

export function checkProfileLimit(): { allowed: boolean; current: number; max: number } {
  const license = getCurrentLicense()
  const db = Database.getInstance()
  const profiles = db.getAllProfiles()
  const current = profiles.length
  const max = license.max_profiles

  return {
    allowed: max === -1 || current < max,
    current,
    max: max === -1 ? Infinity : max
  }
}

export function checkTeamMemberLimit(currentMembers: number): boolean {
  const license = getCurrentLicense()
  return license.max_team_members === -1 || currentMembers < license.max_team_members
}

export function getUsage(): { profiles: number; members: number } {
  const db = Database.getInstance()
  const profiles = db.getAllProfiles()
  return { profiles: profiles.length, members: 0 }
}

/** Placeholder — pricing plans not implemented on server yet. */
export async function fetchPricingPlans(): Promise<any[]> {
  return []
}

/** Placeholder — invoices not implemented on server yet. */
export async function fetchInvoices(_params?: { page?: number; limit?: number }): Promise<any[]> {
  return []
}
