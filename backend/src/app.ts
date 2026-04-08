import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import { env } from './config.js'
import { globalErrorHandler } from './shared/errors.js'
import { checkDbConnection } from './db/client.js'
import { authRoutes }    from './modules/auth/routes.js'
import { licenseRoutes } from './modules/license/routes.js'
import { teamRoutes }    from './modules/team/routes.js'
import { syncRoutes }    from './modules/sync/routes.js'
import { webhookRoutes } from './modules/webhook/routes.js'

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
      transport: env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    },
    trustProxy: true,
  })

  // ---------------------------------------------------------------------------
  // Plugins
  // ---------------------------------------------------------------------------
  await app.register(helmet, {
    contentSecurityPolicy: false,  // API-only, no HTML
  })

  await app.register(cors, {
    origin: env.CORS_ORIGINS === '*' ? true : env.CORS_ORIGINS.split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  })

  await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: '1 minute',
    keyGenerator: (req) => req.ip,
    errorResponseBuilder: () => ({
      error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' },
    }),
  })

  // ---------------------------------------------------------------------------
  // Error handler
  // ---------------------------------------------------------------------------
  app.setErrorHandler(globalErrorHandler)

  // ---------------------------------------------------------------------------
  // Health check (no auth)
  // ---------------------------------------------------------------------------
  app.get('/health', async (_req, reply) => {
    const checks: Record<string, string> = { status: 'ok', version: '1.0.0' }

    try {
      await checkDbConnection()
      checks.db = 'ok'
    } catch {
      checks.db = 'error'
      reply.status(503)
    }

    return checks
  })

  // ---------------------------------------------------------------------------
  // API v1 routes
  // ---------------------------------------------------------------------------
  const v1Prefix = '/v1'

  await app.register(authRoutes,    { prefix: `${v1Prefix}/auth` })
  await app.register(licenseRoutes, { prefix: `${v1Prefix}/licenses` })
  await app.register(teamRoutes,    { prefix: `${v1Prefix}/team` })
  await app.register(syncRoutes,    { prefix: `${v1Prefix}/sync` })
  await app.register(webhookRoutes, { prefix: `${v1Prefix}/webhooks` })

  // ---------------------------------------------------------------------------
  // 404 handler
  // ---------------------------------------------------------------------------
  app.setNotFoundHandler((_req, reply) => {
    reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Route not found' } })
  })

  return app
}
