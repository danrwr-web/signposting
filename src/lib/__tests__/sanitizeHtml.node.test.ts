/**
 * @jest-environment node
 */

import { sanitizeHtml, stripHtmlToPlainText } from '@/lib/sanitizeHtml'

describe('sanitizeHtml (node)', () => {
  it('sanitises HTML without requiring a DOM/JSDOM', () => {
    expect(() => sanitizeHtml('<p>Hello</p><script>alert(1)</script>')).not.toThrow()
    expect(sanitizeHtml('<p>Hello</p><script>alert(1)</script>')).toBe('<p>Hello</p>')
  })
})

describe('stripHtmlToPlainText', () => {
  it('strips all tags including formatting and scripts', () => {
    expect(stripHtmlToPlainText('<p>Use the <strong>Duty GP line</strong></p>')).toBe(
      'Use the Duty GP line'
    )
    expect(stripHtmlToPlainText('Safe text<script>alert(1)</script>')).toBe('Safe text')
  })

  it('decodes common HTML entities', () => {
    expect(stripHtmlToPlainText('A&amp;E &quot;urgent&quot; &#39;call&#39; 1&nbsp;hour &lt;now&gt;')).toBe(
      'A&E "urgent" \'call\' 1 hour <now>'
    )
  })

  it('collapses whitespace from stripped block tags', () => {
    expect(stripHtmlToPlainText('<p>Line one</p>\n<p>Line   two</p>')).toBe('Line one Line two')
  })

  it('returns empty string for empty or tag-only input', () => {
    expect(stripHtmlToPlainText('')).toBe('')
    expect(stripHtmlToPlainText('<p></p>')).toBe('')
    expect(stripHtmlToPlainText(undefined as unknown as string)).toBe('')
  })

  it('passes plain text through unchanged', () => {
    expect(stripHtmlToPlainText('EMERGENCY CARE: (threat to life/harm) call 999')).toBe(
      'EMERGENCY CARE: (threat to life/harm) call 999'
    )
  })
})

