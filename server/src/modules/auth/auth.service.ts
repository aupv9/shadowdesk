import { v4 as uuid } from 'uuid'
import { getDatabase } from '../../config/database'
import { hashPassword, verifyPassword, hashToken } from '../../utils/crypto'
import { createTokenPair } from '../../utils/jwt'
import { conflict, notFound, unauthorized } from '../../utils/errors'
import type { User, UserWithPassword } from '../../types'

export interface RegisterInput {
  email: string
  password: string
  full_name?: string
}

export interface LoginInput {
  email: string
  password: string
}

export class AuthService {
  async register(input: RegisterInput): Promise<{ user: User; accessToken: string; refreshToken: string; expiresIn: number }> {
    const db = getDatabase()
    const { email, password, full_name } = input

    // Check if user exists
    const existing = await db('users').where({ email }).first()
    if (existing) {
      throw conflict('Email is already registered', 'email_already_exists')
    }

    // Create user
    const userId = uuid()
    const passwordHash = await hashPassword(password)

    await db('users').insert({
      id: userId,
      email: email.toLowerCase(),
      password_hash: passwordHash,
      full_name: full_name || null,
      status: 'active'
    })

    // Create tokens
    const { accessToken, refreshToken, expiresIn } = createTokenPair(userId, email)

    // Store refresh token hash
    await this.storeRefreshToken(userId, refreshToken)

    const user = await this.getUserById(userId)
    if (!user) throw new Error('Failed to fetch created user')

    return { user, accessToken, refreshToken, expiresIn }
  }

  async login(input: LoginInput): Promise<{ user: User; accessToken: string; refreshToken: string; expiresIn: number }> {
    const db = getDatabase()
    const { email, password } = input

    // Find user
    const user = await db('users').where({ email: email.toLowerCase() }).first() as UserWithPassword | undefined
    if (!user) {
      throw unauthorized('Invalid email or password')
    }

    if (user.status !== 'active') {
      throw unauthorized('Account is not active')
    }

    // Verify password
    const passwordMatch = await verifyPassword(password, user.password_hash)
    if (!passwordMatch) {
      throw unauthorized('Invalid email or password')
    }

    // Create tokens
    const { accessToken, refreshToken, expiresIn } = createTokenPair(user.id, user.email)

    // Store refresh token hash
    await this.storeRefreshToken(user.id, refreshToken)

    // Update last login
    await db('users').where({ id: user.id }).update({
      last_login_at: new Date()
    })

    const userResponse: User = {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      email_verified: user.email_verified,
      status: user.status,
      created_at: user.created_at,
      updated_at: user.updated_at
    }

    return { user: userResponse, accessToken, refreshToken, expiresIn }
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const db = getDatabase()
    const tokenHash = hashToken(refreshToken)

    // Find token record
    const record = await db('auth_tokens').where({ refresh_token_hash: tokenHash }).first()
    if (!record || record.revoked_at) {
      throw unauthorized('Invalid or revoked refresh token')
    }

    // Check expiration
    if (new Date(record.expires_at) < new Date()) {
      throw unauthorized('Refresh token expired')
    }

    // Get user
    const user = await this.getUserById(record.user_id)
    if (!user) {
      throw notFound('User not found')
    }

    // Revoke old token
    await db('auth_tokens').where({ id: record.id }).update({ revoked_at: new Date() })

    // Create new token pair
    const newPair = createTokenPair(user.id, user.email)

    // Store new refresh token
    await this.storeRefreshToken(user.id, newPair.refreshToken)

    return newPair
  }

  async logout(refreshToken: string): Promise<void> {
    const db = getDatabase()
    const tokenHash = hashToken(refreshToken)

    await db('auth_tokens').where({ refresh_token_hash: tokenHash }).update({
      revoked_at: new Date()
    })
  }

  async getUserById(userId: string): Promise<User | null> {
    const db = getDatabase()
    const user = await db('users').where({ id: userId }).first()
    if (!user) return null

    return {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      email_verified: user.email_verified,
      status: user.status,
      created_at: user.created_at,
      updated_at: user.updated_at
    }
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const db = getDatabase()
    const user = await db('users').where({ email: email.toLowerCase() }).first()
    if (!user) return null

    return {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      email_verified: user.email_verified,
      status: user.status,
      created_at: user.created_at,
      updated_at: user.updated_at
    }
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const db = getDatabase()

    const user = await db('users').where({ id: userId }).first() as UserWithPassword | undefined
    if (!user) {
      throw notFound('User not found')
    }

    // Verify current password
    const passwordMatch = await verifyPassword(currentPassword, user.password_hash)
    if (!passwordMatch) {
      throw unauthorized('Current password is incorrect')
    }

    // Hash and update new password
    const newHash = await hashPassword(newPassword)
    await db('users').where({ id: userId }).update({
      password_hash: newHash,
      updated_at: new Date()
    })

    // Revoke all refresh tokens (user must re-login)
    await db('auth_tokens').where({ user_id: userId }).update({
      revoked_at: new Date()
    })
  }

  async deleteAccount(userId: string): Promise<void> {
    const db = getDatabase()

    // Soft delete user
    await db('users').where({ id: userId }).update({
      status: 'deleted',
      deleted_at: new Date(),
      deletion_requested_at: new Date(),
      updated_at: new Date()
    })

    // Revoke all tokens
    await db('auth_tokens').where({ user_id: userId }).update({
      revoked_at: new Date()
    })
  }

  private async storeRefreshToken(userId: string, refreshToken: string): Promise<void> {
    const db = getDatabase()
    const tokenHash = hashToken(refreshToken)

    // Refresh tokens expire in 7 days
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    await db('auth_tokens').insert({
      id: uuid(),
      user_id: userId,
      refresh_token_hash: tokenHash,
      expires_at: expiresAt
    })
  }
}

export const authService = new AuthService()
