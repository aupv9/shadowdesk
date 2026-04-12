/**
 * Common SaaS API Configuration
 *
 * Centralizes all configuration for the Common SaaS API integration.
 * Values are read from environment variables with sensible defaults
 * for development.
 *
 * Environment variables:
 *   GHOST_API_URL        — Base URL of the Common SaaS API Gateway
 *   GHOST_API_KEY         — Optional API key for machine-to-machine auth
 *   GHOST_API_TIMEOUT     — Request timeout in milliseconds
 *   GHOST_API_MAX_RETRIES — Max retry attempts for rate-limited requests
 *   GHOST_SYNC_INTERVAL   — Background sync interval in milliseconds
 *   GHOST_NOTIFICATION_INTERVAL — Notification poll interval in ms
 */

export interface CommonApiConfig {
  baseUrl: string
  apiKey: string | null
  timeoutMs: number
  maxRetries: number
  syncIntervalMs: number
  notificationIntervalMs: number
  healthCheckIntervalMs: number
  offlineQueueMaxSize: number
  offlineReplayIntervalMs: number
  profileSyncBatchDelayMs: number
}

function envInt(key: string, fallback: number): number {
  const val = process.env[key]
  if (!val) return fallback
  const parsed = parseInt(val, 10)
  return Number.isNaN(parsed) ? fallback : parsed
}

export function loadApiConfig(): CommonApiConfig {
  return {
    baseUrl: process.env.GHOST_API_URL || 'https://api.ghostbrowser.app',
    apiKey: process.env.GHOST_API_KEY || null,
    timeoutMs: envInt('GHOST_API_TIMEOUT', 30_000),
    maxRetries: envInt('GHOST_API_MAX_RETRIES', 3),
    syncIntervalMs: envInt('GHOST_SYNC_INTERVAL', 5 * 60_000),
    notificationIntervalMs: envInt('GHOST_NOTIFICATION_INTERVAL', 60_000),
    healthCheckIntervalMs: envInt('GHOST_HEALTH_CHECK_INTERVAL', 5 * 60_000),
    offlineQueueMaxSize: envInt('GHOST_OFFLINE_QUEUE_MAX', 500),
    offlineReplayIntervalMs: envInt('GHOST_OFFLINE_REPLAY_INTERVAL', 30_000),
    profileSyncBatchDelayMs: envInt('GHOST_PROFILE_SYNC_BATCH_DELAY', 2_000)
  }
}

let cachedConfig: CommonApiConfig | null = null

export function getApiConfig(): CommonApiConfig {
  if (!cachedConfig) {
    cachedConfig = loadApiConfig()
  }
  return cachedConfig
}

export function reloadApiConfig(): CommonApiConfig {
  cachedConfig = loadApiConfig()
  return cachedConfig
}
