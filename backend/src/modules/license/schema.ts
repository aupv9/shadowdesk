import { z } from 'zod'

export const ActivateLicenseSchema = z.object({
  license_key: z.string().min(1),
  machine_id:  z.string().min(1),
  label:       z.string().optional(),
  os:          z.string().optional(),
})

export const DeactivateDeviceSchema = z.object({
  machine_id: z.string().min(1),
})

export type ActivateLicenseInput   = z.infer<typeof ActivateLicenseSchema>
export type DeactivateDeviceInput  = z.infer<typeof DeactivateDeviceSchema>
