import { app } from 'electron'
import { networkInterfaces, cpus } from 'os'
import { createHash } from 'crypto'
import { apiRequest } from './api-client'
import { Database } from './database'
import type { License, LicensePlan, PLAN_LIMITS } from '../shared/types'

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

export function getCurrentLicense(): License {
  return cachedLicense ?? getFreePlanLicense()
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
