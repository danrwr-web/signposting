// Parser for the NHS Digital "Patients Registered at a GP Practice" CSV
// (gp-reg-pat-prac-all.csv). Isomorphic: used by the server-side automatic
// refresh and the client-side upload fallback in the Practice Data tab.

export interface ListSizeRow {
  odsCode: string
  listSize: number
}

export interface ParsedListSizeCsv {
  rows: ListSizeRow[]
  extractDate: Date | null
  skipped: number
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

function stripQuotes(cell: string): string {
  const trimmed = cell.trim()
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
    return trimmed.slice(1, -1).trim()
  }
  return trimmed
}

function splitCsvLine(line: string): string[] {
  return line.split(',').map(stripQuotes)
}

/** Supports DDMONYYYY (01JUL2026), YYYY-MM-DD, and DD/MM/YYYY. Null when unparseable. */
export function parseExtractDate(value: string): Date | null {
  const v = value.trim().toUpperCase()

  const ddMonYyyy = v.match(/^(\d{2})([A-Z]{3})(\d{4})$/)
  if (ddMonYyyy) {
    const month = MONTHS.indexOf(ddMonYyyy[2])
    if (month >= 0) {
      const date = new Date(Date.UTC(parseInt(ddMonYyyy[3], 10), month, parseInt(ddMonYyyy[1], 10)))
      return isNaN(date.getTime()) ? null : date
    }
    return null
  }

  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) {
    const date = new Date(Date.UTC(parseInt(iso[1], 10), parseInt(iso[2], 10) - 1, parseInt(iso[3], 10)))
    return isNaN(date.getTime()) ? null : date
  }

  const dmy = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (dmy) {
    const date = new Date(Date.UTC(parseInt(dmy[3], 10), parseInt(dmy[2], 10) - 1, parseInt(dmy[1], 10)))
    return isNaN(date.getTime()) ? null : date
  }

  return null
}

export function parseListSizeCsv(text: string): ParsedListSizeCsv {
  const lines = text.split(/\r?\n/)

  // The header row may not be the first line; find the first line with the required columns.
  let headerIndex = -1
  let headers: string[] = []
  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    const cells = splitCsvLine(lines[i]).map((c) => c.toUpperCase())
    if (cells.includes('CODE') && cells.includes('NUMBER_OF_PATIENTS')) {
      headerIndex = i
      headers = cells
      break
    }
  }
  if (headerIndex === -1) {
    throw new Error(
      'CSV header row not found: expected columns CODE and NUMBER_OF_PATIENTS. Is this the gp-reg-pat-prac-all.csv file?'
    )
  }

  const codeIdx = headers.indexOf('CODE')
  const patientsIdx = headers.indexOf('NUMBER_OF_PATIENTS')
  const sexIdx = headers.indexOf('SEX')
  const ageIdx = headers.indexOf('AGE')
  const extractDateIdx = headers.indexOf('EXTRACT_DATE')

  const byCode = new Map<string, number>()
  let extractDate: Date | null = null
  let skipped = 0

  for (let i = headerIndex + 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    const cells = splitCsvLine(lines[i])

    // Guard against being fed an age/sex-banded file: only all-ages rows count.
    if (sexIdx >= 0 && (cells[sexIdx] ?? '').toUpperCase() !== 'ALL') continue
    if (ageIdx >= 0 && (cells[ageIdx] ?? '').toUpperCase() !== 'ALL') continue

    const odsCode = (cells[codeIdx] ?? '').toUpperCase()
    const listSize = parseInt(cells[patientsIdx] ?? '', 10)
    if (!odsCode || !Number.isInteger(listSize) || listSize <= 0) {
      skipped++
      continue
    }

    if (extractDate === null && extractDateIdx >= 0 && cells[extractDateIdx]) {
      extractDate = parseExtractDate(cells[extractDateIdx])
    }

    byCode.set(odsCode, listSize)
  }

  return {
    rows: Array.from(byCode.entries()).map(([odsCode, listSize]) => ({ odsCode, listSize })),
    extractDate,
    skipped,
  }
}
