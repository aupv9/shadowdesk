import en from './locales/en'
import vi from './locales/vi'
import type { TranslationKey } from './locales/en'

export type SupportedLocale = 'en' | 'vi'

const locales: Record<SupportedLocale, Record<string, string>> = { en, vi }

let currentLocale: SupportedLocale = 'en'

export function setLocale(locale: SupportedLocale): void {
  currentLocale = locale
}

export function getLocale(): SupportedLocale {
  return currentLocale
}

export function t(key: TranslationKey): string {
  return locales[currentLocale]?.[key] ?? locales.en[key] ?? key
}

export function getSupportedLocales(): { code: SupportedLocale; name: string }[] {
  return [
    { code: 'en', name: 'English' },
    { code: 'vi', name: 'Tiếng Việt' },
  ]
}

export type { TranslationKey }
