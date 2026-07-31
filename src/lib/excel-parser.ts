import * as XLSX from 'xlsx'

export interface ExcelSymptomRow {
  Symptom?: string
  AgeGroup?: string
  BriefInstruction?: string
  Instructions?: string
  HighlightedText?: string
  LinkToPage?: string
  CustomID?: string
  __PowerAppsId__?: string
}

export interface ParsedSymptom {
  slug: string
  name: string
  ageGroup: string
  briefInstruction: string
  instructions: string
  highlightedText?: string
  linkToPage?: string
  linkToPages?: string[]
}

export function parseExcelFile(buffer: Buffer): ParsedSymptom[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  
  // Convert to JSON with header row
  const data: ExcelSymptomRow[] = XLSX.utils.sheet_to_json(worksheet, { 
    header: 0,
    defval: ''
  })

  const symptoms: ParsedSymptom[] = []

  for (const row of data) {
    // Skip empty rows - BriefInstruction can be empty, but Symptom and Instructions are required
    if (!row.Symptom || !row.Instructions) {
      continue
    }

    // Related-symptom links: semicolon-separated names (symptom names can
    // legitimately contain commas, e.g. "Coughs, colds and flu").
    const parsedLinks = row.LinkToPage
      ? row.LinkToPage.split(';').map(l => l.trim()).filter(l => l !== '')
      : []
    const linkToPages = parsedLinks.length > 0 ? parsedLinks : undefined
    // Generate slug from symptom name
    const slug = row.Symptom.trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()

    symptoms.push({
      slug,
      name: row.Symptom.trim(),
      ageGroup: normalizeAgeGroup(row.AgeGroup?.trim() || 'Adult'),
      briefInstruction: row.BriefInstruction?.trim() || '',
      instructions: row.Instructions.trim(),
      highlightedText: row.HighlightedText?.trim() || undefined,
      linkToPage: linkToPages?.[0],
      linkToPages,
    })
  }

  return symptoms
}

export function normalizeAgeGroup(ageGroup: string): string {
  const normalized = ageGroup.toLowerCase().trim()
  
  if (normalized.includes('under') || normalized.includes('u5')) {
    return 'U5'
  } else if (normalized.includes('over') || normalized.includes('o5')) {
    return 'O5'
  } else if (normalized.includes('adult')) {
    return 'Adult'
  }
  
  return ageGroup // Return original if no match
}
