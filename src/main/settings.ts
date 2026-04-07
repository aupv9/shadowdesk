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

// Phase 16 — AI assistant configuration
export interface AiConfig {
  /** Anthropic API key (stored in plain settings, never sent to renderer) */
  apiKey: string
  /** Enable/disable all AI-assisted features */
  enabled: boolean
  /** Hard cap on LLM calls per app session (default 20) */
  maxCallsPerSession: number
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
  /** Phase 16 — AI assistant configuration. */
  ai: AiConfig
}

const DEFAULT_CAPTCHA: CaptchaConfig = {
  defaultProvider: '2captcha',
  apiKeys: {
    '2captcha':    '',
    'anticaptcha': '',
    'capmonster':  ''
  }
}

const DEFAULT_AI: AiConfig = {
  apiKey: '',
  enabled: true,
  maxCallsPerSession: 20
}

const DEFAULTS: AppSettings = {
  defaultPreset: 'win10-chrome120',
  language: 'en',
  theme: 'dark',
  autoLaunchLastSession: false,
  autoSyncBinaryUA: true,
  captcha: DEFAULT_CAPTCHA,
  ai: DEFAULT_AI
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
  cached = { ...DEFAULTS, captcha: { ...DEFAULT_CAPTCHA, apiKeys: { ...DEFAULT_CAPTCHA.apiKeys } }, ai: { ...DEFAULT_AI } }
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
  const ai: AiConfig = {
    ...DEFAULT_AI,
    ...(raw?.ai ?? {})
  }
  return { ...DEFAULTS, ...raw, captcha, ai }
}

export function updateSettings(partial: Partial<AppSettings>): AppSettings {
  const current = getSettings()
  const updated = { ...current, ...partial }
  writeFileSync(settingsPath(), JSON.stringify(updated, null, 2))
  cached = updated
  return updated
}
