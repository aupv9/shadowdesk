// Re-export shared types for renderer use
export type {
  Profile,
  ProfileGroup,
  ProxyConfig,
  FingerprintConfig,
  CreateProfileInput,
  CreateProxyInput,
  User,
  AuthState,
  LoginInput,
  RegisterInput,
  License,
  LicensePlan,
  LicenseState,
  Team,
  TeamMember,
  TeamInvite,
  TeamRole,
  SharedProfile,
  AuditLogEntry,
  SyncState,
  SyncStatus,
  SyncManifest,
  AutomationActionType,
  AutomationStep,
  AutomationWorkflow,
  AutomationStepResult,
  AutomationRunResult,
  CreateWorkflowInput,
  UpdateWorkflowInput,
  ApiServerConfig,
  ApiServerStatus,
  WorkflowTemplate
} from '../../../shared/types'

export { PLAN_LIMITS } from '../../../shared/types'

// Renderer-only types

export type NavSection = 'profiles' | 'proxies' | 'fingerprint' | 'settings' | 'team' | 'account' | 'automation'

export interface Toast {
  id: string
  type: 'success' | 'error' | 'info'
  message: string
}
