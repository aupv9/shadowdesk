import knex, { Knex } from 'knex'
import { env } from './env'

let db: Knex | null = null

export function initDatabase(): Knex {
  if (db) return db

  db = knex({
    client: 'pg',
    connection: env.DATABASE_URL,
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      directory: './src/database/migrations'
    }
  })

  return db
}

export function getDatabase(): Knex {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return db
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.destroy()
    db = null
  }
}
