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

// Profile validators
export const createProfileSchema = Joi.object({
  name: nameSchema,
  group_id: Joi.string().uuid().optional(),
  fingerprint_preset: Joi.string().optional(),
  fingerprint_config: Joi.object().optional(),
  proxy_config: Joi.object().optional(),
  notes: Joi.string().max(500).optional(),
  tags: Joi.array().items(Joi.string()).optional()
})

export const updateProfileSchema = Joi.object({
  name: nameSchema.optional(),
  group_id: Joi.string().uuid().optional(),
  fingerprint_preset: Joi.string().optional(),
  fingerprint_config: Joi.object().optional(),
  proxy_config: Joi.object().optional(),
  notes: Joi.string().max(500).optional(),
  tags: Joi.array().items(Joi.string()).optional()
})

export const createProfileVersionSchema = Joi.object({
  fingerprint_config: Joi.object().required(),
  proxy_config: Joi.object().optional(),
  label: Joi.string().max(100).optional()
})

export const createProfileGroupSchema = Joi.object({
  name: nameSchema,
  description: Joi.string().max(500).optional(),
  color: Joi.string().regex(/^#[0-9A-F]{6}$/i).optional()
})

export const updateProfileGroupSchema = Joi.object({
  name: nameSchema.optional(),
  description: Joi.string().max(500).optional(),
  color: Joi.string().regex(/^#[0-9A-F]{6}$/i).optional()
})

export const shareProfileUserSchema = Joi.object({
  user_id: uuidSchema,
  permission: Joi.string().valid('read', 'write', 'admin').default('read')
})

// Workflow validators
export const createWorkflowSchema = Joi.object({
  name: nameSchema,
  description: Joi.string().max(500).optional(),
  steps: Joi.array().items(Joi.object()).min(1).required(),
  variables: Joi.object().optional(),
  tags: Joi.array().items(Joi.string()).optional(),
  status: Joi.string().valid('draft', 'published', 'archived').default('draft')
})

export const updateWorkflowSchema = Joi.object({
  name: nameSchema.optional(),
  description: Joi.string().max(500).optional(),
  steps: Joi.array().items(Joi.object()).optional(),
  variables: Joi.object().optional(),
  tags: Joi.array().items(Joi.string()).optional(),
  status: Joi.string().valid('draft', 'published', 'archived').optional()
})

export const executeWorkflowSchema = Joi.object({
  profile_id: Joi.string().optional(),
  variables: Joi.object().optional()
})

export const createScheduleSchema = Joi.object({
  workflow_id: Joi.string().required(),
  profile_id: Joi.string().optional(),
  cron_expression: Joi.string().required(),
  timezone: Joi.string().optional().default('UTC'),
  max_runs: Joi.number().integer().min(1).optional()
})

export const updateScheduleSchema = Joi.object({
  cron_expression: Joi.string().optional(),
  timezone: Joi.string().optional(),
  max_runs: Joi.number().integer().min(1).optional(),
  status: Joi.string().valid('active', 'paused').optional()
})

// Detection validators
export const createDetectionTestSchema = Joi.object({
  profile_id: Joi.string().uuid().required(),
  profile_name: Joi.string().max(255).optional(),
  fingerprint_preset: Joi.string().max(255).optional()
})

export const completeDetectionTestSchema = Joi.object({
  overall_score: Joi.number().min(0).max(100).required(),
  test_duration_ms: Joi.number().integer().min(0).optional(),
  results: Joi.array()
    .items(
      Joi.object({
        vector_name: Joi.string().required(),
        vector_category: Joi.string().required(),
        passed: Joi.boolean().required(),
        score: Joi.number().min(0).max(100).optional(),
        risk_level: Joi.string().valid('low', 'medium', 'high', 'critical').optional(),
        detail: Joi.string().optional(),
        raw_data: Joi.object().optional()
      })
    )
    .required()
})

export const compareTestsSchema = Joi.object({
  test_id_a: Joi.string().uuid().required(),
  test_id_b: Joi.string().uuid().required()
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
