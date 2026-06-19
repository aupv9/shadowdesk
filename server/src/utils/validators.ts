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

// User profile validators
export const updateUserProfileSchema = Joi.object({
  display_name: Joi.string().max(255).allow(null, ''),
  bio: Joi.string().max(1000).allow(null, ''),
  timezone: Joi.string().max(64).allow(null, ''),
  language: Joi.string().max(16).allow(null, ''),
  metadata: Joi.object()
})

// Support validators
export const createTicketSchema = Joi.object({
  subject: Joi.string().min(1).max(255).required(),
  category: Joi.string()
    .valid('bug', 'feature_request', 'billing', 'account', 'detection', 'proxy', 'general')
    .required(),
  priority: Joi.string().valid('low', 'normal', 'high', 'urgent').default('normal'),
  message: Joi.string().min(1).max(10000).required(),
  diagnostics: Joi.object()
})

export const replyTicketSchema = Joi.object({
  message: Joi.string().min(1).max(10000).required()
})

export const feedbackSchema = Joi.object({
  type: Joi.string().valid('feature_request', 'improvement', 'praise', 'other').required(),
  message: Joi.string().min(1).max(10000).required(),
  rating: Joi.number().integer().min(1).max(5),
  context: Joi.string().max(255).allow('', null),
  app_version: Joi.string().max(64).allow('', null),
  platform: Joi.string().max(64).allow('', null)
})

// API key validators
export const createApiKeySchema = Joi.object({
  name: Joi.string().min(1).max(255).required(),
  scopes: Joi.array().items(Joi.string()).min(1).required(),
  expires_in: Joi.number().integer().min(1).max(3650) // days
})

// Cloud profile validators
export const backupProfileSchema = Joi.object({
  local_id: Joi.string().required(),
  name: nameSchema,
  fingerprint: Joi.string().required(),
  fingerprint_hash: Joi.string().max(128).required(),
  preset: Joi.string().max(128).default('custom'),
  proxy_config: Joi.object({ type: Joi.string(), country: Joi.string() }).allow(null),
  cookies: Joi.string().allow(null, ''),
  notes: Joi.string().allow(null, '').max(2000),
  tags: Joi.array().items(Joi.string()).default([])
})

export const updateCloudTagsSchema = Joi.object({
  tags: Joi.array().items(Joi.string()).required()
})

export const bulkDeleteSchema = Joi.object({
  ids: Joi.array().items(Joi.string()).min(1).required()
})

// Analytics validators
export const usageSnapshotSchema = Joi.object({
  machine_id: Joi.string().required(),
  app_version: Joi.string().required(),
  profile_count: Joi.number().integer().min(0).default(0),
  active_session_count: Joi.number().integer().min(0).default(0),
  proxy_count: Joi.number().integer().min(0).default(0),
  workflow_count: Joi.number().integer().min(0).default(0),
  detection_avg_score: Joi.number().allow(null),
  os_platform: Joi.string().allow('', null),
  timestamp: Joi.string()
})

export const detectionScoreSchema = Joi.object({
  profile_id: Joi.string().required(),
  profile_name: Joi.string().allow('', null),
  overall_score: Joi.number().min(0).max(100).required(),
  vector_count: Joi.number().integer().min(0).default(0),
  passed_count: Joi.number().integer().min(0).default(0),
  warned_count: Joi.number().integer().min(0).default(0),
  failed_count: Joi.number().integer().min(0).default(0),
  tested_at: Joi.string()
})

export const analyticsEventsSchema = Joi.object({
  events: Joi.array()
    .items(
      Joi.object({
        feature: Joi.string().required(),
        action: Joi.string().required(),
        metadata: Joi.object(),
        timestamp: Joi.string()
      })
    )
    .required()
})

// Remote config validators
export const remoteConfigClientSchema = Joi.object({
  app_version: Joi.string().allow('', null),
  machine_id: Joi.string().allow('', null),
  platform: Joi.string().allow('', null)
})

// Billing validators
export const checkoutSchema = Joi.object({
  plan_id: Joi.string().required(),
  interval: Joi.string().valid('monthly', 'yearly').default('monthly')
})

export const promoSchema = Joi.object({
  code: Joi.string().min(1).max(64).required()
})

/**
 * Validate request data against schema
 */
export function validate<T = any>(data: unknown, schema: Joi.Schema): T {
  const { error, value } = schema.validate(data, { stripUnknown: true })
  if (error) {
    throw badRequest(error.details.map((d) => d.message).join(', '), 'validation_error')
  }
  return value as T
}
