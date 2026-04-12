import { apiRequest } from './api-client'
import type { ApiKeyInfo, ApiKeyCreateInput, ApiKeyUsage } from '../shared/types'

/**
 * List all API keys for the authenticated user.
 */
export async function listApiKeys(userId: string): Promise<ApiKeyInfo[]> {
  return apiRequest<ApiKeyInfo[]>(`/api-keys/users/${userId}`)
}

/**
 * Create a new API key for the authenticated user.
 */
export async function createApiKey(userId: string, input: ApiKeyCreateInput): Promise<ApiKeyInfo> {
  return apiRequest<ApiKeyInfo>(`/api-keys/users/${userId}`, {
    method: 'POST',
    body: input
  })
}

/**
 * Rotate (regenerate) an existing API key. Returns the new key value.
 */
export async function rotateApiKey(keyId: string): Promise<ApiKeyInfo> {
  return apiRequest<ApiKeyInfo>(`/api-keys/${keyId}/rotate`, {
    method: 'POST'
  })
}

/**
 * Delete an API key.
 */
export async function deleteApiKey(keyId: string): Promise<void> {
  await apiRequest(`/api-keys/${keyId}`, { method: 'DELETE' })
}

/**
 * Get usage statistics for an API key.
 */
export async function getApiKeyUsage(keyId: string, period: string = 'week'): Promise<ApiKeyUsage> {
  return apiRequest<ApiKeyUsage>(`/api-keys/${keyId}/usage?period=${encodeURIComponent(period)}`)
}
