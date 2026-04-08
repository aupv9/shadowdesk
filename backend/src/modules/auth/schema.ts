import { z } from 'zod'

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1).max(100),
})

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const RefreshSchema = z.object({
  refresh_token: z.string().min(1),
})

export const ChangePasswordSchema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(8),
})

export const ForgotPasswordSchema = z.object({
  email: z.string().email(),
})

export const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  new_password: z.string().min(8),
})

export const VerifyEmailSchema = z.object({
  token: z.string().min(1),
})

export const UpdateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  avatar_url: z.string().url().optional().nullable(),
})

export type RegisterInput       = z.infer<typeof RegisterSchema>
export type LoginInput          = z.infer<typeof LoginSchema>
export type RefreshInput        = z.infer<typeof RefreshSchema>
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>
export type ResetPasswordInput  = z.infer<typeof ResetPasswordSchema>
export type UpdateProfileInput  = z.infer<typeof UpdateProfileSchema>
