import { create } from 'zustand'
import {
  setLocale,
  getLocale,
  t,
  getSupportedLocales,
  type SupportedLocale,
  type TranslationKey,
} from '../i18n'

interface I18nState {
  locale: SupportedLocale
  setLocale: (locale: SupportedLocale) => void
  t: (key: TranslationKey) => string
  supportedLocales: { code: SupportedLocale; name: string }[]
}

export const useI18nStore = create<I18nState>((set, get) => ({
  locale: getLocale(),
  setLocale: (locale: SupportedLocale) => {
    setLocale(locale)
    set({ locale })
  },
  t,
  supportedLocales: getSupportedLocales(),
}))
