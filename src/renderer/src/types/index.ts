// Re-export shared types for renderer use
export type {
  Profile,
  ProfileGroup,
  ProxyConfig,
  FingerprintConfig,
  CreateProfileInput,
  CreateProxyInput,
  UpdateProxyInput,
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
  VariableType,
  VariableDefinition,
  TypedVariable,
  ErrorCategory,
  ErrorContext,
  CircuitBreakerConfig,
  CircuitBreakerState,
  AutomationRunMetrics,
  AiRecoveryConfig,
  AiRecoveryIntervention,
  AiRecoveryResult,
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
  // Phase 17
  BehaviorPreset,
  BehaviorPresetId,
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
  // Smart Warm-Up Engine
  WarmUpStage,
  WarmUpPlanStatus,
  WarmUpRegion,
  WarmUpPlan,
  WarmUpInteraction,
  WarmUpSession,
  CreateWarmUpPlanInput,
  WarmUpPlanProgress,
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
  WebhookEvent,
  // Phase 16
  AiUsageStatus,
  AiRecommendation,
  AiDetectionAdvice,
  AiWorkflowResult,
  AiSelectorHealResult,
  BehaviorArchetype,
  // Phase 17 — SEA Platform Templates
  SeaPlatform,
  SeaPlatformKind,
  // Phase 20 — Proxy Provider Marketplace ("Phase 17 — Proxy API Integration")
  ProxyProviderType,
  ProxyPoolType,
  ProxySessionType,
  ProxyProviderCatalogEntry,
  ProxyProviderAccount,
  ProxyProviderAccountView,
  ProxyProviderCredentialsInput,
  ProxyProviderUsage,
  ProxyProviderTestResult,
  ProxyGenerationOptions,
  GeneratedProxy,
  // Phase 17.H — Platform-Specific Detection Hardening
  HardenerSeverity,
  HardenerIssue,
  HardenerFix,
  PlatformTuningHint,
  PreFlightValidationResult,
  LiveAdjustmentEvent,
  // Phase 21 — Behavior Correlation Detector
  BehaviorSample,
  ProfileBehaviorFingerprint,
  BehaviorCorrelationPair,
  BehaviorCorrelationReport,
  BehaviorCorrelationOptions,
  // Phase 17 — Mobile Workflow Engine
  MobileWorkflow,
  MobileAutomationStep,
  MobileDeviceConfig,
  MobileAction,
  MobileGestureAction,
  MobileSensorAction,
  MobileDeviceAction,
  MobileExecutionResult,
  MobileBatchExecutionResult,
  MobileExecutionMetrics,
  MobileStepResult,
  MobileExecutionLog,
  MobileBehaviorArchetype,
  MobileBehaviorArchetypeId,
  SensorState,
  GestureTemplate,
  CreateMobileWorkflowInput,
  UpdateMobileWorkflowInput
} from '../../../shared/types'

export { PLAN_LIMITS } from '../../../shared/types'

// Renderer-only types

export type NavSection =
  | 'profiles'
  | 'import-history' // Phase 1+2 — Bulk Import Enhancement
  | 'proxies'
  | 'fingerprint'
  | 'behavior'       // Phase 17 — Behavioral Config UI
  | 'detection'
  | 'settings'
  | 'team'
  | 'account'
  | 'automation'
  | 'runs'
  | 'patches'
  | 'marketplace'
  | 'ai'
  | 'sea-platforms'  // Phase 17 — SEA Platform Templates
  | 'smart-warmup'   // Smart Warm-Up Engine (7-day ramp)
  | 'correlation'    // Phase 21 — Behavior Correlation Detector
  | 'mobile-workflows' // Phase 17 — Mobile Workflow Engine

export interface Toast {
  id: string
  type: 'success' | 'error' | 'info'
  message: string
  // Phase 4.3: Optional action button (e.g. Undo)
  action?: {
    label: string
    onClick: () => void
  }
}
