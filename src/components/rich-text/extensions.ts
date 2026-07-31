/**
 * Single source of truth for the rich-text editor schema.
 *
 * Every place that parses or serializes editor HTML must use this list so the
 * schema can't drift between the editor and other conversion sites. The schema
 * must stay within the sanitizer allowlist in `src/lib/sanitizeHtml.ts` —
 * anything the editor can produce that the sanitizer strips is silent data
 * loss on save. That is why Strike (`<s>`) and HorizontalRule (`<hr>`) are
 * disabled: neither tag is in the allowlist.
 *
 * Images are opt-in (`enableImages`): the base sanitizer strips `<img>`, and
 * only `sanitizeAdminToolkitHtml` / `sanitizeSymptomHtml` keep it — and even
 * then only with the matching same-origin serving-route src
 * (`/api/admin-toolkit/images/{id}` or `/api/symptom-images/{id}`).
 * Never enable images for content saved through the base `sanitizeHtml`.
 */
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import { Placeholder } from '@tiptap/extensions'
import type { Extensions } from '@tiptap/core'

// NHS text colour palette shown in the editor toolbar.
export const NHS_TEXT_COLORS = [
  { name: 'NHS Blue', value: '#005EB8' },
  { name: 'NHS Red', value: '#DA020E' },
  { name: 'NHS Orange', value: '#F59E0B' },
  { name: 'NHS Green', value: '#00A499' },
  { name: 'Purple', value: '#6A0DAD' },
  { name: 'Pink', value: '#E5007E' },
  { name: 'Black', value: '#000000' },
] as const

// Soft background tints for the highlight tool — deliberately paler than the
// text colours so highlighted text stays readable.
export const NHS_HIGHLIGHT_COLORS = [
  { name: 'Yellow highlight', value: '#FEF3C7' },
  { name: 'Blue highlight', value: '#DBEAFE' },
  { name: 'Green highlight', value: '#D1FAE5' },
  { name: 'Red highlight', value: '#FEE2E2' },
] as const

export interface RichTextExtensionOptions {
  placeholder?: string
  /** See the header comment before enabling. */
  enableImages?: boolean
}

// Inline (serializes inside <p>, so normalizeHtml needs no block-tag changes)
// with attributes cut down to exactly what the image sanitizers allow.
const InlineImage = Image.extend({
  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
    }
  },
}).configure({ inline: true, allowBase64: false })

export function createRichTextExtensions(options: RichTextExtensionOptions = {}): Extensions {
  return [
    StarterKit.configure({
      heading: {
        levels: [2, 3],
      },
      strike: false,
      horizontalRule: false,
      link: {
        openOnClick: false,
        autolink: true,
      },
    }),
    TextStyle,
    Color.configure({
      types: ['textStyle'],
    }),
    Highlight.configure({
      multicolor: true,
    }),
    ...(options.enableImages ? [InlineImage] : []),
    ...(options.placeholder
      ? [Placeholder.configure({ placeholder: options.placeholder })]
      : []),
  ]
}
