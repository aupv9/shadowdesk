import type { FastifyRequest, FastifyReply } from 'fastify'
import { verifyAccessToken, type AccessTokenPayload } from '../crypto.js'
import { AppError } from '../errors.js'

declare module 'fastify' {
  interface FastifyRequest {
    user: AccessTokenPayload
  }
}

export async function requireAuth(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AppError('AUTH_TOKEN_INVALID', 'Missing or malformed Authorization header')
  }

  const token = authHeader.slice(7)
  try {
    req.user = await verifyAccessToken(token)
  } catch {
    throw new AppError('AUTH_TOKEN_EXPIRED', 'Access token is expired or invalid')
  }
}

export function requirePlan(...plans: string[]) {
  return async (req: FastifyRequest, _reply: FastifyReply) => {
    await requireAuth(req, _reply)
    if (!plans.includes(req.user.plan)) {
      throw new AppError('LICENSE_PLAN_LIMIT', `This feature requires one of: ${plans.join(', ')}`)
    }
  }
}

export function requireTeamRole(...roles: string[]) {
  return async (req: FastifyRequest, _reply: FastifyReply) => {
    await requireAuth(req, _reply)
    if (!req.user.teamId) {
      throw new AppError('TEAM_NOT_FOUND', 'User is not a member of any team')
    }
    if (!roles.includes(req.user.role ?? '')) {
      throw new AppError('TEAM_PERMISSION_DENIED', `Requires role: ${roles.join(' or ')}`)
    }
  }
}
