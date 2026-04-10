import { initDatabase } from '../config/database'
import { logger } from '../utils/logger'

async function migrate(): Promise<void> {
  try {
    const db = initDatabase()

    logger.info('Running migrations...')
    const [batchNo, logs] = await db.migrate.latest({
      directory: './src/database/migrations'
    })

    if (logs.length === 0) {
      logger.info('Already up to date')
    } else {
      logger.info(`Batch ${batchNo} run: ${logs.length} migrations`, { logs })
    }

    await db.destroy()
    logger.info('Migrations complete')
  } catch (error) {
    logger.error('Migration failed', { error })
    process.exit(1)
  }
}

migrate()
