/**
 * Convert a human-readable string into a URL-safe slug.
 *
 * Rules:
 * - lowercase
 * - trim
 * - replace whitespace with hyphen
 * - remove non-alphanumeric characters (except hyphen)
 * - collapse multiple hyphens
 */
export function slugify(input: string): string {
  const raw = (input ?? '').toString().toLowerCase().trim()

  // Replace whitespace with hyphens first, then strip anything that's not [a-z0-9-]
  const withHyphens = raw.replace(/\s+/g, '-')
  const safe = withHyphens.replace(/[^a-z0-9-]/g, '')

  // Collapse repeated hyphens and trim.
  const collapsed = safe.replace(/-+/g, '-').replace(/^-+|-+$/g, '')

  return collapsed
}

