/**
 * Normalizes stored content before hydrating the editor.
 *
 * Content arrives in two shapes: HTML (`instructionsHtml`, the canonical
 * format) and legacy plain text (`instructions` fallback). HTML must pass
 * through untouched — wrapping block-level markup in a paragraph corrupts the
 * document — while plain text needs paragraph structure to edit naturally.
 */
const BLOCK_TAG_RE = /<(p|ul|ol|h[1-6]|blockquote|pre|div|li)\b/i

export function normalizeHtml(content: string): string {
  if (!content || typeof content !== 'string') return ''

  // Any block-level tag means the content is already structured HTML.
  if (BLOCK_TAG_RE.test(content)) return content

  // Legacy plain text: one paragraph per non-empty line.
  if (content.includes('\n')) {
    const paragraphs = content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => `<p>${line}</p>`)
      .join('')
    return paragraphs || '<p></p>'
  }

  return `<p>${content}</p>`
}

/**
 * Cleans HTML pasted from Word, Outlook or Google Docs before it reaches the
 * editor: strips Office markup and unwraps Google's bold wrapper, and converts
 * presentational tags to their semantic equivalents so the sanitizer (which
 * only allows `<strong>`/`<em>`) doesn't silently drop formatting.
 */
export function cleanPastedHtml(html: string): string {
  if (!html || typeof html !== 'string') return ''

  let out = html
    // HTML comments, including Word's conditional blocks.
    .replace(/<!--[\s\S]*?-->/g, '')
    // Embedded style/xml blocks Word includes in clipboard HTML.
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<xml[\s\S]*?<\/xml>/gi, '')
    // Office namespaced tags such as <o:p> and <w:sdt>.
    .replace(/<\/?[ovw]:[^>]*>/gi, '')
    // Word's Mso* classes.
    .replace(/\s?class="?Mso[\w-]*"?/gi, '')
    // mso-* style declarations.
    .replace(/mso-[\w-]+\s*:[^;"']*;?/gi, '')

  // Google Docs wraps the whole clipboard in <b style="font-weight:normal">,
  // which is not actually bold. Turn it into a span; its orphaned </b> is
  // dropped during sanitization.
  out = out.replace(/<b(\s[^>]*font-weight:\s*normal[^>]*)>/gi, '<span$1>')

  // Presentational → semantic, so the sanitizer allowlist keeps the formatting.
  out = out
    .replace(/<b(\s[^>]*)?>/gi, '<strong$1>')
    .replace(/<\/b>/gi, '</strong>')
    .replace(/<i(\s[^>]*)?>/gi, '<em$1>')
    .replace(/<\/i>/gi, '</em>')

  return out
}
