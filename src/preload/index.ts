import { contextBridge, ipcRenderer } from 'electron'

const api = {
  profiles: {
    list:               ()                                    => ipcRenderer.invoke('profiles:list'),
    create:             (input: unknown)                      => ipcRenderer.invoke('profiles:create', input),
    update:             (id: string, data: unknown)           => ipcRenderer.invoke('profiles:update', id, data),
    clone:              (id: string)                          => ipcRenderer.invoke('profiles:clone', id),
    delete:             (id: string)                          => ipcRenderer.invoke('profiles:delete', id),
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
    detectCollisions:   ()                                    => ipcRenderer.invoke('profiles:detectCollisions')
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
    start:             (profileId: string, captureScreenshots?: boolean) => ipcRenderer.invoke('recorder:start', profileId, captureScreenshots),
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
    list:        ()                    => ipcRenderer.invoke('proxies:list'),
    create:      (input: unknown)      => ipcRenderer.invoke('proxies:create', input),
    delete:      (id: string)          => ipcRenderer.invoke('proxies:delete', id),
    test:        (id: string)          => ipcRenderer.invoke('proxies:test', id),
    importBulk:  (lines: string[])     => ipcRenderer.invoke('proxies:importBulk', lines)
  },
  fingerprint: {
    presets: () => ipcRenderer.invoke('fingerprint:presets')
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
    deactivateDevice:  (machineId: string)   => ipcRenderer.invoke('license:deactivateDevice', machineId)
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
    create:    (input: { name: string; description?: string; steps: any[] }) => ipcRenderer.invoke('workflows:create', input),
    update:    (id: string, data: { name?: string; description?: string; steps?: any[] }) => ipcRenderer.invoke('workflows:update', id, data),
    delete:    (id: string)                                           => ipcRenderer.invoke('workflows:delete', id),
    run:       (workflowId: string, profileId: string, variables?: Record<string, string>) => ipcRenderer.invoke('workflows:run', workflowId, profileId, variables),
    runParallel: (workflowId: string, profileIds: string[], variables?: Record<string, string>, concurrency?: number) => ipcRenderer.invoke('workflows:runParallel', workflowId, profileIds, variables, concurrency),
    stop:      (workflowId: string, profileId: string)                => ipcRenderer.invoke('workflows:stop', workflowId, profileId),
    stopAll:   (workflowId: string)                                   => ipcRenderer.invoke('workflows:stopAll', workflowId),
    isRunning: (workflowId: string, profileId: string)                => ipcRenderer.invoke('workflows:isRunning', workflowId, profileId),
    runs:      (workflowId: string)                                   => ipcRenderer.invoke('workflows:runs', workflowId),
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
  automation: {
    /** Subscribe to per-step progress events emitted during a workflow run.
     *  Returns an unsubscribe function. */
    onStepProgress: (cb: (data: { workflowId: string; profileId: string; step: any }) => void): (() => void) => {
      const handler = (_event: any, data: any) => cb(data)
      ipcRenderer.on('automation:step-progress', handler)
      return () => { ipcRenderer.removeListener('automation:step-progress', handler) }
    }
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
    // 16.B — Detection Advisor
    analyzeDetection:    (vectors: unknown[], overallScore: number)                        => ipcRenderer.invoke('ai:analyzeDetection', vectors, overallScore),
    // 16.C — Smart Selector Healing
    healSelector:        (selector: string, pageHtml: string, context?: string)            => ipcRenderer.invoke('ai:healSelector', selector, pageHtml, context),
    // 16.D — Behaviour Pattern Library
    behaviorArchetypes:  ()                                                                => ipcRenderer.invoke('ai:behaviorArchetypes'),
    behaviorArchetype:   (id: string)                                                      => ipcRenderer.invoke('ai:behaviorArchetype', id)
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
