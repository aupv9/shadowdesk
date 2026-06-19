import dotenv from 'dotenv'

dotenv.config()

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000', 10),
  HOST: process.env.HOST || 'localhost',

  // Database
  DATABASE_URL: process.env.DATABASE_URL || 'postgres://postgres:password@localhost:5432/ghost_browser',

  // Redis
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',

  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-key-change-in-production',
  JWT_ACCESS_EXPIRY: process.env.JWT_ACCESS_EXPIRY || '15m',
  JWT_REFRESH_EXPIRY: process.env.JWT_REFRESH_EXPIRY || '7d',

  // Email (optional for development)
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  FROM_EMAIL: process.env.FROM_EMAIL || 'noreply@ghostbrowser.app',

  // Cloud Storage (S3 for sync bundles)
  AWS_REGION: process.env.AWS_REGION || 'us-east-1',
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  S3_BUCKET: process.env.S3_BUCKET || 'ghost-browser-sync',

  // Supabase Storage (avatars, ticket attachments, cloud-profile bundles)
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_BUCKET_AVATARS: process.env.SUPABASE_BUCKET_AVATARS || 'avatars',
  SUPABASE_BUCKET_ATTACHMENTS: process.env.SUPABASE_BUCKET_ATTACHMENTS || 'attachments',
  SUPABASE_BUCKET_PROFILES: process.env.SUPABASE_BUCKET_PROFILES || 'cloud-profiles',

  // App
  APP_NAME: 'Ghost Browser',
  APP_URL: process.env.APP_URL || 'https://app.ghostbrowser.app',
  ELECTRON_CLIENT_ORIGIN: process.env.ELECTRON_CLIENT_ORIGIN || 'electron://*'
}

export function validateEnv(): void {
  const required = ['DATABASE_URL', 'JWT_SECRET']
  const missing = required.filter((key) => !process.env[key])
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }
}
