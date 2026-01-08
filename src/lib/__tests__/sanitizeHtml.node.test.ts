/**
 * @jest-environment node
 */

import { sanitizeHtml } from '@/lib/sanitizeHtml'

describe('sanitizeHtml (node)', () => {
  it('sanitises HTML without requiring a DOM/JSDOM', () => {
    expect(() => sanitizeHtml('<p>Hello</p><script>alert(1)</script>')).not.toThrow()
    expect(sanitizeHtml('<p>Hello</p><script>alert(1)</script>')).toBe('<p>Hello</p>')
  })
})

