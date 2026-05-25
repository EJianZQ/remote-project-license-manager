import dayjs from 'dayjs'
import { translate } from '@/i18n'

export function formatDateTime(value?: string | null) {
  if (!value) {
    return translate('common.permanent')
  }

  return dayjs(value).format('YYYY-MM-DD HH:mm')
}

export function formatJson(value: unknown) {
  return JSON.stringify(value ?? null, null, 2)
}
