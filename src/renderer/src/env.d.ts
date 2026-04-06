/// <reference types="vite/client" />

interface Window {
  api: {
    profiles: {
      list:              ()                                         => Promise<any[]>
      create:            (input: any)                              => Promise<any>
      update:            (id: string, data: any)                   => Promise<any>
      clone:             (id: string)                              => Promise<any>
      delete:            (id: string)                              => Promise<void>
      launch:            (id: string)                              => Promise<void>
      close:             (id: string)                              => Promise<void>
      active:            ()                                        => Promise<string[]>
      setGroup:          (profileId: string, groupId: string | null) => Promise<void>
      rerollFingerprint: (id: string)                              => Promise<any>
      export: (id: string)                                         => Promise<Buffer>
      import: (buffer: Buffer)                                     => Promise<import('./types').Profile>
    }
    cookies: {
      import: (profileId: string, text: string, format: 'netscape' | 'json') => Promise<number>
      export: (profileId: string, format: 'netscape' | 'json')                => Promise<string>
    }
    groups: {
      list:   ()                                        => Promise<any[]>
      create: (input: { name: string; color?: string }) => Promise<any>
      delete: (id: string)                              => Promise<void>
    }
    proxies: {
      list:   ()               => Promise<any[]>
      create: (input: any)     => Promise<any>
      delete: (id: string)     => Promise<void>
      test:   (id: string)     => Promise<{ latency_ms: number; healthy: boolean; ip?: string }>
    }
    fingerprint: {
      presets: () => Promise<string[]>
    }
    settings: {
      get:    () => Promise<{ defaultPreset: string; language: string; theme: string; autoLaunchLastSession: boolean }>
      update: (partial: Record<string, any>) => Promise<{ defaultPreset: string; language: string; theme: string; autoLaunchLastSession: boolean }>
    }
    updater: {
      download: () => Promise<void>
      install:  () => Promise<void>
      onStatus: (cb: (status: { status: string; version?: string; percent?: number; message?: string }) => void) => () => void
    }
    auth: {
      login:           (input: { email: string; password: string })               => Promise<import('./types').User>
      register:        (input: { email: string; password: string; name: string }) => Promise<import('./types').User>
      logout:          ()                                                         => Promise<void>
      me:              ()                                                         => Promise<import('./types').User | null>
      isAuthenticated: ()                                                         => Promise<boolean>
      updatePassword:  (current: string, newPass: string)                         => Promise<void>
    }
    license: {
      current:           () => Promise<import('./types').License>
      fetch:             () => Promise<import('./types').License | null>
      activate:          (key: string) => Promise<import('./types').License>
      deactivate:        () => Promise<void>
      checkProfileLimit: () => Promise<{ allowed: boolean; current: number; max: number }>
      usage:             () => Promise<{ profiles: number; members: number }>
      machineId:         () => Promise<string>
    }
    team: {
      get:              () => Promise<import('./types').Team | null>
      create:           (name: string) => Promise<import('./types').Team>
      updateName:       (name: string) => Promise<import('./types').Team>
      delete:           () => Promise<void>
      members:          () => Promise<import('./types').TeamMember[]>
      updateMemberRole: (userId: string, role: string) => Promise<import('./types').TeamMember>
      removeMember:     (userId: string) => Promise<void>
      invite:           (email: string, role: string) => Promise<import('./types').TeamInvite>
      invites:          () => Promise<import('./types').TeamInvite[]>
      cancelInvite:     (inviteId: string) => Promise<void>
      shareProfile:     (profileId: string, memberIds: string[], permission: string) => Promise<void>
      sharedProfiles:   () => Promise<import('./types').SharedProfile[]>
      unshareProfile:   (profileId: string, memberId: string) => Promise<void>
      auditLog:         (params?: { page?: number; limit?: number; user_id?: string; action?: string }) => Promise<{ entries: import('./types').AuditLogEntry[]; total: number }>
    }
    sync: {
      status:   () => Promise<import('./types').SyncState>
      push:     (password: string) => Promise<void>
      pull:     (password: string) => Promise<number>
      manifest: () => Promise<import('./types').SyncManifest | null>
      onStatus: (cb: (state: import('./types').SyncState) => void) => () => void
    }
    workflows: {
      list:      () => Promise<import('./types').AutomationWorkflow[]>
      get:       (id: string) => Promise<import('./types').AutomationWorkflow>
      create:    (input: import('./types').CreateWorkflowInput) => Promise<import('./types').AutomationWorkflow>
      update:    (id: string, data: import('./types').UpdateWorkflowInput) => Promise<import('./types').AutomationWorkflow>
      delete:    (id: string) => Promise<void>
      run:       (workflowId: string, profileId: string) => Promise<import('./types').AutomationRunResult>
      stop:      (workflowId: string, profileId: string) => Promise<void>
      isRunning: (workflowId: string, profileId: string) => Promise<boolean>
      runs:      (workflowId: string) => Promise<any[]>
    }
    templates: {
      list:               () => Promise<import('./types').WorkflowTemplate[]>
      get:                (id: string) => Promise<import('./types').WorkflowTemplate>
      createFromTemplate: (templateId: string, name?: string) => Promise<import('./types').AutomationWorkflow>
    }
    apiServer: {
      status: () => Promise<import('./types').ApiServerStatus>
      config: () => Promise<import('./types').ApiServerConfig>
      start:  (config?: Partial<import('./types').ApiServerConfig>) => Promise<import('./types').ApiServerStatus>
      stop:   () => Promise<import('./types').ApiServerStatus>
    }
  }
}
