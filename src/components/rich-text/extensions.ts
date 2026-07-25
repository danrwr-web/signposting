/**
 * Single source of truth for the rich-text editor schema.
 *
 * Every place that parses or serializes editor HTML must use this list so the
 * schema can't drift between the editor and other conversion sites. The schema
 * must stay within the sanitizer allowlist in `src/lib/sanitizeHtml.ts` —
 * anything the editor can produce that the sanitizer strips is silent data
 * loss on save. That is why Strike (`<s>`) and HorizontalRule (`<hr>`) are
 * disabled: neither tag is in the allowlist.
 */
import StarterKit from '@tiptap/starter-kit'
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
}

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
    ...(options.placeholder
      ? [Placeholder.configure({ placeholder: options.placeholder })]
      : []),
  ]
}
