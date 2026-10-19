const allowedProtocols = new Set(['http:', 'https:'])

export function normalizeHttpUrl(value: string): string {
  const trimmed = value.trim()
  const candidate = /^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`
  const url = new URL(candidate)

  if (!allowedProtocols.has(url.protocol)) {
    throw new Error('Somente endereços HTTP e HTTPS são permitidos.')
  }

  url.username = ''
  url.password = ''
  return url.toString()
}

export function isAllowedNavigation(value: string): boolean {
  try {
    const url = new URL(value)
    return allowedProtocols.has(url.protocol)
  } catch {
    return false
  }
}

