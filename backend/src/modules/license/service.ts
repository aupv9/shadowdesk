import { eq, and, count } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { licenses, licenseDevices } from '../../db/schema.js'
import { AppError } from '../../shared/errors.js'
import type { ActivateLicenseInput } from './schema.js'

export const PLAN_LIMITS = {
  free:         { profiles: 5,    members: 1,   sync: false, webhooks: 1  },
  starter:      { profiles: 50,   members: 3,   sync: true,  webhooks: 5  },
  professional: { profiles: 500,  members: 15,  sync: true,  webhooks: 20 },
  enterprise:   { profiles: -1,   members: -1,  sync: true,  webhooks: -1 },
} as const

const GRACE_PERIOD_DAYS = 7

function resolvePlan(license: typeof licenses.$inferSelect) {
  if (license.status === 'suspended') return 'free'

  if (license.validUntil) {
    const now = new Date()
    const graceCutoff = new Date(license.validUntil)
    graceCutoff.setDate(graceCutoff.getDate() + GRACE_PERIOD_DAYS)

    if (now > graceCutoff) return 'free'  // past grace period
  }

  return license.plan as keyof typeof PLAN_LIMITS
}

function serializeLicense(license: typeof licenses.$inferSelect, devices: typeof licenseDevices.$inferSelect[], machineId?: string) {
  const effectivePlan = resolvePlan(license)
  const limits = PLAN_LIMITS[effectivePlan] ?? PLAN_LIMITS.free

  return {
    id:                  license.id,
    plan:                effectivePlan,
    original_plan:       license.plan,
    status:              license.status,
    valid_until:         license.validUntil,
    is_trial:            license.isTrial,
    trial_ends_at:       license.trialEndsAt,
    seats_max:           license.seatsMax,
    seats_used:          devices.length,
    max_profiles:        limits.profiles,
    max_team_members:    limits.members,
    cloud_sync_enabled:  limits.sync,
    max_webhooks:        limits.webhooks,
    machine_id:          machineId,
    activated_at:        license.createdAt,
  }
}

export const LicenseService = {
  async getCurrent(userId: string, machineId?: string) {
    const [license] = await db
      .select()
      .from(licenses)
      .where(eq(licenses.userId, userId))
      .limit(1)

    if (!license) {
      // Auto-create free license if missing (shouldn't happen after register)
      const [created] = await db.insert(licenses).values({
        userId,
        licenseKey: `FREE-${userId.slice(0, 8).toUpperCase()}`,
        plan: 'free',
      }).returning()

      return serializeLicense(created, [], machineId)
    }

    const devices = await db
      .select()
      .from(licenseDevices)
      .where(eq(licenseDevices.licenseId, license.id))

    return serializeLicense(license, devices, machineId)
  },

  async activate(userId: string, input: ActivateLicenseInput) {
    // Find license by key — must match this user
    const [license] = await db
      .select()
      .from(licenses)
      .where(and(eq(licenses.licenseKey, input.license_key), eq(licenses.userId, userId)))
      .limit(1)

    if (!license) {
      throw new AppError('LICENSE_INVALID_KEY', 'License key not found or does not belong to your account')
    }

    // Check if device already activated
    const [existing] = await db
      .select()
      .from(licenseDevices)
      .where(and(
        eq(licenseDevices.licenseId, license.id),
        eq(licenseDevices.machineId, input.machine_id),
      ))
      .limit(1)

    if (existing) {
      // Update last seen
      await db.update(licenseDevices)
        .set({ lastSeenAt: new Date() })
        .where(eq(licenseDevices.id, existing.id))

      const devices = await db.select().from(licenseDevices)
        .where(eq(licenseDevices.licenseId, license.id))

      return serializeLicense(license, devices, input.machine_id)
    }

    // Check seats
    const [{ value: deviceCount }] = await db
      .select({ value: count() })
      .from(licenseDevices)
      .where(eq(licenseDevices.licenseId, license.id))

    if (license.seatsMax !== -1 && deviceCount >= license.seatsMax) {
      throw new AppError('LICENSE_SEATS_EXCEEDED', `This license allows ${license.seatsMax} device(s). Deactivate another device first.`)
    }

    // Activate
    await db.insert(licenseDevices).values({
      licenseId:  license.id,
      machineId:  input.machine_id,
      label:      input.label,
      os:         input.os,
      lastSeenAt: new Date(),
    })

    const devices = await db.select().from(licenseDevices)
      .where(eq(licenseDevices.licenseId, license.id))

    return serializeLicense(license, devices, input.machine_id)
  },

  async deactivateCurrent(userId: string, machineId: string) {
    const [license] = await db
      .select()
      .from(licenses)
      .where(eq(licenses.userId, userId))
      .limit(1)

    if (!license) throw new AppError('LICENSE_NOT_FOUND', 'No license found')

    await db.delete(licenseDevices).where(and(
      eq(licenseDevices.licenseId, license.id),
      eq(licenseDevices.machineId, machineId),
    ))
  },

  async getDevices(userId: string) {
    const [license] = await db
      .select()
      .from(licenses)
      .where(eq(licenses.userId, userId))
      .limit(1)

    if (!license) return []

    return db.select().from(licenseDevices)
      .where(eq(licenseDevices.licenseId, license.id))
  },

  async removeDevice(userId: string, machineId: string) {
    const [license] = await db
      .select()
      .from(licenses)
      .where(eq(licenses.userId, userId))
      .limit(1)

    if (!license) throw new AppError('LICENSE_NOT_FOUND', 'No license found')

    await db.delete(licenseDevices).where(and(
      eq(licenseDevices.licenseId, license.id),
      eq(licenseDevices.machineId, machineId),
    ))
  },
}
