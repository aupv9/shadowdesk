import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'

export interface AppSettings {
  defaultPreset: string
  language: 'en' | 'vi' | 'th' | 'id'
  theme: 'dark' | 'light'
  autoLaunchLastSession: boolean
}

const DEFAULTS: AppSettings = {
  defaultPreset: 'win10-chrome120',
  language: 'en',
  theme: 'dark',
  autoLaunchLastSession: false
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
      cached = { ...DEFAULTS, ...raw }
      return cached!
    } catch {
      // corrupt file — reset
    }
  }
  cached = { ...DEFAULTS }
  return cached
}

export function updateSettings(partial: Partial<AppSettings>): AppSettings {
  const current = getSettings()
  const updated = { ...current, ...partial }
  writeFileSync(settingsPath(), JSON.stringify(updated, null, 2))
  cached = updated
  return updated
}
