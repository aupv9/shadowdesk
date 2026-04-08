// Per-route rate limit presets.
// Usage: route({ preHandler: rateLimits.login })
//
// Requires @fastify/rate-limit registered globally in app.ts.
// These return config objects consumed by the plugin's per-route override.

export const rateLimits = {
  /** Aggressive: 10 attempts per 15 minutes per IP — for login brute-force */
  login: {
    max: 10,
    timeWindow: '15 minutes',
    keyGenerator: (req: { ip: string }) => req.ip,
  },

  /** Strict: 5 attempts per hour per IP — for register/forgot-password */
  register: {
    max: 5,
    timeWindow: '1 hour',
    keyGenerator: (req: { ip: string }) => req.ip,
  },

  /** Token refresh: 30 per minute per user */
  refresh: {
    max: 30,
    timeWindow: '1 minute',
    keyGenerator: (req: { ip: string; headers: Record<string, string | string[] | undefined> }) =>
      (req.headers['x-user-id'] as string) ?? req.ip,
  },

  /** License activation: 5 per hour per user */
  licenseActivate: {
    max: 5,
    timeWindow: '1 hour',
    keyGenerator: (req: { ip: string }) => req.ip,
  },

  /** Webhook test: 20 per hour per user */
  webhookTest: {
    max: 20,
    timeWindow: '1 hour',
    keyGenerator: (req: { ip: string }) => req.ip,
  },
}
