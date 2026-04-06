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
    rerollFingerprint:  (id: string)                          => ipcRenderer.invoke('profiles:rerollFingerprint', id),
    export:             (id: string)                          => ipcRenderer.invoke('profiles:export', id),
    import:             (buffer: Buffer)                      => ipcRenderer.invoke('profiles:import', buffer)
  },
  cookies: {
    import: (profileId: string, text: string, format: 'netscape' | 'json') =>
      ipcRenderer.invoke('cookies:import', profileId, text, format),
    export: (profileId: string, format: 'netscape' | 'json') =>
      ipcRenderer.invoke('cookies:export', profileId, format)
  },
  groups: {
    list:   ()                                        => ipcRenderer.invoke('groups:list'),
    create: (input: { name: string; color?: string }) => ipcRenderer.invoke('groups:create', input),
    delete: (id: string)                              => ipcRenderer.invoke('groups:delete', id)
  },
  proxies: {
    list:   ()               => ipcRenderer.invoke('proxies:list'),
    create: (input: unknown) => ipcRenderer.invoke('proxies:create', input),
    delete: (id: string)     => ipcRenderer.invoke('proxies:delete', id),
    test:   (id: string)     => ipcRenderer.invoke('proxies:test', id)
  },
  fingerprint: {
    presets: () => ipcRenderer.invoke('fingerprint:presets')
  },
  settings: {
    get:    ()                        => ipcRenderer.invoke('settings:get'),
    update: (partial: Record<string, any>) => ipcRenderer.invoke('settings:update', partial)
  },
  updater: {
    download: ()                             => ipcRenderer.invoke('updater:download'),
    install:  ()                             => ipcRenderer.invoke('updater:install'),
    onStatus: (cb: (status: any) => void)    => {
      const handler = (_event: any, status: any) => cb(status)
      ipcRenderer.on('updater:status', handler)
      return () => ipcRenderer.removeListener('updater:status', handler)
    }
  },
  auth: {
    login:            (input: { email: string; password: string })                => ipcRenderer.invoke('auth:login', input),
    register:         (input: { email: string; password: string; name: string })  => ipcRenderer.invoke('auth:register', input),
    logout:           ()                                                          => ipcRenderer.invoke('auth:logout'),
    me:               ()                                                          => ipcRenderer.invoke('auth:me'),
    isAuthenticated:  ()                                                          => ipcRenderer.invoke('auth:isAuthenticated'),
    updatePassword:   (current: string, newPass: string)                          => ipcRenderer.invoke('auth:updatePassword', current, newPass)
  },
  license: {
    current:           ()                    => ipcRenderer.invoke('license:current'),
    fetch:             ()                    => ipcRenderer.invoke('license:fetch'),
    activate:          (key: string)         => ipcRenderer.invoke('license:activate', key),
    deactivate:        ()                    => ipcRenderer.invoke('license:deactivate'),
    checkProfileLimit: ()                    => ipcRenderer.invoke('license:checkProfileLimit'),
    usage:             ()                    => ipcRenderer.invoke('license:usage'),
    machineId:         ()                    => ipcRenderer.invoke('license:machineId')
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
    status:   ()                       => ipcRenderer.invoke('sync:status'),
    push:     (password: string)       => ipcRenderer.invoke('sync:push', password),
    pull:     (password: string)       => ipcRenderer.invoke('sync:pull', password),
    manifest: ()                       => ipcRenderer.invoke('sync:manifest'),
    onStatus: (cb: (state: any) => void) => {
      const handler = (_event: any, state: any) => cb(state)
      ipcRenderer.on('sync:status', handler)
      return () => ipcRenderer.removeListener('sync:status', handler)
    }
  },
  workflows: {
    list:      ()                                                     => ipcRenderer.invoke('workflows:list'),
    get:       (id: string)                                           => ipcRenderer.invoke('workflows:get', id),
    create:    (input: { name: string; description?: string; steps: any[] }) => ipcRenderer.invoke('workflows:create', input),
    update:    (id: string, data: { name?: string; description?: string; steps?: any[] }) => ipcRenderer.invoke('workflows:update', id, data),
    delete:    (id: string)                                           => ipcRenderer.invoke('workflows:delete', id),
    run:       (workflowId: string, profileId: string)                => ipcRenderer.invoke('workflows:run', workflowId, profileId),
    stop:      (workflowId: string, profileId: string)                => ipcRenderer.invoke('workflows:stop', workflowId, profileId),
    isRunning: (workflowId: string, profileId: string)                => ipcRenderer.invoke('workflows:isRunning', workflowId, profileId),
    runs:      (workflowId: string)                                   => ipcRenderer.invoke('workflows:runs', workflowId)
  },
  templates: {
    list:               ()                                            => ipcRenderer.invoke('templates:list'),
    get:                (id: string)                                   => ipcRenderer.invoke('templates:get', id),
    createFromTemplate: (templateId: string, name?: string)            => ipcRenderer.invoke('templates:createFromTemplate', templateId, name)
  },
  apiServer: {
    status: ()                                                         => ipcRenderer.invoke('apiServer:status'),
    config: ()                                                         => ipcRenderer.invoke('apiServer:config'),
    start:  (config?: { enabled?: boolean; port?: number; authToken?: string }) => ipcRenderer.invoke('apiServer:start', config),
    stop:   ()                                                         => ipcRenderer.invoke('apiServer:stop')
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
