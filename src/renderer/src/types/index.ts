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
  LicenseDevice,
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
  SyncLogEntry,
  SyncPullResult,
  SyncConflict,
  SyncDiff,
  AutomationActionType,
  AutomationStep,
  AutomationWorkflow,
  AutomationStepResult,
  AutomationRunResult,
  CreateWorkflowInput,
  UpdateWorkflowInput,
  ApiServerConfig,
  ApiServerStatus,
  WorkflowTemplate,
  DetectionTestResult,
  DetectionVectorResult,
  DetectionTestSummary,
  BatchTestStatus,
  ProfileVersion,
  BehaviorConfig,
  TimingConfig,
  // Phase 8
  ChromiumPatch,
  ChromiumPatchStatus,
  ChromiumPatchCategory,
  ChromiumPatchLevel,
  Phase8Config,
  // Phase 10.2 / 10.3 / 11.2
  WorkflowSchedule,
  ProfileExtension,
  WarmUpResult,
  // Phase 12.C.4
  CollisionGroup,
  CollisionReport,
  CollisionKind,
  // Phase 14.A
  RemoteBrowserNode,
  CreateNodeInput,
  NodeHealth,
  NodeStatus,
  // Phase 15
  MarketplaceWorkflow,
  MarketplaceCategory,
  CommunityPreset,
  WebhookConfig,
  TelegramConfig,
  CreateWebhookInput,
  WebhookEvent
} from '../../../shared/types'

export { PLAN_LIMITS } from '../../../shared/types'

// Renderer-only types

export type NavSection = 'profiles' | 'proxies' | 'fingerprint' | 'detection' | 'settings' | 'team' | 'account' | 'automation' | 'patches' | 'marketplace'

export interface Toast {
  id: string
  type: 'success' | 'error' | 'info'
  message: string
}
