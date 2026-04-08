import * as argon2 from 'argon2'
import { eq, and, lt, isNull } from 'drizzle-orm'
import { db } from '../../db/client.js'
import {
  users, sessions, oneTimeTokens, licenses,
  type User,
} from '../../db/schema.js'
import {
  sha256, secureToken,
  signAccessToken, signRefreshToken, verifyRefreshToken,
} from '../../shared/crypto.js'
import { AppError } from '../../shared/errors.js'
import { env } from '../../config.js'
import type {
  RegisterInput, LoginInput, RefreshInput,
  ChangePasswordInput, UpdateProfileInput,
} from './schema.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function serializeUser(user: User) {
  return {
    id:                 user.id,
    email:              user.email,
    name:               user.name,
    avatar_url:         user.avatarUrl,
    email_verified:     user.emailVerified,
    email_verified_at:  user.emailVerifiedAt,
    created_at:         user.createdAt,
  }
}

async function buildTokens(user: User, ipAddress?: string, userAgent?: string) {
  // Load active license to embed plan in JWT
  const [license] = await db
    .select()
    .from(licenses)
    .where(eq(licenses.userId, user.id))
    .limit(1)

  const plan = license?.plan ?? 'free'

  const accessToken  = await signAccessToken({ sub: user.id, email: user.email, plan })
  const rawRefresh   = await signRefreshToken(user.id)
  const tokenHash    = sha256(rawRefresh)
  const expiresAt    = new Date(Date.now() + env.JWT_REFRESH_TTL * 1000)

  await db.insert(sessions).values({
    userId:    user.id,
    tokenHash,
    userAgent,
    ipAddress,
    expiresAt,
  })

  return {
    access_token:  accessToken,
    refresh_token: rawRefresh,
    expires_at:    Math.floor(expiresAt.getTime() / 1000),
  }
}

// ---------------------------------------------------------------------------
// AuthService
// ---------------------------------------------------------------------------
export const AuthService = {
  async register(input: RegisterInput, ip?: string, ua?: string) {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1)

    if (existing.length > 0) {
      throw new AppError('AUTH_EMAIL_ALREADY_EXISTS', 'An account with this email already exists')
    }

    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id })

    const [user] = await db.insert(users).values({
      email:        input.email,
      name:         input.name,
      passwordHash,
    }).returning()

    // Create free license automatically
    await db.insert(licenses).values({
      userId:     user.id,
      licenseKey: `FREE-${user.id.slice(0, 8).toUpperCase()}`,
      plan:       'free',
    })

    // TODO: queue email verification email

    const tokens = await buildTokens(user, ip, ua)
    return { user: serializeUser(user), tokens }
  },

  async login(input: LoginInput, ip?: string, ua?: string) {
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.email, input.email), isNull(users.deletedAt)))
      .limit(1)

    if (!user) {
      throw new AppError('AUTH_INVALID_CREDENTIALS', 'Invalid email or password')
    }

    const valid = await argon2.verify(user.passwordHash, input.password)
    if (!valid) {
      throw new AppError('AUTH_INVALID_CREDENTIALS', 'Invalid email or password')
    }

    const tokens = await buildTokens(user, ip, ua)
    return { user: serializeUser(user), tokens }
  },

  async refresh(input: RefreshInput, ip?: string, ua?: string) {
    let userId: string
    try {
      const payload = await verifyRefreshToken(input.refresh_token)
      userId = payload.sub
    } catch {
      throw new AppError('AUTH_TOKEN_INVALID', 'Refresh token is invalid or expired')
    }

    const tokenHash = sha256(input.refresh_token)
    const [session] = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.tokenHash, tokenHash), eq(sessions.userId, userId)))
      .limit(1)

    if (!session || session.expiresAt < new Date()) {
      throw new AppError('AUTH_TOKEN_EXPIRED', 'Session has expired, please log in again')
    }

    // Rotate: delete old session
    await db.delete(sessions).where(eq(sessions.id, session.id))

    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .limit(1)

    if (!user) {
      throw new AppError('AUTH_TOKEN_INVALID', 'User not found')
    }

    const tokens = await buildTokens(user, ip, ua)
    return { tokens }
  },

  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      const tokenHash = sha256(refreshToken)
      await db.delete(sessions).where(
        and(eq(sessions.userId, userId), eq(sessions.tokenHash, tokenHash))
      )
    } else {
      // Logout all devices
      await db.delete(sessions).where(eq(sessions.userId, userId))
    }
  },

  async getMe(userId: string) {
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .limit(1)

    if (!user) throw new AppError('NOT_FOUND', 'User not found')
    return serializeUser(user)
  },

  async updateMe(userId: string, input: UpdateProfileInput) {
    const [updated] = await db
      .update(users)
      .set({
        ...(input.name      !== undefined && { name: input.name }),
        ...(input.avatar_url !== undefined && { avatarUrl: input.avatar_url }),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning()

    return serializeUser(updated)
  },

  async changePassword(userId: string, input: ChangePasswordInput) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    if (!user) throw new AppError('NOT_FOUND', 'User not found')

    const valid = await argon2.verify(user.passwordHash, input.current_password)
    if (!valid) {
      throw new AppError('AUTH_INVALID_CREDENTIALS', 'Current password is incorrect')
    }

    const newHash = await argon2.hash(input.new_password, { type: argon2.argon2id })
    await db.update(users).set({ passwordHash: newHash, updatedAt: new Date() })
      .where(eq(users.id, userId))

    // Invalidate all sessions
    await db.delete(sessions).where(eq(sessions.userId, userId))
  },

  async forgotPassword(email: string) {
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)))
      .limit(1)

    // Always return success to prevent email enumeration
    if (!user) return

    const rawToken = secureToken()
    const tokenHash = sha256(rawToken)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    await db.insert(oneTimeTokens).values({
      userId:    user.id,
      type:      'password_reset',
      tokenHash,
      expiresAt,
    })

    // TODO: queue email with reset link containing rawToken
  },

  async resetPassword(token: string, newPassword: string) {
    const tokenHash = sha256(token)
    const [ott] = await db
      .select()
      .from(oneTimeTokens)
      .where(and(
        eq(oneTimeTokens.tokenHash, tokenHash),
        eq(oneTimeTokens.type, 'password_reset'),
        isNull(oneTimeTokens.usedAt),
      ))
      .limit(1)

    if (!ott || ott.expiresAt < new Date()) {
      throw new AppError('AUTH_INVALID_RESET_TOKEN', 'Reset token is invalid or expired')
    }

    const newHash = await argon2.hash(newPassword, { type: argon2.argon2id })

    await db.transaction(async (tx) => {
      await tx.update(users).set({ passwordHash: newHash, updatedAt: new Date() })
        .where(eq(users.id, ott.userId))
      await tx.update(oneTimeTokens).set({ usedAt: new Date() })
        .where(eq(oneTimeTokens.id, ott.id))
      await tx.delete(sessions).where(eq(sessions.userId, ott.userId))
    })
  },

  async verifyEmail(token: string) {
    const tokenHash = sha256(token)
    const [ott] = await db
      .select()
      .from(oneTimeTokens)
      .where(and(
        eq(oneTimeTokens.tokenHash, tokenHash),
        eq(oneTimeTokens.type, 'email_verify'),
        isNull(oneTimeTokens.usedAt),
      ))
      .limit(1)

    if (!ott || ott.expiresAt < new Date()) {
      throw new AppError('AUTH_INVALID_RESET_TOKEN', 'Verification token is invalid or expired')
    }

    await db.transaction(async (tx) => {
      await tx.update(users).set({
        emailVerified:   true,
        emailVerifiedAt: new Date(),
        updatedAt:       new Date(),
      }).where(eq(users.id, ott.userId))
      await tx.update(oneTimeTokens).set({ usedAt: new Date() })
        .where(eq(oneTimeTokens.id, ott.id))
    })
  },

  async deleteAccount(userId: string) {
    await db.transaction(async (tx) => {
      await tx.delete(sessions).where(eq(sessions.userId, userId))
      await tx.update(users).set({ deletedAt: new Date() }).where(eq(users.id, userId))
    })
  },

  // Cleanup expired sessions (run via cron)
  async purgeExpiredSessions() {
    await db.delete(sessions).where(lt(sessions.expiresAt, new Date()))
  },
}
