import { normalizeHtml, cleanPastedHtml } from '@/components/rich-text/normalizeHtml'

describe('normalizeHtml', () => {
  it('returns empty string for empty/invalid input', () => {
    expect(normalizeHtml('')).toBe('')
  })

  it('returns HTML containing block-level tags unchanged', () => {
    expect(normalizeHtml('<p>Hello</p>')).toBe('<p>Hello</p>')
    // Inline handbook images always sit inside a <p>, so image-only content
    // still matches the block-tag check and passes through untouched.
    expect(normalizeHtml('<p><img src="/api/admin-toolkit/images/abc" alt="" /></p>')).toBe(
      '<p><img src="/api/admin-toolkit/images/abc" alt="" /></p>'
    )
    expect(normalizeHtml('<h2>Title</h2><p>Body</p>')).toBe('<h2>Title</h2><p>Body</p>')
    // The old ensureProperParagraphs wrapped these in a stray <p>.
    expect(normalizeHtml('<ul><li>One</li><li>Two</li></ul>')).toBe('<ul><li>One</li><li>Two</li></ul>')
    expect(normalizeHtml('<h2>Heading only</h2>')).toBe('<h2>Heading only</h2>')
    expect(normalizeHtml('<blockquote><p>q</p></blockquote>')).toBe('<blockquote><p>q</p></blockquote>')
  })

  it('splits multi-line plain text into paragraphs', () => {
    expect(normalizeHtml('line one\nline two')).toBe('<p>line one</p><p>line two</p>')
    expect(normalizeHtml('one\n\n\ntwo')).toBe('<p>one</p><p>two</p>')
    expect(normalizeHtml('\n \n')).toBe('<p></p>')
  })

  it('wraps single-line plain text in a paragraph', () => {
    expect(normalizeHtml('just text')).toBe('<p>just text</p>')
  })

  it('wraps inline-only HTML in a paragraph', () => {
    expect(normalizeHtml('<strong>bold</strong> text')).toBe('<p><strong>bold</strong> text</p>')
  })
})

describe('cleanPastedHtml', () => {
  it('strips Word artifacts: comments, styles, o: tags, Mso classes, mso styles', () => {
    const word =
      '<!--[if gte mso 9]><xml><w:WordDocument></w:WordDocument></xml><![endif]-->' +
      '<style>p.MsoNormal { margin: 0; }</style>' +
      '<p class="MsoNormal" style="mso-margin-top-alt:auto; color: #005EB8;">Hello<o:p></o:p></p>'
    expect(cleanPastedHtml(word)).toBe('<p style=" color: #005EB8;">Hello</p>')
  })

  it('unwraps the Google Docs bold wrapper without bolding everything', () => {
    const gdocs =
      '<b style="font-weight:normal" id="docs-internal-guid-123"><p>Some text</p></b>'
    const cleaned = cleanPastedHtml(gdocs)
    expect(cleaned).toContain('<span style="font-weight:normal" id="docs-internal-guid-123">')
    expect(cleaned).not.toContain('<strong style="font-weight:normal"')
  })

  it('converts presentational b/i tags to strong/em', () => {
    expect(cleanPastedHtml('<p><b>bold</b> and <i>italic</i></p>')).toBe(
      '<p><strong>bold</strong> and <em>italic</em></p>'
    )
  })

  it('leaves br and img-free content untouched otherwise', () => {
    expect(cleanPastedHtml('<p>line<br>two</p>')).toBe('<p>line<br>two</p>')
  })
})
