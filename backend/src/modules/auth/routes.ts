import type { FastifyInstance } from 'fastify'
import { AuthService } from './service.js'
import { requireAuth } from '../../shared/middleware/auth.js'
import { rateLimits } from '../../shared/middleware/rate-limit.js'
import {
  RegisterSchema, LoginSchema, RefreshSchema,
  ChangePasswordSchema, ForgotPasswordSchema,
  ResetPasswordSchema, VerifyEmailSchema, UpdateProfileSchema,
} from './schema.js'
import { AppError } from '../../shared/errors.js'

export async function authRoutes(app: FastifyInstance) {

  // POST /auth/register
  app.post('/register', { config: { rateLimit: rateLimits.register } }, async (req, reply) => {
    const input = RegisterSchema.parse(req.body)
    const result = await AuthService.register(input, req.ip, req.headers['user-agent'])
    return reply.status(201).send({ data: result })
  })

  // POST /auth/login
  app.post('/login', { config: { rateLimit: rateLimits.login } }, async (req, reply) => {
    const input = LoginSchema.parse(req.body)
    const result = await AuthService.login(input, req.ip, req.headers['user-agent'])
    return reply.send({ data: result })
  })

  // POST /auth/logout
  app.post('/logout', { preHandler: requireAuth }, async (req, reply) => {
    const body = req.body as { refresh_token?: string }
    await AuthService.logout(req.user.sub, body?.refresh_token)
    return reply.status(204).send()
  })

  // POST /auth/refresh
  app.post('/refresh', { config: { rateLimit: rateLimits.refresh } }, async (req, reply) => {
    const input = RefreshSchema.parse(req.body)
    const result = await AuthService.refresh(input, req.ip, req.headers['user-agent'])
    return reply.send({ data: result })
  })

  // GET /auth/me
  app.get('/me', { preHandler: requireAuth }, async (req, reply) => {
    const user = await AuthService.getMe(req.user.sub)
    return reply.send({ data: user })
  })

  // PUT /auth/me
  app.put('/me', { preHandler: requireAuth }, async (req, reply) => {
    const input = UpdateProfileSchema.parse(req.body)
    const user = await AuthService.updateMe(req.user.sub, input)
    return reply.send({ data: user })
  })

  // PUT /auth/password
  app.put('/password', { preHandler: requireAuth }, async (req, reply) => {
    const input = ChangePasswordSchema.parse(req.body)
    await AuthService.changePassword(req.user.sub, input)
    return reply.status(204).send()
  })

  // POST /auth/forgot-password
  app.post('/forgot-password', { config: { rateLimit: rateLimits.register } }, async (req, reply) => {
    const { email } = ForgotPasswordSchema.parse(req.body)
    await AuthService.forgotPassword(email)
    return reply.send({ data: { message: 'If that email exists, a reset link has been sent' } })
  })

  // POST /auth/reset-password
  app.post('/reset-password', async (req, reply) => {
    const { token, new_password } = ResetPasswordSchema.parse(req.body)
    await AuthService.resetPassword(token, new_password)
    return reply.status(204).send()
  })

  // POST /auth/verify-email
  app.post('/verify-email', async (req, reply) => {
    const { token } = VerifyEmailSchema.parse(req.body)
    await AuthService.verifyEmail(token)
    return reply.status(204).send()
  })

  // POST /auth/me/export  (GDPR)
  app.post('/me/export', { preHandler: requireAuth }, async (req, reply) => {
    const user = await AuthService.getMe(req.user.sub)
    return reply.send({ data: user })
  })

  // DELETE /auth/me  (GDPR account deletion)
  app.delete('/me', { preHandler: requireAuth }, async (req, reply) => {
    await AuthService.deleteAccount(req.user.sub)
    return reply.status(204).send()
  })
}
