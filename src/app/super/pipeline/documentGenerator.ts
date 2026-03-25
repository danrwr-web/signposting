/**
 * Client-side Word document generation using docx + Packer.toBlob().
 *
 * Takes stored HTML template content, substitutes {{placeholders}} with
 * practice details, converts to docx paragraphs, and triggers a browser
 * download.
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from 'docx'
import { DOCUMENT_TYPE_LABELS, type DocumentType } from './types'

// ── Placeholder substitution ────────────────────────────────────────

interface PracticeDetails {
  practiceName: string
  contactName: string
  contactRole: string
  contactEmail: string
  listSize: string
  estimatedFee: string
  contractStartDate: string
}

function substitutePlaceholders(html: string, details: PracticeDetails): string {
  const replacements: Record<string, string> = {
    '{{practiceName}}': details.practiceName || '[Practice Name]',
    '{{contactName}}': details.contactName || '[Contact Name]',
    '{{contactRole}}': details.contactRole || '[Contact Role]',
    '{{contactEmail}}': details.contactEmail || '[Contact Email]',
    '{{listSize}}': details.listSize || '[List Size]',
    '{{estimatedFee}}': details.estimatedFee || '[Estimated Fee]',
    '{{contractStartDate}}': details.contractStartDate || '[Contract Start Date]',
  }

  let result = html
  for (const [placeholder, value] of Object.entries(replacements)) {
    result = result.split(placeholder).join(value)
  }
  return result
}

// ── HTML to docx conversion ─────────────────────────────────────────

/**
 * Simple HTML-to-docx paragraph converter.
 * Handles: <p>, <h1>–<h3>, <strong>, <em>, <br>, <ul>/<ol>/<li>,
 * and plain text nodes. Strips remaining tags gracefully.
 */
function htmlToDocxParagraphs(html: string): Paragraph[] {
  const paragraphs: Paragraph[] = []

  // Parse with DOMParser (available in browser)
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  function processNode(node: Node, listLevel?: number): void {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim()
      if (text) {
        paragraphs.push(new Paragraph({ children: [new TextRun(text)] }))
      }
      return
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return
    const el = node as HTMLElement
    const tag = el.tagName.toLowerCase()

    switch (tag) {
      case 'h1':
        paragraphs.push(new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: getTextRuns(el),
        }))
        break

      case 'h2':
        paragraphs.push(new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: getTextRuns(el),
        }))
        break

      case 'h3':
        paragraphs.push(new Paragraph({
          heading: HeadingLevel.HEADING_3,
          children: getTextRuns(el),
        }))
        break

      case 'p':
        paragraphs.push(new Paragraph({
          children: getTextRuns(el),
        }))
        break

      case 'blockquote':
        paragraphs.push(new Paragraph({
          indent: { left: 720 },
          children: getTextRuns(el),
        }))
        break

      case 'ul':
      case 'ol': {
        const items = el.querySelectorAll(':scope > li')
        const isOrdered = tag === 'ol'
        items.forEach((li, i) => {
          const prefix = isOrdered ? `${i + 1}. ` : '• '
          paragraphs.push(new Paragraph({
            indent: { left: 720 * ((listLevel ?? 0) + 1) },
            children: [
              new TextRun(prefix),
              ...getTextRuns(li as HTMLElement),
            ],
          }))
        })
        break
      }

      case 'br':
        paragraphs.push(new Paragraph({ children: [] }))
        break

      case 'hr':
        paragraphs.push(new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: '———', color: '999999' })],
        }))
        break

      default:
        // Recurse into other elements (div, span, etc.)
        for (const child of Array.from(el.childNodes)) {
          processNode(child, listLevel)
        }
    }
  }

  function getTextRuns(el: HTMLElement): TextRun[] {
    const runs: TextRun[] = []

    function walk(node: Node, bold = false, italic = false, color?: string): void {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || ''
        if (text) {
          runs.push(new TextRun({
            text,
            bold: bold || undefined,
            italics: italic || undefined,
            color: color || undefined,
            size: 24, // 12pt
          }))
        }
        return
      }

      if (node.nodeType !== Node.ELEMENT_NODE) return
      const childEl = node as HTMLElement
      const childTag = childEl.tagName.toLowerCase()

      const isBold = bold || childTag === 'strong' || childTag === 'b'
      const isItalic = italic || childTag === 'em' || childTag === 'i'

      // Pick up inline color from style attribute
      const styleColor = childEl.style?.color
      const effectiveColor = styleColor ? cssColorToHex(styleColor) : color

      if (childTag === 'br') {
        runs.push(new TextRun({ break: 1 }))
        return
      }

      for (const child of Array.from(childEl.childNodes)) {
        walk(child, isBold, isItalic, effectiveColor)
      }
    }

    walk(el)
    return runs
  }

  // Process body children
  for (const child of Array.from(doc.body.childNodes)) {
    processNode(child)
  }

  // Ensure at least one paragraph
  if (paragraphs.length === 0) {
    paragraphs.push(new Paragraph({ children: [new TextRun('')] }))
  }

  return paragraphs
}

/** Convert CSS color values to hex (strip # prefix for docx) */
function cssColorToHex(color: string): string | undefined {
  if (!color) return undefined
  // Already hex
  if (color.startsWith('#')) return color.slice(1).toUpperCase()
  // rgb(r, g, b)
  const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
  if (match) {
    const r = parseInt(match[1]).toString(16).padStart(2, '0')
    const g = parseInt(match[2]).toString(16).padStart(2, '0')
    const b = parseInt(match[3]).toString(16).padStart(2, '0')
    return `${r}${g}${b}`.toUpperCase()
  }
  return undefined
}

// ── Public API ──────────────────────────────────────────────────────

export async function generateDocument(
  templateHtml: string,
  documentType: DocumentType,
  details: PracticeDetails,
  variantName: string
): Promise<void> {
  // Substitute placeholders
  const filledHtml = substitutePlaceholders(templateHtml, details)

  // Convert to docx paragraphs
  const paragraphs = htmlToDocxParagraphs(filledHtml)

  // Build document
  const doc = new Document({
    creator: 'Signposting Toolkit',
    title: `${DOCUMENT_TYPE_LABELS[documentType]} — ${details.practiceName}`,
    description: `Generated from ${variantName} template`,
    sections: [{
      properties: {},
      children: paragraphs,
    }],
  })

  // Generate blob and download
  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${DOCUMENT_TYPE_LABELS[documentType]} - ${details.practiceName}.docx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
