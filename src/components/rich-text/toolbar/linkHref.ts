/**
 * Only hrefs the sanitizer allows — anything else would be silently
 * stripped on save, leaving a dead link.
 */
export function normalizeHref(raw: string): string | null {
  const value = raw.trim()
  if (!value) return null
  if (/^(https?:\/\/|mailto:)/i.test(value)) return value
  // Internal uploaded-PDF links (Practice Handbook): relative hrefs with no
  // scheme survive both sanitizers, so pass them through unchanged.
  if (/^\/api\/admin-toolkit\/files\/[a-z0-9]+$/i.test(value)) return value
  // Bare e-mail address → mailto.
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return `mailto:${value}`
  // Reject other explicit schemes (javascript:, data:, ftp:, …).
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return null
  // Reject other relative paths — assuming https:// would make a dead link.
  if (value.startsWith('/')) return null
  // Bare domain → assume https.
  return `https://${value}`
}
