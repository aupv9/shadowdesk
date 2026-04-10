import { env, validateEnv } from './config/env'
import { initDatabase, closeDatabase } from './config/database'
import { logger } from './utils/logger'
import app from './app'

async function bootstrap(): Promise<void> {
  try {
    // Validate environment
    validateEnv()
    logger.info('Environment validated')

    // Initialize database
    initDatabase()
    logger.info('Database initialized')

    // Start server
    const server = app.listen(env.PORT, env.HOST, () => {
      logger.info(`Server running at http://${env.HOST}:${env.PORT}`, {
        environment: env.NODE_ENV
      })
    })

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully')
      server.close(async () => {
        await closeDatabase()
        logger.info('Server shut down')
        process.exit(0)
      })
    })

    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down gracefully')
      server.close(async () => {
        await closeDatabase()
        logger.info('Server shut down')
        process.exit(0)
      })
    })
  } catch (error) {
    logger.error('Bootstrap failed', { error })
    process.exit(1)
  }
}

bootstrap()
