import { translate } from '@/i18n'

export type JsonObject = Record<string, unknown>

export type JsonParseResult =
  | {
      ok: true
      value: JsonObject
    }
  | {
      ok: false
      error: string
      detail?: string
      line?: number
      column?: number
      position?: number
    }

export function parseJsonObject(input: string): JsonParseResult {
  if (!input.trim()) {
    return { ok: true, value: {} }
  }

  try {
    const value = JSON.parse(input) as unknown

    if (!isPlainJsonObject(value)) {
      return { ok: false, error: translate('json.mustBeObject') }
    }

    return { ok: true, value }
  } catch (error) {
    const detail = error instanceof Error ? error.message : ''
    const location = getJsonErrorLocation(input, detail)
    const locationText = location ? translate('json.location', { line: location.line, column: location.column }) : ''

    return {
      ok: false,
      error: locationText
        ? translate('json.syntaxWithLocation', { location: locationText })
        : translate('json.syntax'),
      detail,
      ...location,
    }
  }
}

export function formatJsonObject(value: JsonObject) {
  return JSON.stringify(value, null, 2)
}

export function isPlainJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getJsonErrorLocation(input: string, message: string) {
  const lineColumnMatch = message.match(/line\s+(\d+)\s+column\s+(\d+)/i)

  if (lineColumnMatch?.[1] && lineColumnMatch[2]) {
    return {
      line: Number(lineColumnMatch[1]),
      column: Number(lineColumnMatch[2]),
    }
  }

  const positionMatch = message.match(/position\s+(\d+)/i)

  if (!positionMatch?.[1]) {
    return undefined
  }

  const position = Number(positionMatch[1])
  const before = input.slice(0, Math.max(0, position))
  const lines = before.split(/\r\n|\r|\n/)

  return {
    line: lines.length,
    column: (lines[lines.length - 1]?.length ?? 0) + 1,
    position,
  }
}
