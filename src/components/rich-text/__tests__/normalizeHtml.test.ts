/**
 * Characterization of the current content normalizer used when hydrating the
 * editor from stored `instructionsHtml` / legacy plain-text `instructions`.
 */
import { ensureProperParagraphs } from '@/components/editor/SafeTipTapEditor'

describe('ensureProperParagraphs (current behaviour)', () => {
  it('returns empty string for empty/invalid input', () => {
    expect(ensureProperParagraphs('')).toBe('')
  })

  it('returns content containing <p> tags unchanged', () => {
    expect(ensureProperParagraphs('<p>Hello</p>')).toBe('<p>Hello</p>')
    expect(ensureProperParagraphs('<h2>Title</h2><p>Body</p>')).toBe('<h2>Title</h2><p>Body</p>')
  })

  it('splits multi-line plain text into paragraphs', () => {
    expect(ensureProperParagraphs('line one\nline two')).toBe('<p>line one</p><p>line two</p>')
    expect(ensureProperParagraphs('one\n\n\ntwo')).toBe('<p>one</p><p>two</p>')
  })

  it('wraps single-line plain text in a paragraph', () => {
    expect(ensureProperParagraphs('just text')).toBe('<p>just text</p>')
  })

  it('BUG: wraps block-level HTML lacking <p> in a stray paragraph', () => {
    // Content that starts with a list or heading but contains no <p> gets
    // wrapped in an invalid <p>...</p>. Fixed by normalizeHtml in the rebuild.
    expect(ensureProperParagraphs('<ul><li>One</li><li>Two</li></ul>')).toBe(
      '<p><ul><li>One</li><li>Two</li></ul></p>'
    )
    expect(ensureProperParagraphs('<h2>Heading only</h2>')).toBe('<p><h2>Heading only</h2></p>')
  })
})
