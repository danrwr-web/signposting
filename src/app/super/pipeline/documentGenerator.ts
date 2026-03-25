/**
 * Client-side Word document generation using docx + Packer.toBlob().
 *
 * Takes stored HTML template content, substitutes {{placeholders}} with
 * practice details, converts to professionally styled docx, and triggers
 * a browser download. Runs client-side only — do not import in server
 * components.
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  Header,
  Footer,
  PageNumber,
  NumberFormat,
  ShadingType,
  TableLayoutType,
  VerticalAlign,
  TabStopPosition,
  TabStopType,
} from 'docx'
import { DOCUMENT_TYPE_LABELS, type DocumentType } from './types'

// ── NHS Colours ─────────────────────────────────────────────────────

const NHS_DARK_BLUE = '003087'
const NHS_TEAL = '00A499'
const BODY_GREY = '333333'
const LIGHT_GREY = '666666'

// ── Font sizes (half-points) ────────────────────────────────────────

const SIZE_BODY = 22        // 11pt
const SIZE_H1 = 32          // 16pt
const SIZE_H2 = 26          // 13pt
const SIZE_H3 = 24          // 12pt
const SIZE_SMALL = 18       // 9pt
const SIZE_TITLE = 40        // 20pt
const SIZE_SUBTITLE = 24     // 12pt

const FONT = 'Arial'

// ── Signature block placeholder sentinel ────────────────────────────

const SIGNATURE_PLACEHOLDER = '{{signature_block}}'

// ── Borders ─────────────────────────────────────────────────────────

const TEAL_BOTTOM = {
  bottom: { style: BorderStyle.SINGLE, size: 4, color: NHS_TEAL },
  top: { style: BorderStyle.NONE, size: 0, color: '000000' },
  left: { style: BorderStyle.NONE, size: 0, color: '000000' },
  right: { style: BorderStyle.NONE, size: 0, color: '000000' },
}

const TEAL_TOP = {
  top: { style: BorderStyle.SINGLE, size: 4, color: NHS_TEAL },
  bottom: { style: BorderStyle.NONE, size: 0, color: '000000' },
  left: { style: BorderStyle.NONE, size: 0, color: '000000' },
  right: { style: BorderStyle.NONE, size: 0, color: '000000' },
}

const NO_BORDERS = {
  top: { style: BorderStyle.NONE, size: 0, color: '000000' },
  bottom: { style: BorderStyle.NONE, size: 0, color: '000000' },
  left: { style: BorderStyle.NONE, size: 0, color: '000000' },
  right: { style: BorderStyle.NONE, size: 0, color: '000000' },
}

const SIG_LINE_BORDER = {
  bottom: { style: BorderStyle.SINGLE, size: 2, color: BODY_GREY },
  top: { style: BorderStyle.NONE, size: 0, color: '000000' },
  left: { style: BorderStyle.NONE, size: 0, color: '000000' },
  right: { style: BorderStyle.NONE, size: 0, color: '000000' },
}

// ── Placeholder substitution ────────────────────────────────────────

export interface PracticeDetails {
  practiceName: string
  practiceAddress: string
  contactName: string
  contactRole: string
  contactEmail: string
  listSize: string
  estimatedFee: string
  contractStartDate: string
}

/**
 * Substitute all data placeholders. {{signature_block}} is left intact
 * so it can be detected during HTML-to-docx conversion and replaced
 * with a Table element.
 */
function substitutePlaceholders(html: string, details: PracticeDetails): string {
  const replacements: Record<string, string> = {
    '{{practiceName}}': details.practiceName || '[Practice Name]',
    '{{practiceAddress}}': details.practiceAddress || '[Practice Address]',
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
  // Do NOT substitute {{signature_block}} — it's handled during conversion
  return result
}

// ── CSS colour helper ───────────────────────────────────────────────

function cssColorToHex(color: string): string | undefined {
  if (!color) return undefined
  if (color.startsWith('#')) return color.slice(1).toUpperCase()
  const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
  if (match) {
    const r = parseInt(match[1]).toString(16).padStart(2, '0')
    const g = parseInt(match[2]).toString(16).padStart(2, '0')
    const b = parseInt(match[3]).toString(16).padStart(2, '0')
    return `${r}${g}${b}`.toUpperCase()
  }
  return undefined
}

// ── Logo fetch ──────────────────────────────────────────────────────

let cachedLogoBuffer: ArrayBuffer | null = null
let logoFetchAttempted = false

async function fetchLogoBuffer(): Promise<ArrayBuffer | null> {
  if (logoFetchAttempted) return cachedLogoBuffer
  logoFetchAttempted = true
  try {
    const res = await fetch('/images/signposting_logo_head.png')
    if (!res.ok) return null
    cachedLogoBuffer = await res.arrayBuffer()
    return cachedLogoBuffer
  } catch {
    return null
  }
}

// ── Title block ─────────────────────────────────────────────────────

function buildTitleBlock(
  documentType: DocumentType,
  practiceName: string,
  dateStr: string
): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { type: ShadingType.CLEAR, fill: NHS_DARK_BLUE },
            borders: NO_BORDERS,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                spacing: { before: 300, after: 80 },
                children: [
                  new TextRun({
                    text: DOCUMENT_TYPE_LABELS[documentType],
                    font: FONT,
                    size: SIZE_TITLE,
                    bold: true,
                    color: 'FFFFFF',
                  }),
                ],
              }),
              new Paragraph({
                spacing: { after: 200 },
                children: [
                  new TextRun({
                    text: practiceName,
                    font: FONT,
                    size: SIZE_SUBTITLE,
                    color: NHS_TEAL,
                  }),
                  new TextRun({
                    text: `    ${dateStr}`,
                    font: FONT,
                    size: SIZE_SUBTITLE,
                    color: '8899BB',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  })
}

// ── Page header (with optional logo) ────────────────────────────────

function buildPageHeader(
  documentType: DocumentType,
  logoBuffer: ArrayBuffer | null
): Header {
  const children: (TextRun | ImageRun)[] = []

  if (logoBuffer) {
    children.push(
      new ImageRun({
        data: logoBuffer,
        transformation: { width: 75, height: 25 },
        type: 'png',
      })
    )
    children.push(
      new TextRun({
        text: '   ',
        font: FONT,
        size: SIZE_SMALL,
      })
    )
  }

  children.push(
    new TextRun({
      text: 'Signposting Toolkit',
      font: FONT,
      size: SIZE_SMALL,
      bold: true,
      color: NHS_DARK_BLUE,
    })
  )
  children.push(
    new TextRun({
      text: `  |  ${DOCUMENT_TYPE_LABELS[documentType]}`,
      font: FONT,
      size: SIZE_SMALL,
      color: LIGHT_GREY,
    })
  )

  return new Header({
    children: [
      new Paragraph({
        border: TEAL_BOTTOM,
        spacing: { after: 200 },
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
        children,
      }),
    ],
  })
}

// ── Page footer ─────────────────────────────────────────────────────

function buildPageFooter(): Footer {
  return new Footer({
    children: [
      new Paragraph({
        border: TEAL_TOP,
        spacing: { before: 200 },
        children: [
          new TextRun({
            text: 'contact@signpostingtool.co.uk',
            font: FONT,
            size: SIZE_SMALL,
            color: LIGHT_GREY,
          }),
          new TextRun({
            text: '\t\t',
          }),
          new TextRun({
            text: 'Page ',
            font: FONT,
            size: SIZE_SMALL,
            color: LIGHT_GREY,
          }),
          new TextRun({
            children: [PageNumber.CURRENT],
            font: FONT,
            size: SIZE_SMALL,
            color: LIGHT_GREY,
          }),
        ],
      }),
    ],
  })
}

// ── Signature block ─────────────────────────────────────────────────

function buildSignatureBlock(): Table {
  const sigCell = (party: string): TableCell =>
    new TableCell({
      borders: NO_BORDERS,
      width: { size: 50, type: WidthType.PERCENTAGE },
      children: [
        new Paragraph({
          spacing: { before: 200, after: 80 },
          children: [
            new TextRun({
              text: party,
              font: FONT,
              size: SIZE_H2,
              bold: true,
              color: NHS_DARK_BLUE,
            }),
          ],
        }),
        // Signature line
        new Paragraph({
          spacing: { before: 400, after: 40 },
          border: SIG_LINE_BORDER,
          children: [new TextRun({ text: ' ', font: FONT, size: SIZE_BODY })],
        }),
        new Paragraph({
          children: [new TextRun({ text: 'Signature', font: FONT, size: SIZE_SMALL, color: LIGHT_GREY })],
        }),
        // Name line
        new Paragraph({
          spacing: { before: 300, after: 40 },
          border: SIG_LINE_BORDER,
          children: [new TextRun({ text: ' ', font: FONT, size: SIZE_BODY })],
        }),
        new Paragraph({
          children: [new TextRun({ text: 'Name', font: FONT, size: SIZE_SMALL, color: LIGHT_GREY })],
        }),
        // Date line
        new Paragraph({
          spacing: { before: 300, after: 40 },
          border: SIG_LINE_BORDER,
          children: [new TextRun({ text: ' ', font: FONT, size: SIZE_BODY })],
        }),
        new Paragraph({
          children: [new TextRun({ text: 'Date', font: FONT, size: SIZE_SMALL, color: LIGHT_GREY })],
        }),
      ],
    })

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({
        children: [sigCell('Provider'), sigCell('Practice')],
      }),
    ],
  })
}

// ── HTML to docx body content ───────────────────────────────────────

function htmlToDocxContent(html: string): (Paragraph | Table)[] {
  const content: (Paragraph | Table)[] = []
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

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
            color: color || BODY_GREY,
            font: FONT,
            size: SIZE_BODY,
          }))
        }
        return
      }

      if (node.nodeType !== Node.ELEMENT_NODE) return
      const childEl = node as HTMLElement
      const childTag = childEl.tagName.toLowerCase()

      const isBold = bold || childTag === 'strong' || childTag === 'b'
      const isItalic = italic || childTag === 'em' || childTag === 'i'
      const styleColor = childEl.style?.color
      const effectiveColor = styleColor ? cssColorToHex(styleColor) : color

      if (childTag === 'br') {
        runs.push(new TextRun({ break: 1, font: FONT, size: SIZE_BODY }))
        return
      }

      for (const child of Array.from(childEl.childNodes)) {
        walk(child, isBold, isItalic, effectiveColor)
      }
    }

    walk(el)
    return runs
  }

  // Detect clause heading pattern: text starts with a number+period like "1. "
  function isClauseHeading(el: HTMLElement): boolean {
    const text = el.textContent?.trim() || ''
    return /^\d+\.\s/.test(text)
  }

  // Check if an element's text content contains the signature placeholder
  function containsSignaturePlaceholder(el: HTMLElement): boolean {
    return (el.textContent || '').includes(SIGNATURE_PLACEHOLDER)
  }

  function processNode(node: Node): void {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim()
      if (!text) return
      // Check for signature placeholder in bare text nodes
      if (text.includes(SIGNATURE_PLACEHOLDER)) {
        content.push(buildSignatureBlock())
        return
      }
      content.push(new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun({ text, font: FONT, size: SIZE_BODY, color: BODY_GREY })],
      }))
      return
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return
    const el = node as HTMLElement
    const tag = el.tagName.toLowerCase()

    // If this element contains the signature placeholder, insert the table
    if (containsSignaturePlaceholder(el)) {
      content.push(buildSignatureBlock())
      return
    }

    switch (tag) {
      case 'h1':
        content.push(new Paragraph({
          spacing: { before: 360, after: 120 },
          border: TEAL_BOTTOM,
          children: [new TextRun({
            text: el.textContent || '',
            font: FONT,
            size: SIZE_H1,
            bold: true,
            color: NHS_DARK_BLUE,
          })],
        }))
        break

      case 'h2':
        content.push(new Paragraph({
          spacing: { before: 300, after: 100 },
          border: TEAL_BOTTOM,
          children: [new TextRun({
            text: el.textContent || '',
            font: FONT,
            size: SIZE_H2,
            bold: true,
            color: NHS_DARK_BLUE,
          })],
        }))
        break

      case 'h3':
        content.push(new Paragraph({
          spacing: { before: 240, after: 80 },
          children: [new TextRun({
            text: el.textContent || '',
            font: FONT,
            size: SIZE_H3,
            bold: true,
            color: NHS_DARK_BLUE,
          })],
        }))
        break

      case 'p': {
        if (isClauseHeading(el)) {
          content.push(new Paragraph({
            spacing: { before: 300, after: 100 },
            border: TEAL_BOTTOM,
            children: [new TextRun({
              text: el.textContent || '',
              font: FONT,
              size: SIZE_H2,
              bold: true,
              color: NHS_DARK_BLUE,
            })],
          }))
        } else {
          content.push(new Paragraph({
            spacing: { after: 160 },
            children: getTextRuns(el),
          }))
        }
        break
      }

      case 'blockquote':
        content.push(new Paragraph({
          indent: { left: 720 },
          spacing: { after: 160 },
          children: getTextRuns(el),
        }))
        break

      case 'ul':
      case 'ol': {
        const items = el.querySelectorAll(':scope > li')
        const isOrdered = tag === 'ol'
        items.forEach((li, i) => {
          const prefix = isOrdered ? `${i + 1}. ` : '•  '
          content.push(new Paragraph({
            indent: { left: 480 },
            spacing: { after: 80 },
            children: [
              new TextRun({ text: prefix, font: FONT, size: SIZE_BODY, color: BODY_GREY }),
              ...getTextRuns(li as HTMLElement),
            ],
          }))
        })
        break
      }

      case 'hr':
        content.push(new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' }, top: { style: BorderStyle.NONE, size: 0, color: '000000' }, left: { style: BorderStyle.NONE, size: 0, color: '000000' }, right: { style: BorderStyle.NONE, size: 0, color: '000000' } },
          spacing: { before: 200, after: 200 },
          children: [],
        }))
        break

      case 'br':
        content.push(new Paragraph({ spacing: { after: 80 }, children: [] }))
        break

      default:
        for (const child of Array.from(el.childNodes)) {
          processNode(child)
        }
    }
  }

  for (const child of Array.from(doc.body.childNodes)) {
    processNode(child)
  }

  if (content.length === 0) {
    content.push(new Paragraph({ children: [new TextRun({ text: '', font: FONT })] }))
  }

  return content
}

// ── Public API ──────────────────────────────────────────────────────

export async function generateDocument(
  templateHtml: string,
  documentType: DocumentType,
  details: PracticeDetails,
  variantName: string
): Promise<void> {
  // Fetch logo (cached after first call, fails gracefully)
  const logoBuffer = await fetchLogoBuffer()

  const filledHtml = substitutePlaceholders(templateHtml, details)
  const bodyContent = htmlToDocxContent(filledHtml)

  const docTitle = DOCUMENT_TYPE_LABELS[documentType]
  const dateStr = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  // Build section children: title block + spacer + body (signature block inserted inline via placeholder)
  const children: (Paragraph | Table)[] = [
    buildTitleBlock(documentType, details.practiceName || '[Practice Name]', dateStr),
    new Paragraph({ spacing: { before: 400, after: 200 }, children: [] }),
    ...bodyContent,
  ]

  const doc = new Document({
    creator: 'Signposting Toolkit',
    title: `${docTitle} — ${details.practiceName}`,
    description: `Generated from ${variantName} template`,
    styles: {
      default: {
        document: {
          run: {
            font: FONT,
            size: SIZE_BODY,
            color: BODY_GREY,
          },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: {
            top: 1440,
            right: 1440,
            bottom: 1440,
            left: 1440,
          },
          pageNumbers: {
            start: 1,
            formatType: NumberFormat.DECIMAL,
          },
        },
      },
      headers: {
        default: buildPageHeader(documentType, logoBuffer),
      },
      footers: {
        default: buildPageFooter(),
      },
      children,
    }],
  })

  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${docTitle} - ${details.practiceName || 'Practice'}.docx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
