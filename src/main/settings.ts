import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'

export type CaptchaProviderId = '2captcha' | 'anticaptcha' | 'capmonster'

export interface CaptchaConfig {
  /** Default provider used by `solveCaptcha` actions when none is specified. */
  defaultProvider: CaptchaProviderId
  /** Per-provider API keys (empty string = unconfigured). */
  apiKeys: Record<CaptchaProviderId, string>
}

export interface AppSettings {
  defaultPreset: string
  language: 'en' | 'vi' | 'th' | 'id'
  theme: 'dark' | 'light'
  autoLaunchLastSession: boolean
  /**
   * Phase 12.A.1 — When enabled, the spoofed Chrome major version is rewritten
   * on launch to match the actual Chromium binary version. Strictly improves
   * the alignment between JS-injected UA and TLS/JA3 fingerprint. Default: ON.
   * Disable to pin a specific Chrome version per profile.
   */
  autoSyncBinaryUA: boolean
  /** Phase 12.B.1 — Captcha solver configuration. */
  captcha: CaptchaConfig
}

const DEFAULT_CAPTCHA: CaptchaConfig = {
  defaultProvider: '2captcha',
  apiKeys: {
    '2captcha':    '',
    'anticaptcha': '',
    'capmonster':  ''
  }
}

const DEFAULTS: AppSettings = {
  defaultPreset: 'win10-chrome120',
  language: 'en',
  theme: 'dark',
  autoLaunchLastSession: false,
  autoSyncBinaryUA: true,
  captcha: DEFAULT_CAPTCHA
}

let cached: AppSettings | null = null

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

export function getSettings(): AppSettings {
  if (cached) return cached
  const p = settingsPath()
  if (existsSync(p)) {
    try {
      const raw = JSON.parse(readFileSync(p, 'utf-8'))
      cached = mergeWithDefaults(raw)
      return cached!
    } catch {
      // corrupt file — reset
    }
  }
  cached = { ...DEFAULTS, captcha: { ...DEFAULT_CAPTCHA, apiKeys: { ...DEFAULT_CAPTCHA.apiKeys } } }
  return cached
}

function mergeWithDefaults(raw: any): AppSettings {
  const captcha: CaptchaConfig = {
    defaultProvider: raw?.captcha?.defaultProvider ?? DEFAULT_CAPTCHA.defaultProvider,
    apiKeys: {
      ...DEFAULT_CAPTCHA.apiKeys,
      ...(raw?.captcha?.apiKeys ?? {})
    }
  }
  return { ...DEFAULTS, ...raw, captcha }
}

export function updateSettings(partial: Partial<AppSettings>): AppSettings {
  const current = getSettings()
  const updated = { ...current, ...partial }
  writeFileSync(settingsPath(), JSON.stringify(updated, null, 2))
  cached = updated
  return updated
}
