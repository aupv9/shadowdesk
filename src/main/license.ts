import { app } from 'electron'
import { networkInterfaces, cpus } from 'os'
import { createHash } from 'crypto'
import { apiRequest } from './api-client'
import { Database } from './database'
import type { License, LicenseDevice, LicensePlan, PLAN_LIMITS } from '../shared/types'

let cachedLicense: License | null = null

export function getMachineId(): string {
  // Deterministic machine fingerprint: hash of MAC addresses + CPU model
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

export async function activateLicense(licenseKey: string): Promise<License> {
  const machineId = getMachineId()
  const license = await apiRequest<License>('/licenses/activate', {
    method: 'POST',
    body: { license_key: licenseKey, machine_id: machineId }
  })
  cachedLicense = license
  return license
}

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

export async function deactivateLicense(): Promise<void> {
  await apiRequest('/licenses/deactivate', { method: 'POST' })
  cachedLicense = null
}

// E1: List all machines this license has been activated on. The current
// machine is flagged so the renderer can highlight (and prevent
// self-deactivation through the device dashboard, which uses the
// existing local "Deactivate license from this machine" link instead).
export async function listLicenseDevices(): Promise<LicenseDevice[]> {
  try {
    const devices = await apiRequest<LicenseDevice[]>('/licenses/devices')
    const currentMachineId = getMachineId()
    return devices.map((d) => ({ ...d, is_current: d.machine_id === currentMachineId }))
  } catch {
    // Backend may not implement this yet — degrade gracefully so the
    // renderer can hide the section instead of crashing.
    return []
  }
}

// E1: Remotely deactivate a different machine. Refuses to act on the
// current machine — that flow goes through `deactivateLicense()` so the
// in-memory cache is cleared too.
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

/**
 * 7-day grace period after `valid_until` during which the license still
 * grants its paid limits. After grace, fall back to the free plan so
 * abandoned subscriptions don't keep paid features unlocked indefinitely.
 */
const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000

export function getCurrentLicense(): License {
  if (!cachedLicense) return getFreePlanLicense()
  // Free-plan sentinel never expires.
  if (cachedLicense.plan === 'free') return cachedLicense

  const validUntil = new Date(cachedLicense.valid_until).getTime()
  if (Number.isNaN(validUntil)) return cachedLicense

  // Past grace period → drop to free plan limits.
  if (Date.now() > validUntil + GRACE_PERIOD_MS) {
    return getFreePlanLicense()
  }
  return cachedLicense
}

/**
 * Computed license status used by the renderer to drive expiry banners.
 * `active`  — `valid_until` is in the future
 * `grace`   — within 7 days past `valid_until`, paid limits still apply
 * `expired` — beyond grace, falling back to free plan
 */
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
