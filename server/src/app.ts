import express, { Request, Response } from 'express'
import cors from 'cors'
import { env } from './config/env'
import { authMiddleware } from './middleware/auth'
import { errorHandler } from './middleware/error'
import { logger } from './utils/logger'

// Routes
import authRoutes from './modules/auth/auth.routes'
import licenseRoutes from './modules/license/license.routes'
import teamRoutes from './modules/team/team.routes'
import syncRoutes from './modules/sync/sync.routes'

const app = express()

// Middleware
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))

app.use(
  cors({
    origin: [env.ELECTRON_CLIENT_ORIGIN, 'http://localhost:3000'],
    credentials: true
  })
)

// Request logging
app.use((req: Request, res: Response, next) => {
  const start = Date.now()
  res.on('finish', () => {
    const duration = Date.now() - start
    logger.info(`${req.method} ${req.path}`, {
      statusCode: res.statusCode,
      duration,
      userId: req.userId
    })
  })
  next()
})

// Health checks
app.get('/health/live', (req, res) => {
  res.json({ status: 'alive', timestamp: new Date().toISOString() })
})

app.get('/health/ready', (req, res) => {
  res.json({ status: 'ready', timestamp: new Date().toISOString() })
})

// API routes
app.use('/auth', authRoutes)
app.use('/licenses', authMiddleware, licenseRoutes)
app.use('/team', authMiddleware, teamRoutes)
app.use('/profiles/sync', authMiddleware, syncRoutes)

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'not_found',
    message: 'Endpoint not found',
    code: 404,
    timestamp: new Date().toISOString()
  })
})

// Error handler (must be last)
app.use(errorHandler)

export default app
