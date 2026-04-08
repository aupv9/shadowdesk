import { z } from 'zod'

export const CreateTeamSchema  = z.object({ name: z.string().min(1).max(100) })
export const UpdateTeamSchema  = z.object({ name: z.string().min(1).max(100) })
export const InviteMemberSchema = z.object({
  email: z.string().email(),
  role:  z.enum(['admin', 'editor', 'viewer']).default('viewer'),
})
export const UpdateMemberRoleSchema = z.object({
  role: z.enum(['admin', 'editor', 'viewer']),
})
export const ShareProfileSchema = z.object({
  profile_id:   z.string().min(1),
  profile_name: z.string().min(1),
  member_ids:   z.array(z.string().uuid()).min(1),
  permission:   z.enum(['read', 'write']).default('read'),
})
export const UnshareProfileSchema = z.object({
  profile_id: z.string().min(1),
  member_id:  z.string().uuid(),
})
export const AuditQuerySchema = z.object({
  page:    z.coerce.number().min(1).default(1),
  limit:   z.coerce.number().min(1).max(100).default(50),
  user_id: z.string().uuid().optional(),
  action:  z.string().optional(),
})
