import { createI18n } from 'vue-i18n'
import { messages, type LocaleCode } from './messages'

const STORAGE_KEY = 'license_console_locale'
const DEFAULT_LOCALE: LocaleCode = 'zh-CN'
const canUseBrowserApis = typeof window !== 'undefined' && typeof document !== 'undefined'

export const localeOptions: Array<{ value: LocaleCode; labelKey: string; flag: 'cn' | 'tw' | 'au' }> = [
  { value: 'zh-CN', labelKey: 'language.zhCN', flag: 'cn' },
  { value: 'zh-TW', labelKey: 'language.zhTW', flag: 'tw' },
  { value: 'en-US', labelKey: 'language.enUS', flag: 'au' },
]

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: getInitialLocale(),
  fallbackLocale: DEFAULT_LOCALE,
  messages,
})

export function setLocale(locale: LocaleCode) {
  i18n.global.locale.value = locale
  writeStoredLocale(locale)
  applyLocaleMeta(locale)
}

export function translate(key: string, named?: Record<string, unknown>) {
  return named ? i18n.global.t(key, named) : i18n.global.t(key)
}

export function getCurrentLocale() {
  return i18n.global.locale.value as LocaleCode
}

function getInitialLocale(): LocaleCode {
  if (!canUseBrowserApis) return DEFAULT_LOCALE

  const saved = readStoredLocale()
  if (isLocaleCode(saved)) return saved

  const browserLanguage = window.navigator.language
  if (browserLanguage.toLowerCase().startsWith('zh-tw')) return 'zh-TW'
  if (browserLanguage.toLowerCase().startsWith('zh-hk')) return 'zh-TW'
  if (browserLanguage.toLowerCase().startsWith('zh')) return 'zh-CN'
  if (browserLanguage.toLowerCase().startsWith('en')) return 'en-US'

  return DEFAULT_LOCALE
}

function isLocaleCode(value: string | null): value is LocaleCode {
  return value === 'zh-CN' || value === 'zh-TW' || value === 'en-US'
}

function readStoredLocale() {
  if (!canUseBrowserApis) return null

  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function writeStoredLocale(locale: LocaleCode) {
  if (!canUseBrowserApis) return

  try {
    window.localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    // Locale persistence is a convenience. The app should still switch language if storage is unavailable.
  }
}

function applyLocaleMeta(locale: LocaleCode) {
  if (!canUseBrowserApis) return

  document.documentElement.lang = locale
  document.title = translate('common.appTitle')
}

applyLocaleMeta(getCurrentLocale())
