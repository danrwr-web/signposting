/**
 * Highlight rules as *data* rather than HTML.
 *
 * `src/lib/highlighting.ts` applies the same rules by rewriting an HTML string,
 * which suits the rich-text instruction body. The smart visual renderer cannot
 * use that: it renders AI-supplied text as React text nodes only, and reaching
 * for `dangerouslySetInnerHTML` to get highlighting would hand the model a path
 * to inject markup — the one thing that renderer is built to prevent.
 *
 * So this splits plain text into styled segments the renderer turns into
 * elements itself. Patterns and classes come from the shared
 * `BUILT_IN_HIGHLIGHTS`, so the two views agree on what counts as a slot.
 */

import { BUILT_IN_HIGHLIGHTS, type HighlightRule } from '@/lib/highlighting'

export type HighlightSegment = {
  text: string
  /** Inline colours from a custom rule. */
  style?: { color: string; backgroundColor: string }
  /** Tailwind classes from a built-in slot highlight. */
  className?: string
}

type Claim = { start: number; end: number; style?: HighlightSegment['style']; className?: string }

type RuleLike = Pick<HighlightRule, 'phrase' | 'textColor' | 'bgColor' | 'isEnabled'>

/**
 * Mirrors `applyCustomRules`: phrases made only of letters, digits and spaces
 * match on word boundaries, so a rule for "ear" does not fire inside "hearing".
 */
function ruleRegex(phrase: string): RegExp {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const requiresWordBoundary = /^[\p{L}\p{N}\s]+$/u.test(phrase)
  return new RegExp(requiresWordBoundary ? `\\b${escaped}\\b` : escaped, 'gi')
}

/**
 * Split `text` into highlighted and plain segments.
 *
 * Matches never overlap: earlier matchers win, and custom rules are tried
 * before built-ins so a practice can override a slot colour. This differs
 * slightly from the HTML path, where a later rule can nest inside an earlier
 * rule's span; nested colouring has no sensible rendering here, and flattening
 * keeps highlighted phrases legible.
 *
 * Returns a single unstyled segment when nothing matches, so callers can skip
 * wrapping work entirely.
 */
export function splitHighlightSegments(
  text: string,
  rules: RuleLike[] | null | undefined,
  enableBuiltInHighlights: boolean = true
): HighlightSegment[] {
  if (!text) return []

  const claims: Claim[] = []
  const overlaps = (start: number, end: number) =>
    claims.some((c) => start < c.end && end > c.start)

  const claim = (regex: RegExp, decoration: Omit<Claim, 'start' | 'end'>) => {
    for (const match of text.matchAll(regex)) {
      const start = match.index ?? 0
      const end = start + match[0].length
      if (end > start && !overlaps(start, end)) {
        claims.push({ start, end, ...decoration })
      }
    }
  }

  for (const rule of Array.isArray(rules) ? rules : []) {
    if (!rule.isEnabled || !rule.phrase) continue
    claim(ruleRegex(rule.phrase), {
      style: { color: rule.textColor, backgroundColor: rule.bgColor },
    })
  }

  if (enableBuiltInHighlights) {
    for (const { source, className } of BUILT_IN_HIGHLIGHTS) {
      claim(new RegExp(source, 'gi'), { className })
    }
  }

  if (claims.length === 0) return [{ text }]

  claims.sort((a, b) => a.start - b.start)

  const segments: HighlightSegment[] = []
  let cursor = 0
  for (const c of claims) {
    if (c.start > cursor) segments.push({ text: text.slice(cursor, c.start) })
    segments.push({ text: text.slice(c.start, c.end), style: c.style, className: c.className })
    cursor = c.end
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor) })

  return segments
}
