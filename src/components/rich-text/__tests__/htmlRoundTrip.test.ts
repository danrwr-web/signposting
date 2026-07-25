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
import StarterKit from '@tiptap/starter-kit'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'

const extensions = [
  StarterKit.configure({ paragraph: { HTMLAttributes: { class: 'prose-p' } } }),
  TextStyle,
  Color.configure({ types: ['textStyle'] }),
]

// jsdom's serializer adds an xmlns attribute that real browsers omit.
const stripJsdomArtifacts = (html: string) =>
  html.replace(/ xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/g, '')

const roundTrip = (html: string) =>
  stripJsdomArtifacts(generateHTML(generateJSON(html, extensions), extensions))

describe('HTML round trip through the editor schema', () => {
  it('preserves a paragraph in the stored form', () => {
    expect(roundTrip('<p class="prose-p">Advise the patient to rest.</p>')).toBe(
      '<p class="prose-p">Advise the patient to rest.</p>'
    )
  })

  it('preserves bold, italic, underline, strike and hard breaks', () => {
    expect(roundTrip('<p class="prose-p"><strong>Bold</strong> and <em>italic</em>.</p>')).toBe(
      '<p class="prose-p"><strong>Bold</strong> and <em>italic</em>.</p>'
    )
    expect(roundTrip('<p class="prose-p"><u>underlined</u></p>')).toBe(
      '<p class="prose-p"><u>underlined</u></p>'
    )
    expect(roundTrip('<p class="prose-p"><s>struck</s></p>')).toBe(
      '<p class="prose-p"><s>struck</s></p>'
    )
    expect(roundTrip('<p class="prose-p">line one<br />line two</p>')).toBe(
      '<p class="prose-p">line one<br />line two</p>'
    )
  })

  it('adds the prose-p class to plain paragraphs (delta)', () => {
    expect(roundTrip('<p>No class here.</p>')).toBe('<p class="prose-p">No class here.</p>')
  })

  it('re-serializes hex text colours as rgb() (delta)', () => {
    // The sanitizer stores hex; ProseMirror serializes computed rgb. Any edit
    // therefore rewrites colour values even if the user did not touch them.
    expect(
      roundTrip('<p class="prose-p">If <span style="color: #DA020E;">chest pain</span> call 999.</p>')
    ).toBe(
      '<p class="prose-p">If <span style="color: rgb(218, 2, 14);">chest pain</span> call 999.</p>'
    )
  })

  it('wraps list item content in paragraphs (delta)', () => {
    expect(roundTrip('<ul><li>One</li><li>Two</li></ul>')).toBe(
      '<ul><li><p class="prose-p">One</p></li><li><p class="prose-p">Two</p></li></ul>'
    )
    expect(roundTrip('<ol><li>First</li><li>Second</li></ol>')).toBe(
      '<ol><li><p class="prose-p">First</p></li><li><p class="prose-p">Second</p></li></ol>'
    )
  })

  it('preserves nested lists (with paragraph wrapping)', () => {
    expect(roundTrip('<ul><li>One<ul><li>Sub</li></ul></li></ul>')).toBe(
      '<ul><li><p class="prose-p">One</p><ul><li><p class="prose-p">Sub</p></li></ul></li></ul>'
    )
  })

  it('preserves headings and blockquotes', () => {
    expect(roundTrip('<h2>Heading</h2><p class="prose-p">Body</p>')).toBe(
      '<h2>Heading</h2><p class="prose-p">Body</p>'
    )
    expect(roundTrip('<h1>Big heading</h1>')).toBe('<h1>Big heading</h1>')
    expect(roundTrip('<blockquote><p class="prose-p">quoted</p></blockquote>')).toBe(
      '<blockquote><p class="prose-p">quoted</p></blockquote>'
    )
  })

  it('decorates links with target/rel attributes (delta)', () => {
    expect(roundTrip('<p class="prose-p"><a href="https://nhs.uk">NHS</a></p>')).toBe(
      '<p class="prose-p"><a target="_blank" rel="noopener noreferrer nofollow" href="https://nhs.uk">NHS</a></p>'
    )
  })

  it('drops <mark> highlights — no Highlight extension in the schema (delta)', () => {
    expect(roundTrip('<p class="prose-p"><mark style="background-color: #FFEB3B;">note</mark></p>')).toBe(
      '<p class="prose-p">note</p>'
    )
  })

  it('converts font-weight spans to <strong> and divs to paragraphs (delta)', () => {
    expect(roundTrip('<p class="prose-p"><span style="font-weight: bold;">heavy</span></p>')).toBe(
      '<p class="prose-p"><span><strong>heavy</strong></span></p>'
    )
    expect(roundTrip('<div>div content</div>')).toBe('<p class="prose-p">div content</p>')
  })
})
