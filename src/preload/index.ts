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
