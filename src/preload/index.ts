import { contextBridge, ipcRenderer } from 'electron'

const api = {
  profiles: {
    list:               ()                                    => ipcRenderer.invoke('profiles:list'),
    // Phase 2.1: Pagination
    listPaginated:      (limit: number, offset: number, filters?: any) => ipcRenderer.invoke('profiles:list-paginated', limit, offset, filters),
    create:             (input: unknown)                      => ipcRenderer.invoke('profiles:create', input),
    update:             (id: string, data: unknown)           => ipcRenderer.invoke('profiles:update', id, data),
    clone:              (id: string)                          => ipcRenderer.invoke('profiles:clone', id),
    delete:             (id: string)                          => ipcRenderer.invoke('profiles:delete', id),
    // Phase 2.2: Bulk operations
    bulkDelete:         (profileIds: string[])                => ipcRenderer.invoke('profiles:bulk-delete', profileIds),
    bulkRestore:        (profileIds: string[])                => ipcRenderer.invoke('profiles:bulk-restore', profileIds),
    bulkAssignProxy:    (profileIds: string[], proxyId: string | null) => ipcRenderer.invoke('profiles:bulk-proxy', profileIds, proxyId),
    bulkAssignGroup:    (profileIds: string[], groupId: string | null) => ipcRenderer.invoke('profiles:bulk-group', profileIds, groupId),
    launch:             (id: string)                          => ipcRenderer.invoke('profiles:launch', id),
    close:              (id: string)                          => ipcRenderer.invoke('profiles:close', id),
    active:             ()                                    => ipcRenderer.invoke('profiles:active'),
    setGroup:           (profileId: string, groupId: string | null) => ipcRenderer.invoke('profiles:setGroup', profileId, groupId),
    setSyncExcluded:    (profileId: string, excluded: boolean)       => ipcRenderer.invoke('profiles:setSyncExcluded', profileId, excluded),
    rerollFingerprint:  (id: string)                          => ipcRenderer.invoke('profiles:rerollFingerprint', id),
    changePreset:       (id: string, presetKey: string)       => ipcRenderer.invoke('profiles:changePreset', id, presetKey),
    export:             (id: string)                          => ipcRenderer.invoke('profiles:export', id),
    import:             (buffer: Buffer)                      => ipcRenderer.invoke('profiles:import', buffer),
    // Phase 6: version history
    history:            (profileId: string)                   => ipcRenderer.invoke('profiles:history', profileId),
    saveVersion:        (profileId: string, label: string)    => ipcRenderer.invoke('profiles:saveVersion', profileId, label),
    restoreVersion:     (profileId: string, versionId: string)=> ipcRenderer.invoke('profiles:restoreVersion', profileId, versionId),
    deleteVersion:      (versionId: string)                   => ipcRenderer.invoke('profiles:deleteVersion', versionId),
    // Phase 12.C.4
    detectCollisions:   ()                                    => ipcRenderer.invoke('profiles:detectCollisions'),
    search:             (query: string, groupId?: string)     => ipcRenderer.invoke('profiles:search', query, groupId)
  },
  cookies: {
    import:   (profileId: string, text: string, format: 'netscape' | 'json') =>
      ipcRenderer.invoke('cookies:import', profileId, text, format),
    export:   (profileId: string, format: 'netscape' | 'json') =>
      ipcRenderer.invoke('cookies:export', profileId, format),
    capture:  (profileId: string) =>
      ipcRenderer.invoke('cookies:capture', profileId),
    list:     (profileId: string) =>
      ipcRenderer.invoke('cookies:list', profileId),
    save:     (profileId: string, cookies: any[]) =>
      ipcRenderer.invoke('cookies:save', profileId, cookies)
  },
  // Phase 12.C.3 — Encrypted credential vault
  vault: {
    status: ()                                                                        => ipcRenderer.invoke('vault:status'),
    unlock: (masterPassword: string)                                                  => ipcRenderer.invoke('vault:unlock', masterPassword),
    lock:   ()                                                                        => ipcRenderer.invoke('vault:lock'),
    list:   (profileId?: string)                                                      => ipcRenderer.invoke('vault:list', profileId),
    get:    (id: string)                                                              => ipcRenderer.invoke('vault:get', id),
    create: (input: { profile_id: string | null; label: string; username: string; password: string; fields?: Record<string, string> }) => ipcRenderer.invoke('vault:create', input),
    update: (id: string, data: Partial<{ label: string; username: string; password: string; fields: Record<string, string>; profile_id: string | null }>) => ipcRenderer.invoke('vault:update', id, data),
    delete: (id: string)                                                              => ipcRenderer.invoke('vault:delete', id)
  },
  // Phase 12.B.2 — Visual selector recorder
  recorder: {
    start:             (profileId: string, captureScreenshots?: boolean, captureNetwork?: boolean) => ipcRenderer.invoke('recorder:start', profileId, captureScreenshots, captureNetwork),
    stop:              (profileId: string) => ipcRenderer.invoke('recorder:stop', profileId),
    state:             (profileId: string) => ipcRenderer.invoke('recorder:state', profileId),
    isRecording:       (profileId: string) => ipcRenderer.invoke('recorder:isRecording', profileId),
    validateSelectors: (profileId: string) => ipcRenderer.invoke('recorder:validateSelectors', profileId)
  },
  // Phase 12.C.2 — Per-profile storage inspector (read-only)
  storage: {
    listOrigins:        (profileId: string) =>
      ipcRenderer.invoke('storage:listOrigins', profileId),
    getDOMStorage:      (profileId: string, origin: string, isLocalStorage: boolean) =>
      ipcRenderer.invoke('storage:getDOMStorage', profileId, origin, isLocalStorage),
    listIndexedDb:      (profileId: string, origin: string) =>
      ipcRenderer.invoke('storage:listIndexedDb', profileId, origin),
    getIndexedDbEntries:(profileId: string, origin: string, dbName: string, store: string, max?: number) =>
      ipcRenderer.invoke('storage:getIndexedDbEntries', profileId, origin, dbName, store, max)
  },
  groups: {
    list:   ()                                        => ipcRenderer.invoke('groups:list'),
    create: (input: { name: string; color?: string }) => ipcRenderer.invoke('groups:create', input),
    delete: (id: string)                              => ipcRenderer.invoke('groups:delete', id)
  },
  proxies: {
    list:        ()                            => ipcRenderer.invoke('proxies:list'),
    create:      (input: unknown)              => ipcRenderer.invoke('proxies:create', input),
    update:      (id: string, patch: unknown)  => ipcRenderer.invoke('proxies:update', id, patch),
    delete:      (id: string)                  => ipcRenderer.invoke('proxies:delete', id),
    test:        (id: string)                  => ipcRenderer.invoke('proxies:test', id),
    importBulk:  (lines: string[])             => ipcRenderer.invoke('proxies:importBulk', lines)
  },
  // Phase 20 — Proxy Provider Marketplace (UI: "Phase 17 — Proxy API Integration")
  proxyProviders: {
    catalog:           ()                                  => ipcRenderer.invoke('proxyProviders:catalog'),
    list:              ()                                  => ipcRenderer.invoke('proxyProviders:list'),
    create:            (input: unknown)                    => ipcRenderer.invoke('proxyProviders:create', input),
    update:            (id: string, patch: unknown)        => ipcRenderer.invoke('proxyProviders:update', id, patch),
    delete:            (id: string)                        => ipcRenderer.invoke('proxyProviders:delete', id),
    test:              (id: string)                        => ipcRenderer.invoke('proxyProviders:test', id),
    refreshUsage:      (id: string)                        => ipcRenderer.invoke('proxyProviders:refreshUsage', id),
    generate:          (id: string, options: unknown)      => ipcRenderer.invoke('proxyProviders:generate', id, options),
    generateAndImport: (id: string, options: unknown)      => ipcRenderer.invoke('proxyProviders:generateAndImport', id, options)
  },
  fingerprint: {
    presets: () => ipcRenderer.invoke('fingerprint:presets')
  },
  // Phase 17 — Behavioral Config UI preset bundles
  behavior: {
    presets: () => ipcRenderer.invoke('behavior:presets')
  },
  extensions: {
    list:       (profileId: string)                          => ipcRenderer.invoke('extensions:list', profileId),
    add:        (profileId: string, name: string, path: string) => ipcRenderer.invoke('extensions:add', profileId, name, path),
    setEnabled: (id: string, enabled: boolean)               => ipcRenderer.invoke('extensions:setEnabled', id, enabled),
    remove:     (id: string)                                 => ipcRenderer.invoke('extensions:remove', id),
    pickFolder: ()                                           => ipcRenderer.invoke('extensions:pickFolder')
  },
  warmup: {
    run: (profileId: string, sites?: string[]) => ipcRenderer.invoke('profiles:warmUp', profileId, sites)
  },
  // Smart Warm-Up Engine — 7-day organic ramp, fake account-age, interaction synthesis
  smartWarmup: {
    blueprint:    ()                                                    => ipcRenderer.invoke('smartWarmup:blueprint'),
    list:         ()                                                    => ipcRenderer.invoke('smartWarmup:list'),
    get:          (profileId: string)                                   => ipcRenderer.invoke('smartWarmup:get', profileId),
    create:       (input: {
      profile_id: string
      region?: string
      target_platforms?: string[]
      total_days?: number
      fake_account_age_days?: number
      apply_fake_age_now?: boolean
    })                                                                  => ipcRenderer.invoke('smartWarmup:create', input),
    runNext:      (profileId: string)                                   => ipcRenderer.invoke('smartWarmup:runNext', profileId),
    pause:        (profileId: string)                                   => ipcRenderer.invoke('smartWarmup:pause', profileId),
    resume:       (profileId: string)                                   => ipcRenderer.invoke('smartWarmup:resume', profileId),
    cancel:       (profileId: string)                                   => ipcRenderer.invoke('smartWarmup:cancel', profileId),
    applyFakeAge: (profileId: string, days: number)                     => ipcRenderer.invoke('smartWarmup:applyFakeAge', profileId, days)
  },
  drift: {
    setEnabled: (profileId: string, enabled: boolean) => ipcRenderer.invoke('profiles:setDrift', profileId, enabled),
    apply:      (profileId: string)                   => ipcRenderer.invoke('profiles:applyDrift', profileId)
  },
  settings: {
    get:    ()                        => ipcRenderer.invoke('settings:get'),
    update: (partial: Record<string, any>) => ipcRenderer.invoke('settings:update', partial)
  },
  system: {
    chromiumVersion: () => ipcRenderer.invoke('system:chromiumVersion')
  },
  captcha: {
    listProviders: () => ipcRenderer.invoke('captcha:listProviders'),
    checkBalance:  (providerId: string, apiKey?: string) =>
      ipcRenderer.invoke('captcha:checkBalance', providerId, apiKey)
  },
  updater: {
    download: ()                             => ipcRenderer.invoke('updater:download'),
    install:  ()                             => ipcRenderer.invoke('updater:install'),
    onStatus: (cb: (status: any) => void): (() => void) => {
      const handler = (_event: any, status: any) => cb(status)
      ipcRenderer.on('updater:status', handler)
      return () => { ipcRenderer.removeListener('updater:status', handler) }
    }
  },
  auth: {
    login:               (input: { email: string; password: string })                => ipcRenderer.invoke('auth:login', input),
    register:            (input: { email: string; password: string; name: string })  => ipcRenderer.invoke('auth:register', input),
    logout:              ()                                                          => ipcRenderer.invoke('auth:logout'),
    me:                  ()                                                          => ipcRenderer.invoke('auth:me'),
    isAuthenticated:     ()                                                          => ipcRenderer.invoke('auth:isAuthenticated'),
    updatePassword:      (current: string, newPass: string)                          => ipcRenderer.invoke('auth:updatePassword', current, newPass),
    resendVerification:  ()                                                          => ipcRenderer.invoke('auth:resendVerification'),
    exportData:          ()                                                          => ipcRenderer.invoke('auth:exportData'),
    deleteAccount:       ()                                                          => ipcRenderer.invoke('auth:deleteAccount')
  },
  license: {
    current:           ()                    => ipcRenderer.invoke('license:current'),
    status:            ()                    => ipcRenderer.invoke('license:status'),
    fetch:             ()                    => ipcRenderer.invoke('license:fetch'),
    activate:          (key: string)         => ipcRenderer.invoke('license:activate', key),
    deactivate:        ()                    => ipcRenderer.invoke('license:deactivate'),
    checkProfileLimit: ()                    => ipcRenderer.invoke('license:checkProfileLimit'),
    usage:             ()                    => ipcRenderer.invoke('license:usage'),
    machineId:         ()                    => ipcRenderer.invoke('license:machineId'),
    devices:           ()                    => ipcRenderer.invoke('license:devices'),
    deactivateDevice:  (machineId: string)   => ipcRenderer.invoke('license:deactivateDevice', machineId),
    pricingPlans:      ()                    => ipcRenderer.invoke('license:pricingPlans'),
    invoices:          (params?: { page?: number; limit?: number }) => ipcRenderer.invoke('license:invoices', params)
  },
  userProfile: {
    get:          (userId: string)                                                                => ipcRenderer.invoke('userProfile:get', userId),
    update:       (userId: string, data: { display_name?: string; bio?: string; timezone?: string; language?: string }) => ipcRenderer.invoke('userProfile:update', userId, data),
    uploadAvatar: (userId: string, imageBuffer: Buffer, filename: string)                        => ipcRenderer.invoke('userProfile:uploadAvatar', userId, imageBuffer, filename)
  },
  notifications: {
    list:        (params?: { page?: number; limit?: number; unread_only?: boolean })  => ipcRenderer.invoke('notifications:list', params),
    markRead:    (notificationId: string)                                             => ipcRenderer.invoke('notifications:markRead', notificationId),
    markAllRead: ()                                                                   => ipcRenderer.invoke('notifications:markAllRead'),
    delete:      (notificationId: string)                                             => ipcRenderer.invoke('notifications:delete', notificationId),
    onUpdate:    (cb: (data: { unread_count: number; notifications: any[] }) => void): (() => void) => {
      const handler = (_event: any, data: any) => cb(data)
      ipcRenderer.on('notifications:update', handler)
      return () => { ipcRenderer.removeListener('notifications:update', handler) }
    }
  },
  audit: {
    post: (entry: { action: string; target_id?: string; target_name?: string; metadata?: Record<string, unknown> }) => ipcRenderer.invoke('audit:post', entry)
  },
  apiKeys: {
    list:    (userId: string)                                                 => ipcRenderer.invoke('apiKeys:list', userId),
    create:  (userId: string, input: { name: string; scopes: string[]; expires_in?: number }) => ipcRenderer.invoke('apiKeys:create', userId, input),
    rotate:  (keyId: string)                                                 => ipcRenderer.invoke('apiKeys:rotate', keyId),
    delete:  (keyId: string)                                                 => ipcRenderer.invoke('apiKeys:delete', keyId),
    usage:   (keyId: string, period?: string)                                => ipcRenderer.invoke('apiKeys:usage', keyId, period)
  },
  team: {
    get:              ()                                                                   => ipcRenderer.invoke('team:get'),
    create:           (name: string)                                                       => ipcRenderer.invoke('team:create', name),
    updateName:       (name: string)                                                       => ipcRenderer.invoke('team:updateName', name),
    delete:           ()                                                                   => ipcRenderer.invoke('team:delete'),
    members:          ()                                                                   => ipcRenderer.invoke('team:members'),
    updateMemberRole: (userId: string, role: string)                                       => ipcRenderer.invoke('team:updateMemberRole', userId, role),
    removeMember:     (userId: string)                                                     => ipcRenderer.invoke('team:removeMember', userId),
    invite:           (email: string, role: string)                                        => ipcRenderer.invoke('team:invite', email, role),
    invites:          ()                                                                   => ipcRenderer.invoke('team:invites'),
    cancelInvite:     (inviteId: string)                                                   => ipcRenderer.invoke('team:cancelInvite', inviteId),
    shareProfile:     (profileId: string, memberIds: string[], permission: string)         => ipcRenderer.invoke('team:shareProfile', profileId, memberIds, permission),
    sharedProfiles:   ()                                                                   => ipcRenderer.invoke('team:sharedProfiles'),
    unshareProfile:   (profileId: string, memberId: string)                                => ipcRenderer.invoke('team:unshareProfile', profileId, memberId),
    auditLog:         (params?: { page?: number; limit?: number; user_id?: string; action?: string }) => ipcRenderer.invoke('team:auditLog', params)
  },
  sync: {
    status:         ()                       => ipcRenderer.invoke('sync:status'),
    push:           (password: string)       => ipcRenderer.invoke('sync:push', password),
    pull:           (password: string)       => ipcRenderer.invoke('sync:pull', password),
    manifest:       ()                       => ipcRenderer.invoke('sync:manifest'),
    history:        (limit?: number)         => ipcRenderer.invoke('sync:history', limit),
    diff:           ()                       => ipcRenderer.invoke('sync:diff'),
    daemonEnabled:  ()                       => ipcRenderer.invoke('sync:daemonEnabled'),
    enableDaemon:   (password: string)       => ipcRenderer.invoke('sync:enableDaemon', password),
    disableDaemon:  ()                       => ipcRenderer.invoke('sync:disableDaemon'),
    onStatus: (cb: (state: any) => void): (() => void) => {
      const handler = (_event: any, state: any) => cb(state)
      ipcRenderer.on('sync:status', handler)
      return () => { ipcRenderer.removeListener('sync:status', handler) }
    }
  },
  workflows: {
    list:      ()                                                     => ipcRenderer.invoke('workflows:list'),
    get:       (id: string)                                           => ipcRenderer.invoke('workflows:get', id),
    create:    (input: { name: string; description?: string; steps: any[]; variables?: Record<string, string>; variableDefinitions?: any[]; circuitBreaker?: any; aiRecovery?: any }) => ipcRenderer.invoke('workflows:create', input),
    update:    (id: string, data: { name?: string; description?: string; steps?: any[]; variables?: Record<string, string>; variableDefinitions?: any[]; circuitBreaker?: any; aiRecovery?: any }) => ipcRenderer.invoke('workflows:update', id, data),
    delete:    (id: string)                                           => ipcRenderer.invoke('workflows:delete', id),
    run:       (workflowId: string, profileId: string, variables?: Record<string, string>, opts?: { maxDurationMs?: number; screenshotOnFailureDir?: string }) => ipcRenderer.invoke('workflows:run', workflowId, profileId, variables, opts),
    runParallel: (workflowId: string, profileIds: string[], variables?: Record<string, string>, concurrency?: number) => ipcRenderer.invoke('workflows:runParallel', workflowId, profileIds, variables, concurrency),
    stop:      (workflowId: string, profileId: string)                => ipcRenderer.invoke('workflows:stop', workflowId, profileId),
    stopAll:   (workflowId: string)                                   => ipcRenderer.invoke('workflows:stopAll', workflowId),
    isRunning: (workflowId: string, profileId: string)                => ipcRenderer.invoke('workflows:isRunning', workflowId, profileId),
    runs:      (workflowId: string)                                   => ipcRenderer.invoke('workflows:runs', workflowId),
    // Phase 18 — Export run history as CSV or JSON
    exportRuns: (
      workflowId: string | null | undefined,
      options: { format: 'csv' | 'json'; perStep?: boolean; limit?: number; status?: 'completed' | 'failed' | 'stopped'; includeVariables?: boolean }
    ) => ipcRenderer.invoke('workflows:runs:export', workflowId, options),
    // Tier 3 — Workflow versioning
    versions: {
      list:    (workflowId: string)                      => ipcRenderer.invoke('workflows:versions', workflowId),
      save:    (workflowId: string, label?: string)       => ipcRenderer.invoke('workflows:versions:save', workflowId, label),
      restore: (versionId: string)                       => ipcRenderer.invoke('workflows:versions:restore', versionId),
      delete:  (versionId: string)                       => ipcRenderer.invoke('workflows:versions:delete', versionId)
    },
    // Tier 2 — Run history dashboard, metrics, dry-run, debugger
    recentRuns:    (limit?: number)                                    => ipcRenderer.invoke('workflows:recentRuns', limit),
    metrics:       (workflowId?: string)                               => ipcRenderer.invoke('workflows:metrics', workflowId),
    // Tier 5 — detailed action metrics + hooks
    actionMetrics: (workflowId?: string, limit?: number)              => ipcRenderer.invoke('workflows:metrics:actions', workflowId, limit),
    hooks: {
      on: (workflowId: string, profileId: string, event: string) => ipcRenderer.invoke('workflows:hooks:on', workflowId, profileId, event),
      onHookFired: (cb: (data: any) => void): (() => void) => {
        const handler = (_event: any, data: any) => cb(data)
        ipcRenderer.on('automation:hook-fired', handler)
        return () => { ipcRenderer.removeListener('automation:hook-fired', handler) }
      }
    },
    dryRun:        (workflowId: string, variables?: Record<string, string>) => ipcRenderer.invoke('workflows:dryRun', workflowId, variables),
    debug: {
      run:            (workflowId: string, profileId: string, breakpoints?: string[], variables?: Record<string, string>, pauseAtStart?: boolean) =>
                        ipcRenderer.invoke('workflows:debug:run', workflowId, profileId, breakpoints, variables, pauseAtStart),
      pause:          (workflowId: string, profileId: string)          => ipcRenderer.invoke('workflows:debug:pause', workflowId, profileId),
      resume:         (workflowId: string, profileId: string)          => ipcRenderer.invoke('workflows:debug:resume', workflowId, profileId),
      stepOver:       (workflowId: string, profileId: string)          => ipcRenderer.invoke('workflows:debug:stepOver', workflowId, profileId),
      setBreakpoints: (workflowId: string, profileId: string, stepIds: string[]) =>
                        ipcRenderer.invoke('workflows:debug:setBreakpoints', workflowId, profileId, stepIds),
      state:          (workflowId: string, profileId: string)          => ipcRenderer.invoke('workflows:debug:state', workflowId, profileId),
      onPaused: (cb: (data: { workflowId: string; profileId: string; stepId: string; action: string; variables: Record<string, string> }) => void): (() => void) => {
        const handler = (_event: any, data: any) => cb(data)
        ipcRenderer.on('automation:paused', handler)
        return () => { ipcRenderer.removeListener('automation:paused', handler) }
      },
      onResumed: (cb: (data: { workflowId: string; profileId: string; stepId: string }) => void): (() => void) => {
        const handler = (_event: any, data: any) => cb(data)
        ipcRenderer.on('automation:resumed', handler)
        return () => { ipcRenderer.removeListener('automation:resumed', handler) }
      }
    },
    // Phase 10.2 — Schedules
    schedules: {
      list:    ()                                                     => ipcRenderer.invoke('schedules:list'),
      create:  (input: { workflow_id: string; profile_ids: string[]; cron: string; enabled?: boolean; name?: string }) => ipcRenderer.invoke('schedules:create', input),
      update:  (id: string, data: any)                                => ipcRenderer.invoke('schedules:update', id, data),
      delete:  (id: string)                                           => ipcRenderer.invoke('schedules:delete', id),
      runNow:  (id: string)                                           => ipcRenderer.invoke('schedules:runNow', id)
    }
  },
  templates: {
    list:               ()                                            => ipcRenderer.invoke('templates:list'),
    get:                (id: string)                                   => ipcRenderer.invoke('templates:get', id),
    createFromTemplate: (templateId: string, name?: string)            => ipcRenderer.invoke('templates:createFromTemplate', templateId, name)
  },
  // Phase 17 — SEA Platform Catalog
  seaPlatforms: {
    list:      ()                    => ipcRenderer.invoke('seaPlatforms:list'),
    get:       (id: string)          => ipcRenderer.invoke('seaPlatforms:get', id),
    templates: (id: string)          => ipcRenderer.invoke('seaPlatforms:templates', id),
    regions:   ()                    => ipcRenderer.invoke('seaPlatforms:regions')
  },
  automation: {
    /** Subscribe to per-step progress events emitted during a workflow run.
     *  Returns an unsubscribe function. */
    onStepProgress: (cb: (data: { workflowId: string; profileId: string; step: any }) => void): (() => void) => {
      const handler = (_event: any, data: any) => cb(data)
      ipcRenderer.on('automation:step-progress', handler)
      return () => { ipcRenderer.removeListener('automation:step-progress', handler) }
    },
    /** Subscribe to pre-flight validator results emitted just before a
     *  workflow starts executing. Phase 17.H. */
    onPreFlight: (cb: (result: any) => void): (() => void) => {
      const handler = (_event: any, data: any) => cb(data)
      ipcRenderer.on('automation:pre-flight', handler)
      return () => { ipcRenderer.removeListener('automation:pre-flight', handler) }
    },
    /** Subscribe to live-adjustment events emitted when a runtime signal
     *  indicates the target is challenging the session. Phase 17.H. */
    onLiveAdjustment: (cb: (event: any) => void): (() => void) => {
      const handler = (_event: any, data: any) => cb(data)
      ipcRenderer.on('automation:live-adjustment', handler)
      return () => { ipcRenderer.removeListener('automation:live-adjustment', handler) }
    }
  },
  // Phase 17.H — Platform-Specific Detection Hardening
  hardener: {
    validate:        (workflowId: string, profileId: string)    => ipcRenderer.invoke('hardener:validate', workflowId, profileId),
    detectPlatform:  (url: string)                               => ipcRenderer.invoke('hardener:detectPlatform', url),
    tuningHints:     ()                                          => ipcRenderer.invoke('hardener:tuningHints'),
    tuningHint:      (platformId: string)                        => ipcRenderer.invoke('hardener:tuningHint', platformId),
    applyFix:        (profileId: string, fix: unknown)           => ipcRenderer.invoke('hardener:applyFix', profileId, fix),
    analyzeSignal:   (signal: unknown)                           => ipcRenderer.invoke('hardener:analyzeSignal', signal)
  },
  apiServer: {
    status: ()                                                         => ipcRenderer.invoke('apiServer:status'),
    config: ()                                                         => ipcRenderer.invoke('apiServer:config'),
    start:  (config?: { enabled?: boolean; port?: number; authToken?: string }) => ipcRenderer.invoke('apiServer:start', config),
    stop:   ()                                                         => ipcRenderer.invoke('apiServer:stop')
  },
  detection: {
    runTest:      (profileId: string)          => ipcRenderer.invoke('detection:runTest', profileId),
    results:      (profileId?: string)         => ipcRenderer.invoke('detection:results', profileId),
    summary:      ()                           => ipcRenderer.invoke('detection:summary'),
    // Phase 7: result management + batch testing
    deleteResult: (resultId: string)           => ipcRenderer.invoke('detection:deleteResult', resultId),
    clearHistory: (profileId?: string)         => ipcRenderer.invoke('detection:clearHistory', profileId),
    batchTest:    (profileIds: string[])       => ipcRenderer.invoke('detection:batchTest', profileIds)
  },
  // Phase 8: Chromium Patch Manager
  patches: {
    status:        ()                  => ipcRenderer.invoke('patches:status'),
    list:          ()                  => ipcRenderer.invoke('patches:list'),
    getByCategory: (category: string)  => ipcRenderer.invoke('patches:getByCategory', category)
  },
  // Phase 14.A — Remote Browser Nodes
  nodes: {
    list:     ()                       => ipcRenderer.invoke('nodes:list'),
    add:      (input: { name: string; url: string; authToken?: string; region?: string; capacity?: number }) => ipcRenderer.invoke('nodes:add', input),
    remove:   (id: string)             => ipcRenderer.invoke('nodes:remove', id),
    test:     (id: string)             => ipcRenderer.invoke('nodes:test', id),
    pickBest: ()                       => ipcRenderer.invoke('nodes:pickBest')
  },
  // Phase 15.A — Workflow Marketplace
  marketplace: {
    list:    (opts?: { category?: string; q?: string })     => ipcRenderer.invoke('marketplace:list', opts),
    get:     (id: string)                                   => ipcRenderer.invoke('marketplace:get', id),
    install: (id: string, customName?: string)              => ipcRenderer.invoke('marketplace:install', id, customName)
  },
  // Phase 15.C — Outbound Webhooks
  webhooks: {
    list:           ()                                      => ipcRenderer.invoke('webhooks:list'),
    add:            (input: { name: string; url: string; events: string[]; secret?: string }) => ipcRenderer.invoke('webhooks:add', input),
    update:         (id: string, patch: Record<string, any>) => ipcRenderer.invoke('webhooks:update', id, patch),
    remove:         (id: string)                            => ipcRenderer.invoke('webhooks:remove', id),
    getTelegram:    ()                                      => ipcRenderer.invoke('webhooks:telegram:get'),
    saveTelegram:   (cfg: Record<string, any>)              => ipcRenderer.invoke('webhooks:telegram:save', cfg),
    dispatch:       (event: string, payload: Record<string, any>) => ipcRenderer.invoke('webhooks:dispatch', event, payload)
  },
  // Phase 13.E — Structured error events from main process
  onError: (cb: (event: { category: string; message: string; timestamp: string }) => void): (() => void) => {
    const handler = (_ipcEvent: any, appEvent: any) => cb(appEvent)
    ipcRenderer.on('app:error', handler)
    return () => { ipcRenderer.removeListener('app:error', handler) }
  },

  // Phase 17 — Script-to-Workflow Generation
  recording: {
    sessions: {
      list:   (profileId?: string)  => ipcRenderer.invoke('recording:sessions:list', profileId),
      get:    (id: string)           => ipcRenderer.invoke('recording:sessions:get', id),
      delete: (id: string)           => ipcRenderer.invoke('recording:sessions:delete', id),
    },
    previewSteps:   (sessionId: string)                                    => ipcRenderer.invoke('recording:previewSteps', sessionId),
    analyze:        (sessionId: string)                                    => ipcRenderer.invoke('recording:analyze', sessionId),
    refine:         (sessionId: string, options?: Record<string, any>)     => ipcRenderer.invoke('recording:refine', sessionId, options),
    saveAsWorkflow: (sessionId: string, name: string, description?: string) => ipcRenderer.invoke('recording:saveAsWorkflow', sessionId, name, description),
  },

  // Phase 16 — AI-Assisted Automation
  ai: {
    // Status & configuration
    status:              ()                                                                  => ipcRenderer.invoke('ai:status'),
    setApiKey:           (apiKey: string)                                                   => ipcRenderer.invoke('ai:setApiKey', apiKey),
    setEnabled:          (enabled: boolean)                                                 => ipcRenderer.invoke('ai:setEnabled', enabled),
    // 16.A — Natural Language Workflow Builder
    generateWorkflow:    (prompt: string, pageHtml?: string)                               => ipcRenderer.invoke('ai:generateWorkflow', prompt, pageHtml),
    explainStep:         (step: unknown)                                                   => ipcRenderer.invoke('ai:explainStep', step),
    fixStep:             (step: unknown, errorMessage: string)                             => ipcRenderer.invoke('ai:fixStep', step, errorMessage),
    // Phase 3 — AI Step Recovery
    generateRecoverySteps: (failedStep: unknown, errorContext: unknown, recentSteps?: unknown[], maxSteps?: number) => ipcRenderer.invoke('ai:generateRecoverySteps', failedStep, errorContext, recentSteps, maxSteps),
    // 16.B — Detection Advisor
    analyzeDetection:    (vectors: unknown[], overallScore: number)                        => ipcRenderer.invoke('ai:analyzeDetection', vectors, overallScore),
    // 16.C — Smart Selector Healing
    healSelector:        (selector: string, pageHtml: string, context?: string)            => ipcRenderer.invoke('ai:healSelector', selector, pageHtml, context),
    // 16.D — Behaviour Pattern Library
    behaviorArchetypes:  ()                                                                => ipcRenderer.invoke('ai:behaviorArchetypes'),
    behaviorArchetype:   (id: string)                                                      => ipcRenderer.invoke('ai:behaviorArchetype', id)
  },

  // Phase 21 — Behavior Correlation Detector
  correlation: {
    scan:          (options?: { threshold?: number; profileIds?: string[]; persist?: boolean }) =>
      ipcRenderer.invoke('correlation:scan', options),
    history:       (limit?: number)             => ipcRenderer.invoke('correlation:history', limit),
    get:           (id: string)                 => ipcRenderer.invoke('correlation:get', id),
    delete:        (id: string)                 => ipcRenderer.invoke('correlation:delete', id),
    recordSample:  (profileId: string, sample: Record<string, any>, sessionId?: string) =>
      ipcRenderer.invoke('correlation:recordSample', profileId, sample, sessionId),
    clearSamples:  (profileId: string)          => ipcRenderer.invoke('correlation:clearSamples', profileId),
  },

  // Phase 1+2 — Bulk Import Enhancement
  bulkImport: {
    previewCSV:     (csvText: string)                                              => ipcRenderer.invoke('import:previewCSV', csvText),
    previewJSON:    (jsonText: string)                                             => ipcRenderer.invoke('import:previewJSON', jsonText),
    previewZIP:     (zipBuffers: Buffer[])                                         => ipcRenderer.invoke('import:previewZIP', zipBuffers),
    executeCSV:     (csvText: string, options: any, filename: string | null)       => ipcRenderer.invoke('import:executeCSV', csvText, options, filename),
    executeJSON:    (jsonText: string, options: any, filename: string | null)      => ipcRenderer.invoke('import:executeJSON', jsonText, options, filename),
    executeZIP:     (zipBuffers: Buffer[], options: any, filenames: string[])      => ipcRenderer.invoke('import:executeZIP', zipBuffers, options, filenames),
    sessions:       (limit?: number, offset?: number)                              => ipcRenderer.invoke('import:sessions', limit, offset),
    session:        (id: string)                                                   => ipcRenderer.invoke('import:session', id),
    records:        (sessionId: string)                                            => ipcRenderer.invoke('import:records', sessionId),
    deleteSession:  (id: string)                                                   => ipcRenderer.invoke('import:deleteSession', id),
    stats:          ()                                                             => ipcRenderer.invoke('import:stats')
  },

  // Phase 2.3 — Cleanup Worker
  cleanup: {
    status:       () => ipcRenderer.invoke('cleanup:status'),
    retryFailed:  () => ipcRenderer.invoke('cleanup:retryFailed'),
    clearFailed:  () => ipcRenderer.invoke('cleanup:clearFailed')
  },

  // Phase 17 — Mobile Workflow Engine
  mobileWorkflow: {
    list:      ()                                          => ipcRenderer.invoke('mobileWorkflow:list'),
    get:       (id: string)                                => ipcRenderer.invoke('mobileWorkflow:get', id),
    create:    (input: any)                                => ipcRenderer.invoke('mobileWorkflow:create', input),
    update:    (id: string, updates: any)                  => ipcRenderer.invoke('mobileWorkflow:update', id, updates),
    delete:    (id: string)                                => ipcRenderer.invoke('mobileWorkflow:delete', id),
    duplicate: (id: string)                                => ipcRenderer.invoke('mobileWorkflow:duplicate', id),
    execute:   (workflowId: string, profileIds: string[])  => ipcRenderer.invoke('mobileWorkflow:execute', workflowId, profileIds)
  },

  mobileExecution: {
    logs:   (workflowId?: string, limit?: number) => ipcRenderer.invoke('mobileExecution:logs', workflowId, limit),
    get:    (id: string)                          => ipcRenderer.invoke('mobileExecution:get', id),
    delete: (id: string)                          => ipcRenderer.invoke('mobileExecution:delete', id)
  },

  mobileBehavior: {
    list: ()              => ipcRenderer.invoke('mobileBehavior:list'),
    get:  (id: string)    => ipcRenderer.invoke('mobileBehavior:get', id)
  },

  gestureTemplate: {
    list:   ()              => ipcRenderer.invoke('gestureTemplate:list'),
    create: (input: any)    => ipcRenderer.invoke('gestureTemplate:create', input),
    delete: (id: string)    => ipcRenderer.invoke('gestureTemplate:delete', id)
  },

  // Phase 18 — Real Device Management
  mobileDevice: {
    listAndroid:    ()                                              => ipcRenderer.invoke('mobileDevice:listAndroid'),
    listIos:        ()                                              => ipcRenderer.invoke('mobileDevice:listIos'),
    checkHealth:    (deviceId: string, type: string)               => ipcRenderer.invoke('mobileDevice:checkHealth', deviceId, type),
    enableWebDriver:(deviceId: string, type: string)               => ipcRenderer.invoke('mobileDevice:enableWebDriver', deviceId, type),
    launchChrome:   (deviceId: string, type: string, url?: string) => ipcRenderer.invoke('mobileDevice:launchChrome', deviceId, type, url),
    closeChrome:    (deviceId: string, type: string)               => ipcRenderer.invoke('mobileDevice:closeChrome', deviceId, type),
    getCdpEndpoint: (deviceId: string, type: string)               => ipcRenderer.invoke('mobileDevice:getCdpEndpoint', deviceId, type)
  },

  mobileNetwork: {
    setProfile: (pageId: string, profileType: string) => ipcRenderer.invoke('mobileNetwork:setProfile', pageId, profileType)
  },

  // ── Phase 2 Integration: Analytics ───────────────────────────────────────
  analytics: {
    dashboard:       ()                                                    => ipcRenderer.invoke('analytics:dashboard'),
    dashboardRemote: ()                                                    => ipcRenderer.invoke('analytics:dashboardRemote'),
    reportUsage:     (activeSessions: number)                              => ipcRenderer.invoke('analytics:reportUsage', activeSessions),
    trackFeature:    (feature: string, action: string, metadata?: Record<string, unknown>) =>
      ipcRenderer.invoke('analytics:trackFeature', feature, action, metadata)
  },

  // ── Phase 2 Integration: Billing ─────────────────────────────────────────
  billing: {
    overview:     ()                                                       => ipcRenderer.invoke('billing:overview'),
    plans:        ()                                                       => ipcRenderer.invoke('billing:plans'),
    checkout:     (planId: string, interval: 'monthly' | 'yearly')         => ipcRenderer.invoke('billing:checkout', planId, interval),
    portal:       ()                                                       => ipcRenderer.invoke('billing:portal'),
    changePlan:   (planId: string, interval: 'monthly' | 'yearly')         => ipcRenderer.invoke('billing:changePlan', planId, interval),
    cancel:       ()                                                       => ipcRenderer.invoke('billing:cancel'),
    resume:       ()                                                       => ipcRenderer.invoke('billing:resume'),
    invoices:     (params?: { page?: number; limit?: number; status?: string }) => ipcRenderer.invoke('billing:invoices', params),
    openInvoice:  (invoiceId: string)                                      => ipcRenderer.invoke('billing:openInvoice', invoiceId),
    usage:        ()                                                       => ipcRenderer.invoke('billing:usage'),
    promo:        (code: string)                                           => ipcRenderer.invoke('billing:promo', code)
  },

  // ── Phase 2 Integration: Remote Config ───────────────────────────────────
  remoteConfig: {
    fetch:              ()                    => ipcRenderer.invoke('remoteConfig:fetch'),
    flag:               (key: string)         => ipcRenderer.invoke('remoteConfig:flag', key),
    flags:              ()                    => ipcRenderer.invoke('remoteConfig:flags'),
    isEnabled:          (key: string)         => ipcRenderer.invoke('remoteConfig:isEnabled', key),
    setting:            (key: string)         => ipcRenderer.invoke('remoteConfig:setting', key),
    announcements:      ()                    => ipcRenderer.invoke('remoteConfig:announcements'),
    dismissAnnouncement:(id: string)          => ipcRenderer.invoke('remoteConfig:dismissAnnouncement', id),
    checkVersion:       ()                    => ipcRenderer.invoke('remoteConfig:checkVersion'),
    presetUpdates:      ()                    => ipcRenderer.invoke('remoteConfig:presetUpdates'),
    onUpdate: (cb: (config: any) => void): (() => void) => {
      const handler = (_event: any, config: any) => cb(config)
      ipcRenderer.on('remoteConfig:update', handler)
      return () => { ipcRenderer.removeListener('remoteConfig:update', handler) }
    }
  },

  // ── Phase 2 Integration: Cloud Profiles ──────────────────────────────────
  cloudProfiles: {
    list:       (params?: { page?: number; limit?: number; search?: string; tag?: string }) =>
      ipcRenderer.invoke('cloudProfiles:list', params),
    backup:     (profileId: string, tags?: string[])    => ipcRenderer.invoke('cloudProfiles:backup', profileId, tags),
    backupBulk: (profileIds: string[], tags?: string[]) => ipcRenderer.invoke('cloudProfiles:backupBulk', profileIds, tags),
    restore:    (cloudId: string)                        => ipcRenderer.invoke('cloudProfiles:restore', cloudId),
    delete:     (cloudId: string)                        => ipcRenderer.invoke('cloudProfiles:delete', cloudId),
    deleteBulk: (cloudIds: string[])                     => ipcRenderer.invoke('cloudProfiles:deleteBulk', cloudIds),
    updateTags: (cloudId: string, tags: string[])        => ipcRenderer.invoke('cloudProfiles:updateTags', cloudId, tags),
    usage:      ()                                       => ipcRenderer.invoke('cloudProfiles:usage')
  },

  // ── Phase 2 Integration: Support ─────────────────────────────────────────
  support: {
    createTicket: (input: { subject: string; category: string; priority?: string; message: string; include_diagnostics?: boolean }) =>
      ipcRenderer.invoke('support:createTicket', input),
    tickets:      (params?: { page?: number; limit?: number; status?: string }) =>
      ipcRenderer.invoke('support:tickets', params),
    ticket:       (ticketId: string)                     => ipcRenderer.invoke('support:ticket', ticketId),
    reply:        (ticketId: string, message: string)    => ipcRenderer.invoke('support:reply', ticketId, message),
    close:        (ticketId: string)                     => ipcRenderer.invoke('support:close', ticketId),
    reopen:       (ticketId: string)                     => ipcRenderer.invoke('support:reopen', ticketId),
    feedback:     (input: { type: string; message: string; rating?: number; context?: string }) =>
      ipcRenderer.invoke('support:feedback', input),
    diagnostics:  ()                                     => ipcRenderer.invoke('support:diagnostics')
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.api = api
}

export type API = typeof api
