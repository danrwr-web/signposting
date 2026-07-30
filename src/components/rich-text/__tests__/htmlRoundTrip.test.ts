/**
 * Characterization tests: how stored `instructionsHtml` survives a parse →
 * serialize round trip through the editor schema.
 *
 * These pin the behaviour that matters for `aiRerunPlan`, which classifies a
 * symptom as AI-safe by exact string equality of stored HTML: the editor must
 * never re-serialize content except when the user edits, and when it does,
 * these are the transformations the saved HTML undergoes.
 */
import { generateHTML, generateJSON } from '@tiptap/html'
import { createRichTextExtensions } from '@/components/rich-text/extensions'
import { sanitizeAdminToolkitHtml, sanitizeHtml } from '@/lib/sanitizeHtml'

const extensions = createRichTextExtensions()

// jsdom's serializer adds an xmlns attribute that real browsers omit.
const stripJsdomArtifacts = (html: string) =>
  html.replace(/ xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/g, '')

const roundTrip = (html: string) =>
  stripJsdomArtifacts(generateHTML(generateJSON(html, extensions), extensions))

describe('HTML round trip through the editor schema', () => {
  it('preserves plain paragraphs', () => {
    expect(roundTrip('<p>Advise the patient to rest.</p>')).toBe('<p>Advise the patient to rest.</p>')
  })

  it('drops the legacy prose-p class (delta)', () => {
    // Older documents carry <p class="prose-p"> from the previous editor
    // config; nothing styles that class, and it disappears when a document is
    // edited and re-saved.
    expect(roundTrip('<p class="prose-p">Advise the patient to rest.</p>')).toBe(
      '<p>Advise the patient to rest.</p>'
    )
  })

  it('preserves bold, italic, underline and hard breaks', () => {
    expect(roundTrip('<p><strong>Bold</strong> and <em>italic</em>.</p>')).toBe(
      '<p><strong>Bold</strong> and <em>italic</em>.</p>'
    )
    expect(roundTrip('<p><u>underlined</u></p>')).toBe('<p><u>underlined</u></p>')
    expect(roundTrip('<p>line one<br />line two</p>')).toBe('<p>line one<br />line two</p>')
  })

  it('re-serializes hex text colours as rgb() (delta)', () => {
    // The sanitizer stores hex; ProseMirror serializes computed rgb. Any edit
    // therefore rewrites colour values even if the user did not touch them.
    expect(roundTrip('<p>If <span style="color: #DA020E;">chest pain</span> call 999.</p>')).toBe(
      '<p>If <span style="color: rgb(218, 2, 14);">chest pain</span> call 999.</p>'
    )
  })

  it('wraps list item content in paragraphs (delta) and preserves nesting', () => {
    expect(roundTrip('<ul><li>One</li><li>Two</li></ul>')).toBe(
      '<ul><li><p>One</p></li><li><p>Two</p></li></ul>'
    )
    expect(roundTrip('<ol><li>First</li><li>Second</li></ol>')).toBe(
      '<ol><li><p>First</p></li><li><p>Second</p></li></ol>'
    )
    expect(roundTrip('<ul><li>One<ul><li>Sub</li></ul></li></ul>')).toBe(
      '<ul><li><p>One</p><ul><li><p>Sub</p></li></ul></li></ul>'
    )
  })

  it('preserves h2/h3 and blockquotes; other heading levels become paragraphs (delta)', () => {
    expect(roundTrip('<h2>Heading</h2><p>Body</p>')).toBe('<h2>Heading</h2><p>Body</p>')
    expect(roundTrip('<h3>Sub</h3>')).toBe('<h3>Sub</h3>')
    expect(roundTrip('<h1>Big heading</h1>')).toBe('<p>Big heading</p>')
    expect(roundTrip('<h4>H4</h4>')).toBe('<p>H4</p>')
    expect(roundTrip('<blockquote><p>quoted</p></blockquote>')).toBe(
      '<blockquote><p>quoted</p></blockquote>'
    )
  })

  it('preserves highlight marks (with data-color + computed rgb)', () => {
    expect(roundTrip('<p><mark style="background-color: #FEF3C7;">note</mark></p>')).toBe(
      '<p><mark data-color="rgb(254, 243, 199)" style="background-color: rgb(254, 243, 199); color: inherit;">note</mark></p>'
    )
  })

  it('re-parses highlight marks after sanitization strips data-color', () => {
    // Save path: editor output → sanitizeHtml → stored. Reload must keep the
    // highlight even though the sanitizer removes the data-color attribute.
    const editorOutput =
      '<p><mark data-color="#FEF3C7" style="background-color: rgb(254, 243, 199); color: inherit;">note</mark></p>'
    const stored = sanitizeHtml(editorOutput)
    expect(stored).toBe('<p><mark style="background-color: rgb(254, 243, 199); color: inherit;">note</mark></p>')
    expect(roundTrip(stored)).toBe(
      '<p><mark data-color="rgb(254, 243, 199)" style="background-color: rgb(254, 243, 199); color: inherit;">note</mark></p>'
    )
  })

  it('decorates links with target/rel attributes and keeps mailto (delta)', () => {
    expect(roundTrip('<p><a href="https://nhs.uk">NHS</a></p>')).toBe(
      '<p><a target="_blank" rel="noopener noreferrer nofollow" href="https://nhs.uk">NHS</a></p>'
    )
    expect(roundTrip('<p><a href="mailto:x@y.com">mail</a></p>')).toBe(
      '<p><a target="_blank" rel="noopener noreferrer nofollow" href="mailto:x@y.com">mail</a></p>'
    )
  })

  it('rejects javascript: links (delta)', () => {
    expect(roundTrip('<p><a href="javascript:alert(1)">bad</a></p>')).toBe('<p>bad</p>')
  })

  it('drops disabled nodes/marks: strike and horizontal rule (delta)', () => {
    // <s> and <hr> are not in the sanitizer allowlist, so the schema disables
    // them; content survives, the formatting goes.
    expect(roundTrip('<p><s>struck</s></p>')).toBe('<p>struck</p>')
    expect(roundTrip('<hr />')).toBe('<p></p>')
  })

  it('converts font-weight spans to <strong> and divs to paragraphs (delta)', () => {
    expect(roundTrip('<p><span style="font-weight: bold;">heavy</span></p>')).toBe(
      '<p><span><strong>heavy</strong></span></p>'
    )
    expect(roundTrip('<div>div content</div>')).toBe('<p>div content</p>')
  })

  it('drops images with the default (symptom-instruction) schema', () => {
    // Images are Practice Handbook-only; the base schema must not accept them.
    expect(roundTrip('<p>Before <img src="/api/admin-toolkit/images/abc" alt="x"> after</p>')).toBe(
      '<p>Before after</p>'
    )
  })
})

describe('HTML round trip with images enabled (Practice Handbook schema)', () => {
  const imageExtensions = createRichTextExtensions({ enableImages: true })
  const roundTripWithImages = (html: string) =>
    stripJsdomArtifacts(generateHTML(generateJSON(html, imageExtensions), imageExtensions))

  it('preserves an inline image with src and alt', () => {
    expect(
      roundTripWithImages('<p>Before <img src="/api/admin-toolkit/images/abc" alt="Rota"> after</p>')
    ).toBe('<p>Before <img src="/api/admin-toolkit/images/abc" alt="Rota" /> after</p>')
  })

  it('survives the handbook save path (sanitizeAdminToolkitHtml → reload)', () => {
    const stored = sanitizeAdminToolkitHtml(
      roundTripWithImages('<p><img src="/api/admin-toolkit/images/abc" alt=""></p>')
    )
    expect(stored).toBe('<p><img src="/api/admin-toolkit/images/abc" alt="" /></p>')
    expect(roundTripWithImages(stored)).toBe('<p><img src="/api/admin-toolkit/images/abc" alt="" /></p>')
  })

  it('drops title/width attributes the schema does not allow', () => {
    expect(
      roundTripWithImages('<p><img src="/api/admin-toolkit/images/abc" alt="x" title="t" width="600"></p>')
    ).toBe('<p><img src="/api/admin-toolkit/images/abc" alt="x" /></p>')
  })
})
