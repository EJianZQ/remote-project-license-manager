import { translate } from '@/i18n'

export interface DomainNormalizeResult {
  domains: string[]
  errors: string[]
}

export function normalizeDomainList(input: string | string[]): DomainNormalizeResult {
  const rawItems = Array.isArray(input)
    ? input
    : input
        .split(/[\n,，\s]+/)
        .map((item) => item.trim())
        .filter(Boolean)

  const seen = new Set<string>()
  const domains: string[] = []
  const errors: string[] = []

  for (const raw of rawItems) {
    const value = raw.trim().toLowerCase()

    if (!value) {
      continue
    }

    if (value.includes('://')) {
      errors.push(translate('domain.noProtocol', { domain: raw }))
      continue
    }

    if (value.includes('/') || value.includes(':')) {
      errors.push(translate('domain.noPathOrPort', { domain: raw }))
      continue
    }

    if (!/^[a-z0-9.-]+$/.test(value)) {
      errors.push(translate('domain.invalidChars', { domain: raw }))
      continue
    }

    if (!seen.has(value)) {
      seen.add(value)
      domains.push(value)
    }
  }

  return { domains, errors }
}
