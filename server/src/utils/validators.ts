import Joi from 'joi'
import { badRequest } from './errors'

// Base schemas
export const emailSchema = Joi.string().email().lowercase().required()
export const passwordSchema = Joi.string().min(8).max(255).required()
export const uuidSchema = Joi.string().uuid().required()
export const nameSchema = Joi.string().min(1).max(255).required()

// Auth validators
export const registerSchema = Joi.object({
  email: emailSchema,
  password: passwordSchema,
  full_name: Joi.string().max(255).optional()
})

export const loginSchema = Joi.object({
  email: emailSchema,
  password: Joi.string().required()
})

export const refreshTokenSchema = Joi.object({
  refresh_token: Joi.string().required()
})

export const passwordChangeSchema = Joi.object({
  current_password: Joi.string().required(),
  new_password: passwordSchema
})

// License validators
export const activateLicenseSchema = Joi.object({
  license_key: Joi.string().min(20).max(64).required(),
  machine_id: Joi.string().required()
})

// Team validators
export const createTeamSchema = Joi.object({
  name: nameSchema
})

export const updateTeamSchema = Joi.object({
  name: nameSchema
})

export const inviteMemberSchema = Joi.object({
  email: emailSchema,
  role: Joi.string().valid('admin', 'member').default('member')
})

export const updateMemberSchema = Joi.object({
  role: Joi.string().valid('owner', 'admin', 'member').required()
})

export const shareProfileSchema = Joi.object({
  profile_id: Joi.string().required(),
  member_ids: Joi.array().items(uuidSchema).min(1).required(),
  permission: Joi.string().valid('read', 'write').default('read')
})

export const unshareProfileSchema = Joi.object({
  profile_id: Joi.string().required(),
  member_id: uuidSchema
})

// Pagination helpers
export const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20)
})

// Audit query
export const auditQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50),
  user_id: Joi.string().uuid().optional(),
  action: Joi.string().optional()
})

// Sync validators
export const pushSyncSchema = Joi.object({
  data: Joi.string().required(),
  checksum: Joi.string().length(64).required(),
  profile_count: Joi.number().integer().min(0).required()
})

/**
 * Validate request data against schema
 */
export function validate<T>(data: unknown, schema: Joi.Schema): T {
  const { error, value } = schema.validate(data, { stripUnknown: true })
  if (error) {
    throw badRequest(error.details.map((d) => d.message).join(', '), 'validation_error')
  }
  return value as T
}
