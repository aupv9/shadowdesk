import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import { env } from '../config.js'
import * as schema from './schema.js'

const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
})

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error', err)
})

export const db = drizzle(pool, { schema, logger: env.NODE_ENV === 'development' })

export async function checkDbConnection(): Promise<void> {
  const client = await pool.connect()
  client.release()
}
