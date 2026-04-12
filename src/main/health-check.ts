import { getApiBaseUrl, getApiVersionPrefix } from './api-client'

/**
 * Health Check Service
 *
 * Verifies connectivity to the Common SaaS API Gateway.
 * Called on app startup and periodically by the renderer.
 */

export interface HealthStatus {
  api_reachable: boolean
  latency_ms: number
  api_version?: string
  checked_at: string
}

/**
 * Ping the Common SaaS health endpoint.
 * Uses the raw `/health` path (no /api/v1 prefix) since health
 * endpoints sit at the gateway root.
 */
export async function checkApiHealth(): Promise<HealthStatus> {
  const start = Date.now()
  const url = `${getApiBaseUrl()}/health`

  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(5_000)
    })

    const latency = Date.now() - start

    if (!res.ok) {
      return {
        api_reachable: false,
        latency_ms: latency,
        checked_at: new Date().toISOString()
      }
    }

    const data = await res.json().catch(() => ({}))
    return {
      api_reachable: true,
      latency_ms: latency,
      api_version: data?.version ?? undefined,
      checked_at: new Date().toISOString()
    }
  } catch {
    return {
      api_reachable: false,
      latency_ms: Date.now() - start,
      checked_at: new Date().toISOString()
    }
  }
}

/**
 * Readiness probe — checks whether the API is fully ready to serve requests.
 */
export async function checkApiReady(): Promise<boolean> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/health/ready`, {
      method: 'GET',
      signal: AbortSignal.timeout(5_000)
    })
    return res.ok
  } catch {
    return false
  }
}
