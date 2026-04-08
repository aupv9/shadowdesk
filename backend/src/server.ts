import { buildApp } from './app.js'
import { env } from './config.js'
import { startWebhookWorker } from './modules/webhook/queue.js'

async function main() {
  const app = await buildApp()

  // Start BullMQ workers
  const webhookWorker = startWebhookWorker()
  app.log.info('Webhook delivery worker started')

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    app.log.info(`${signal} received — shutting down gracefully`)
    await app.close()
    await webhookWorker.close()
    process.exit(0)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT',  () => shutdown('SIGINT'))

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' })
    app.log.info(`ShadowDesk API running at http://0.0.0.0:${env.PORT}`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

main()
