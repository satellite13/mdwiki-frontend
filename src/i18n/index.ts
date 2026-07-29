import { createI18n } from 'vue-i18n'
import { readString, writeString } from '@/utils/localPreferences'
import { en } from './en'
import { ru } from './ru'

const LOCALE_KEY = 'locale'

export type AppLocale = 'en' | 'ru'

function readInitialLocale(): AppLocale {
  return readString(LOCALE_KEY) === 'ru' ? 'ru' : 'en'
}

export const i18n = createI18n({
  legacy: false,
  locale: readInitialLocale(),
  fallbackLocale: 'en',
  globalInjection: true,
  messages: { en, ru }
})

export function getLocale(): AppLocale {
  return i18n.global.locale.value as AppLocale
}

export function setLocale(locale: AppLocale) {
  i18n.global.locale.value = locale
  writeString(LOCALE_KEY, locale)
}

export function toggleLocale() {
  setLocale(getLocale() === 'ru' ? 'en' : 'ru')
}
