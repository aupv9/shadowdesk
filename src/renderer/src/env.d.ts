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
  }
}
