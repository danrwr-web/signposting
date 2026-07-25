/**
 * Single source of truth for the rich-text editor schema.
 *
 * Every place that parses or serializes editor HTML must use this list so the
 * schema can't drift between the editor and other conversion sites. The schema
 * must stay within the sanitizer allowlist in `src/lib/sanitizeHtml.ts` —
 * anything the editor can produce that the sanitizer strips is silent data
 * loss on save.
 */
import StarterKit from '@tiptap/starter-kit'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
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

export function createRichTextExtensions(): Extensions {
  return [
    StarterKit.configure({
      paragraph: {
        HTMLAttributes: {
          class: 'prose-p',
        },
      },
    }),
    TextStyle,
    Color.configure({
      types: ['textStyle'],
    }),
  ]
}
