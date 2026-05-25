export type JsonObject = Record<string, unknown>;

export function isPlainJsonObject(value: unknown): value is JsonObject {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

export function stringifyJsonObject(value: JsonObject): string {
  return JSON.stringify(value);
}

export function stringifyStringArray(value: string[]): string {
  return JSON.stringify(value);
}

export function parseJsonObject(value: string | null): JsonObject {
  if (!value) {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(value);
    return isPlainJsonObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function parseStringArray(value: string | null): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

export function parseNullableJson(value: string | null): unknown {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
