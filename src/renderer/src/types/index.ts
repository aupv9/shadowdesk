// Re-export shared types for renderer use
export type {
  Profile,
  ProfileGroup,
  ProxyConfig,
  FingerprintConfig,
  CreateProfileInput,
  CreateProxyInput
} from '../../../shared/types'

// Renderer-only types

export type NavSection = 'profiles' | 'proxies' | 'fingerprint' | 'settings'

export interface Toast {
  id: string
  type: 'success' | 'error' | 'info'
  message: string
}
