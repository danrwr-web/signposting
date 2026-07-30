/**
 * @jest-environment node
 */

import { sanitizeAdminToolkitHtml, sanitizeHtml, stripHtmlToPlainText } from '@/lib/sanitizeHtml'

describe('sanitizeHtml (node)', () => {
  it('sanitises HTML without requiring a DOM/JSDOM', () => {
    expect(() => sanitizeHtml('<p>Hello</p><script>alert(1)</script>')).not.toThrow()
    expect(sanitizeHtml('<p>Hello</p><script>alert(1)</script>')).toBe('<p>Hello</p>')
  })

  it('strips img entirely (images are handbook-only)', () => {
    expect(sanitizeHtml('<p>Before <img src="/api/admin-toolkit/images/clx123abc" alt="x"> after</p>')).toBe(
      '<p>Before  after</p>'
    )
  })
})

describe('sanitizeAdminToolkitHtml', () => {
  it('keeps img pointing at the internal handbook image route', () => {
    expect(
      sanitizeAdminToolkitHtml('<p><img src="/api/admin-toolkit/images/clx123abc" alt="Rota" /></p>')
    ).toBe('<p><img src="/api/admin-toolkit/images/clx123abc" alt="Rota" /></p>')
  })

  it('keeps img with empty alt (decorative)', () => {
    expect(sanitizeAdminToolkitHtml('<p><img src="/api/admin-toolkit/images/clx123abc" alt="" /></p>')).toBe(
      '<p><img src="/api/admin-toolkit/images/clx123abc" alt="" /></p>'
    )
  })

  it('drops img with external, data: or javascript: sources', () => {
    expect(sanitizeAdminToolkitHtml('<p><img src="https://evil.example/x.png" /></p>')).toBe('<p></p>')
    expect(sanitizeAdminToolkitHtml('<p><img src="http://evil.example/x.png" /></p>')).toBe('<p></p>')
    expect(sanitizeAdminToolkitHtml('<p><img src="//evil.example/x.png" /></p>')).toBe('<p></p>')
    expect(sanitizeAdminToolkitHtml('<p><img src="data:image/png;base64,AAAA" /></p>')).toBe('<p></p>')
    expect(sanitizeAdminToolkitHtml('<p><img src="javascript:alert(1)" /></p>')).toBe('<p></p>')
  })

  it('drops img with non-matching relative paths or no src', () => {
    expect(sanitizeAdminToolkitHtml('<p><img src="/api/other/x.png" /></p>')).toBe('<p></p>')
    expect(sanitizeAdminToolkitHtml('<p><img src="../etc/passwd" /></p>')).toBe('<p></p>')
    expect(sanitizeAdminToolkitHtml('<p><img src="/api/admin-toolkit/images/abc/../../x" /></p>')).toBe('<p></p>')
    expect(sanitizeAdminToolkitHtml('<p><img alt="no src" /></p>')).toBe('<p></p>')
  })

  it('strips disallowed attributes but keeps src and alt', () => {
    expect(
      sanitizeAdminToolkitHtml(
        '<p><img src="/api/admin-toolkit/images/clx123abc" alt="x" title="t" width="600" onerror="alert(1)" /></p>'
      )
    ).toBe('<p><img src="/api/admin-toolkit/images/clx123abc" alt="x" /></p>')
  })

  it('otherwise matches the base allowlist', () => {
    expect(sanitizeAdminToolkitHtml('<p>Hello</p><script>alert(1)</script>')).toBe('<p>Hello</p>')
  })

  it('keeps links to the internal handbook file route (uploaded PDFs)', () => {
    const html = '<p><a href="/api/admin-toolkit/files/clx123abc" target="_blank" rel="noopener">SOP</a></p>'
    expect(sanitizeAdminToolkitHtml(html)).toBe(html)
    // The base sanitizer keeps relative hrefs too — links aren't handbook-only.
    expect(sanitizeHtml(html)).toBe(html)
  })

  it('still strips javascript: links', () => {
    expect(sanitizeAdminToolkitHtml('<p><a href="javascript:alert(1)">x</a></p>')).toBe('<p><a>x</a></p>')
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

