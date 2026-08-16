import { splitHighlightSegments } from '@/lib/highlightSegments'
import type { HighlightRule } from '@/lib/highlighting'

const rule = (phrase: string, overrides: Partial<HighlightRule> = {}): HighlightRule => ({
  id: `rule-${phrase}`,
  phrase,
  textColor: '#ffffff',
  bgColor: '#da020e',
  isEnabled: true,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  ...overrides,
})

/** Reassembling the segments must always reproduce the original text. */
const rejoin = (segments: Array<{ text: string }>) => segments.map((s) => s.text).join('')

describe('splitHighlightSegments', () => {
  it('returns a single plain segment when nothing matches', () => {
    expect(splitHighlightSegments('Book an appointment', [], false)).toEqual([
      { text: 'Book an appointment' },
    ])
  })

  it('returns nothing for empty text', () => {
    expect(splitHighlightSegments('', [rule('urgent')])).toEqual([])
  })

  it('styles a custom rule match and leaves the surrounding text plain', () => {
    const segments = splitHighlightSegments('Treat as urgent today', [rule('urgent')], false)

    expect(rejoin(segments)).toBe('Treat as urgent today')
    const highlighted = segments.filter((s) => s.style)
    expect(highlighted).toHaveLength(1)
    expect(highlighted[0]).toMatchObject({
      text: 'urgent',
      style: { color: '#ffffff', backgroundColor: '#da020e' },
    })
  })

  it('matches case-insensitively but preserves the original casing', () => {
    const segments = splitHighlightSegments('URGENT review', [rule('urgent')], false)
    expect(segments.find((s) => s.style)?.text).toBe('URGENT')
  })

  it('respects word boundaries for alphanumeric phrases', () => {
    // "ear" must not fire inside "hearing" — the same rule the HTML path uses.
    const segments = splitHighlightSegments('hearing loss', [rule('ear')], false)
    expect(segments.every((s) => !s.style)).toBe(true)
  })

  it('still matches phrases that are not purely alphanumeric', () => {
    const segments = splitHighlightSegments('Send to A&E now', [rule('A&E')], false)
    expect(segments.find((s) => s.style)?.text).toBe('A&E')
  })

  it('ignores disabled and empty rules', () => {
    const segments = splitHighlightSegments(
      'urgent care',
      [rule('urgent', { isEnabled: false }), rule('')],
      false
    )
    expect(segments.every((s) => !s.style)).toBe(true)
  })

  it('applies built-in slot highlighting', () => {
    const segments = splitHighlightSegments('Book a Green Slot today', [], true)
    const highlighted = segments.find((s) => s.className)
    expect(highlighted?.text).toBe('Green Slot')
    expect(highlighted?.className).toContain('bg-green-600')
  })

  it('skips built-ins when the practice has them switched off', () => {
    const segments = splitHighlightSegments('Book a Green Slot today', [], false)
    expect(segments).toEqual([{ text: 'Book a Green Slot today' }])
  })

  it('lets a custom rule win over a built-in on the same text', () => {
    // A practice overriding its slot colours must not get both applied.
    const segments = splitHighlightSegments('Book a Green Slot', [rule('Green Slot')], true)
    const highlighted = segments.filter((s) => s.style || s.className)
    expect(highlighted).toHaveLength(1)
    expect(highlighted[0].style).toBeDefined()
    expect(highlighted[0].className).toBeUndefined()
  })

  it('never overlaps matches, so highlights cannot nest', () => {
    const segments = splitHighlightSegments(
      'Red Slot urgent Red Slot',
      [rule('Red Slot'), rule('Slot urgent Red')],
      true
    )
    expect(rejoin(segments)).toBe('Red Slot urgent Red Slot')
    // Two "Red Slot" matches claimed first; the straddling rule cannot apply.
    expect(segments.filter((s) => s.style)).toHaveLength(2)
  })

  it('handles several matches in one string, in document order', () => {
    const segments = splitHighlightSegments(
      'urgent: book a Green Slot, else Orange Slot',
      [rule('urgent')],
      true
    )
    expect(rejoin(segments)).toBe('urgent: book a Green Slot, else Orange Slot')
    expect(segments.filter((s) => s.style || s.className).map((s) => s.text)).toEqual([
      'urgent',
      'Green Slot',
      'Orange Slot',
    ])
  })

  it('tolerates a null rules list', () => {
    expect(splitHighlightSegments('Green Slot', null, false)).toEqual([{ text: 'Green Slot' }])
  })
})
