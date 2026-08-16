/**
 * @jest-environment node
 */

import {
  escapeHtml,
  sanitizeAdminToolkitHtml,
  sanitizeAppointmentHtml,
  sanitizeHtml,
  sanitizeSymptomHtml,
  stripHtmlToPlainText,
} from '@/lib/sanitizeHtml'

describe('sanitizeHtml (node)', () => {
  it('sanitises HTML without requiring a DOM/JSDOM', () => {
    expect(() => sanitizeHtml('<p>Hello</p><script>alert(1)</script>')).not.toThrow()
    expect(sanitizeHtml('<p>Hello</p><script>alert(1)</script>')).toBe('<p>Hello</p>')
  })

  it('strips img entirely (images need a module-specific sanitizer)', () => {
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

  it('strips disallowed attributes but keeps src, alt and numeric width', () => {
    expect(
      sanitizeAdminToolkitHtml(
        '<p><img src="/api/admin-toolkit/images/clx123abc" alt="x" title="t" width="600" onerror="alert(1)" /></p>'
      )
    ).toBe('<p><img src="/api/admin-toolkit/images/clx123abc" alt="x" width="600" /></p>')
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

describe('sanitizeSymptomHtml', () => {
  it('keeps img pointing at the internal symptom image route', () => {
    expect(
      sanitizeSymptomHtml('<p><img src="/api/symptom-images/clx123abc" alt="Triage chart" /></p>')
    ).toBe('<p><img src="/api/symptom-images/clx123abc" alt="Triage chart" /></p>')
  })

  it('drops img with external, data: or handbook-route sources', () => {
    expect(sanitizeSymptomHtml('<p><img src="https://evil.example/x.png" /></p>')).toBe('<p></p>')
    expect(sanitizeSymptomHtml('<p><img src="data:image/png;base64,AAAA" /></p>')).toBe('<p></p>')
    // Handbook images belong to the handbook sanitizer, not symptom content.
    expect(sanitizeSymptomHtml('<p><img src="/api/admin-toolkit/images/clx123abc" /></p>')).toBe('<p></p>')
    expect(sanitizeSymptomHtml('<p><img src="/api/symptom-images/abc/../../x" /></p>')).toBe('<p></p>')
  })

  it('strips disallowed attributes but keeps src, alt and numeric width', () => {
    expect(
      sanitizeSymptomHtml(
        '<p><img src="/api/symptom-images/clx123abc" alt="x" width="320" title="t" onerror="alert(1)" /></p>'
      )
    ).toBe('<p><img src="/api/symptom-images/clx123abc" alt="x" width="320" /></p>')
  })

  it('drops non-numeric width values', () => {
    expect(
      sanitizeSymptomHtml('<p><img src="/api/symptom-images/clx123abc" width="50%" /></p>')
    ).toBe('<p><img src="/api/symptom-images/clx123abc" /></p>')
    expect(
      sanitizeSymptomHtml('<p><img src="/api/symptom-images/clx123abc" width="320px" /></p>')
    ).toBe('<p><img src="/api/symptom-images/clx123abc" /></p>')
  })

  it('otherwise matches the base allowlist', () => {
    expect(sanitizeSymptomHtml('<p>Hello</p><script>alert(1)</script>')).toBe('<p>Hello</p>')
  })

  it('is not accepted by the handbook sanitizer (routes are not interchangeable)', () => {
    expect(sanitizeAdminToolkitHtml('<p><img src="/api/symptom-images/clx123abc" /></p>')).toBe('<p></p>')
  })
})

describe('sanitizeAppointmentHtml', () => {
  it('keeps img pointing at the internal appointment image route', () => {
    expect(
      sanitizeAppointmentHtml('<p><img src="/api/appointment-images/clx123abc" alt="Clinic room" /></p>')
    ).toBe('<p><img src="/api/appointment-images/clx123abc" alt="Clinic room" /></p>')
  })

  it('drops img with external, data:, handbook or symptom-route sources', () => {
    expect(sanitizeAppointmentHtml('<p><img src="https://evil.example/x.png" /></p>')).toBe('<p></p>')
    expect(sanitizeAppointmentHtml('<p><img src="data:image/png;base64,AAAA" /></p>')).toBe('<p></p>')
    // Other modules' images belong to their own sanitizers.
    expect(sanitizeAppointmentHtml('<p><img src="/api/admin-toolkit/images/clx123abc" /></p>')).toBe('<p></p>')
    expect(sanitizeAppointmentHtml('<p><img src="/api/symptom-images/clx123abc" /></p>')).toBe('<p></p>')
    expect(sanitizeAppointmentHtml('<p><img src="/api/appointment-images/abc/../../x" /></p>')).toBe('<p></p>')
  })

  it('strips disallowed attributes but keeps src, alt and numeric width', () => {
    expect(
      sanitizeAppointmentHtml(
        '<p><img src="/api/appointment-images/clx123abc" alt="x" width="320" title="t" onerror="alert(1)" /></p>'
      )
    ).toBe('<p><img src="/api/appointment-images/clx123abc" alt="x" width="320" /></p>')
  })

  it('drops non-numeric width values', () => {
    expect(
      sanitizeAppointmentHtml('<p><img src="/api/appointment-images/clx123abc" width="50%" /></p>')
    ).toBe('<p><img src="/api/appointment-images/clx123abc" /></p>')
  })

  it('otherwise matches the base allowlist', () => {
    expect(sanitizeAppointmentHtml('<p>Hello</p><script>alert(1)</script>')).toBe('<p>Hello</p>')
  })

  it('is not accepted by the other sanitizers (routes are not interchangeable)', () => {
    expect(sanitizeAdminToolkitHtml('<p><img src="/api/appointment-images/clx123abc" /></p>')).toBe('<p></p>')
    expect(sanitizeSymptomHtml('<p><img src="/api/appointment-images/clx123abc" /></p>')).toBe('<p></p>')
  })
})

describe('escapeHtml', () => {
  it('escapes tag-shaped and entity characters for text-node use', () => {
    expect(escapeHtml('Use <code>ABC</code> & more')).toBe(
      'Use &lt;code&gt;ABC&lt;/code&gt; &amp; more'
    )
  })

  it('round-trips through stripHtmlToPlainText', () => {
    const original = 'Use <code>ABC</code> & more'
    expect(stripHtmlToPlainText(escapeHtml(original))).toBe(original)
  })

  it('returns empty string for empty input', () => {
    expect(escapeHtml('')).toBe('')
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

  it('separates adjacent blocks that nothing else divides', () => {
    // Editor output has no whitespace between blocks, so stripping alone fused
    // them: "Call 999.Otherwise call 111." Two clinical steps become one
    // sentence — in a note's plain-text mirror, and in the text sent to a model.
    expect(stripHtmlToPlainText('<p>Call 999.</p><p>Otherwise call 111.</p>')).toBe(
      'Call 999. Otherwise call 111.'
    )
    expect(stripHtmlToPlainText('<ul><li>First</li><li>Second</li></ul>')).toBe('First Second')
    expect(stripHtmlToPlainText('<h2>Heading</h2><p>Body</p>')).toBe('Heading Body')
  })

  it('treats a line break as a boundary', () => {
    expect(stripHtmlToPlainText('Line one<br>Line two')).toBe('Line one Line two')
    expect(stripHtmlToPlainText('Line one<br />Line two')).toBe('Line one Line two')
  })

  it('does not introduce a separator inside a block', () => {
    expect(stripHtmlToPlainText('<p>Use the <strong>Duty GP line</strong> now</p>')).toBe(
      'Use the Duty GP line now'
    )
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

