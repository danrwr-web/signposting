import 'server-only'

/**
 * Inline-image preservation for AI rewrite flows.
 *
 * The AI routes rewrite instruction HTML, and models reliably drop tags they
 * were not asked to produce — so an <img> in the source would vanish from the
 * suggestion. Instead of hoping the model echoes the tag, we swap each image
 * for a short placeholder token before the call and substitute the original
 * tags back into the output. Any placeholder the model dropped anyway is
 * appended at the end, so an image can never be lost by an AI rewrite.
 */

const IMG_TAG_RE = /<img\b[^>]*\/?>/gi
const PLACEHOLDER_RE = /\[\[IMAGE_(\d+)\]\]/g

export interface StashedImages {
  html: string
  images: string[]
}

/** Replace each <img> tag with a [[IMAGE_n]] placeholder token. */
export function stashInlineImages(html: string): StashedImages {
  const images: string[] = []
  const stashed = html.replace(IMG_TAG_RE, (tag) => {
    images.push(tag)
    return `[[IMAGE_${images.length}]]`
  })
  return { html: stashed, images }
}

/**
 * Substitute the original <img> tags back for their placeholders. Unknown or
 * duplicated placeholders are removed; placeholders the model dropped have
 * their images appended at the end so nothing is lost.
 */
export function restoreInlineImages(html: string, images: string[]): string {
  if (images.length === 0) return html
  const used = new Set<number>()
  let restored = html.replace(PLACEHOLDER_RE, (_match, num: string) => {
    const index = parseInt(num, 10) - 1
    if (index >= 0 && index < images.length && !used.has(index)) {
      used.add(index)
      return images[index]
    }
    return ''
  })
  const missing = images.filter((_, index) => !used.has(index))
  if (missing.length > 0) {
    restored = `${restored}\n<p>${missing.join(' ')}</p>`
  }
  return restored
}

/**
 * Prompt rule accompanying stashed content. Only include it when images were
 * actually stashed, so image-free prompts stay unchanged.
 */
export const IMAGE_PLACEHOLDER_PROMPT_RULE =
  'The text contains image placeholders that look like [[IMAGE_1]]. Each one stands for an image that must be kept: ' +
  'keep every placeholder exactly as written, positioned where it best fits the rewritten text. ' +
  'Do NOT remove, rename, duplicate or describe the placeholders.'
