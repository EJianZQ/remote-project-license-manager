const HOSTNAME_PATTERN =
  /^(localhost|(\d{1,3}\.){3}\d{1,3}|[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*)$/;

export function normalizeDomain(value: string): string | null {
  const trimmed = value.trim().toLowerCase().replace(/\.$/, "");

  if (
    trimmed.length === 0 ||
    trimmed.length > 253 ||
    trimmed.includes("://") ||
    /[/?#:\s]/.test(trimmed)
  ) {
    return null;
  }

  return HOSTNAME_PATTERN.test(trimmed) ? trimmed : null;
}

export function extractHostnameFromUrl(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function extractRequestDomain(
  origin: string | undefined,
  referer: string | undefined
): string | null {
  const originDomain = extractHostnameFromUrl(origin);
  if (originDomain) {
    return originDomain;
  }

  return extractHostnameFromUrl(referer);
}

export function isDomainAllowed(
  requestDomain: string | null,
  allowedDomains: string[]
): boolean {
  if (allowedDomains.length === 0) {
    return true;
  }

  if (!requestDomain) {
    return false;
  }

  const normalizedRequestDomain = normalizeDomain(requestDomain);
  if (!normalizedRequestDomain) {
    return false;
  }

  return allowedDomains.includes(normalizedRequestDomain);
}
