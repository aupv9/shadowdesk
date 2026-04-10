import { Request, Response } from 'express'
import { authService } from './auth.service'
import { validate, registerSchema, loginSchema, refreshTokenSchema, passwordChangeSchema } from '../../utils/validators'
import { unauthorized } from '../../utils/errors'
import { logger } from '../../utils/logger'

export class AuthController {
  async register(req: Request, res: Response): Promise<void> {
    const input = validate(req.body, registerSchema)
    const result = await authService.register(input)

    res.status(201).json({
      user: result.user,
      tokens: {
        access_token: result.accessToken,
        refresh_token: result.refreshToken,
        expires_at: Math.floor(Date.now() / 1000) + result.expiresIn
      }
    })

    logger.info('User registered', { userId: result.user.id, email: result.user.email })
  }

  async login(req: Request, res: Response): Promise<void> {
    const input = validate(req.body, loginSchema)
    const result = await authService.login(input)

    res.json({
      user: result.user,
      tokens: {
        access_token: result.accessToken,
        refresh_token: result.refreshToken,
        expires_at: Math.floor(Date.now() / 1000) + result.expiresIn
      }
    })

    logger.info('User logged in', { userId: result.user.id })
  }

  async refresh(req: Request, res: Response): Promise<void> {
    const input = validate(req.body, refreshTokenSchema)
    const result = await authService.refreshToken(input.refresh_token)

    res.json({
      access_token: result.accessToken,
      refresh_token: result.refreshToken,
      expires_at: Math.floor(Date.now() / 1000) + result.expiresIn
    })
  }

  async logout(req: Request, res: Response): Promise<void> {
    const input = validate(req.body, refreshTokenSchema)

    if (req.userId) {
      await authService.logout(input.refresh_token)
      logger.info('User logged out', { userId: req.userId })
    }

    res.status(204).send()
  }

  async getCurrentUser(req: Request, res: Response): Promise<void> {
    if (!req.userId) {
      throw unauthorized('User not authenticated')
    }

    const user = await authService.getUserById(req.userId)
    if (!user) {
      throw unauthorized('User not found')
    }

    res.json(user)
  }

  async changePassword(req: Request, res: Response): Promise<void> {
    if (!req.userId) {
      throw unauthorized('User not authenticated')
    }

    const input = validate(req.body, passwordChangeSchema)
    await authService.changePassword(req.userId, input.current_password, input.new_password)

    logger.info('Password changed', { userId: req.userId })
    res.status(204).send()
  }

  async deleteAccount(req: Request, res: Response): Promise<void> {
    if (!req.userId) {
      throw unauthorized('User not authenticated')
    }

    await authService.deleteAccount(req.userId)

    logger.info('Account deleted', { userId: req.userId })
    res.status(204).send()
  }

  async exportUserData(req: Request, res: Response): Promise<void> {
    if (!req.userId) {
      throw unauthorized('User not authenticated')
    }

    const user = await authService.getUserById(req.userId)
    if (!user) {
      throw unauthorized('User not found')
    }

    // In a real implementation, this would gather all user data
    const exportData = {
      user,
      exported_at: new Date().toISOString()
    }

    logger.info('User data exported', { userId: req.userId })
    res.json(exportData)
  }

  async resendVerificationEmail(req: Request, res: Response): Promise<void> {
    if (!req.userId) {
      throw unauthorized('User not authenticated')
    }

    // In a real implementation, this would send an email
    logger.info('Verification email resend requested', { userId: req.userId })
    res.status(204).send()
  }
}

export const authController = new AuthController()
