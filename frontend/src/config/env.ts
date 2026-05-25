function normalizeOrigin(value: string) {
  return value.replace(/\/+$/, '')
}

const runtimeOrigin = typeof window !== 'undefined' ? window.location.origin : ''

export const APP_ORIGIN = normalizeOrigin(import.meta.env.VITE_APP_ORIGIN || runtimeOrigin)
export const API_BASE_URL = normalizeOrigin(import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001')
