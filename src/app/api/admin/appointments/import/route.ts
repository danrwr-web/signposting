import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireSurgeryAdmin } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

interface ParsedAppointmentRow {
  name: string
  durationMins: number | null
  staffType: string
  notes: string | null
}

interface RowIssue {
  row: number
  reason: string
}

// Parse duration string like "20 mins" or "10 minutes" to integer minutes
export function parseDuration(raw: string | null | undefined): number | null {
  if (!raw) return null
  const cleaned = raw.replace(/minutes?|mins?/i, '').trim()
  if (!cleaned) return null
  const value = Number(cleaned)
  return Number.isFinite(value) && value > 0 ? value : null
}

// Pick staff type from Personnel or AppointmentType columns
export function pickStaff(row: Record<string, string>): string {
  const personnel = row.Personnel?.trim()
  if (personnel) {
    return personnel
  }
  const appointmentType = row.AppointmentType?.trim()
  if (appointmentType) {
    return appointmentType
  }
  const staffType = row['Staff Type']?.trim()
  if (staffType) {
    return staffType
  }
  return 'All'
}

function normaliseHeader(header: string): string {
  return header.replace(/^\uFEFF/, '').trim()
}

// Simple CSV parser
export function parseCSV(csvText: string): Record<string, string>[] {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim())
  if (lines.length === 0) return []

  const allHeaders = parseCSVLine(lines[0]).map(normaliseHeader)
  const headers = allHeaders.filter((header) => !header.startsWith('__') && header.length > 0)

  if (!headers.includes('Appointment Name')) {
    throw new Error('CSV is missing "Appointment Name" column')
  }

  const headerIndices = headers.map((header) => allHeaders.indexOf(header))

  const rows: Record<string, string>[] = []

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex++) {
    const values = parseCSVLine(lines[lineIndex])
    if (values.length === 0) continue

    const row: Record<string, string> = {}
    headers.forEach((header, headerIdx) => {
      const valueIdx = headerIndices[headerIdx]
      const value = values[valueIdx] ?? ''
      row[header] = value.trim()
    })
    rows.push(row)
  }

  return rows
}

// Parse a single CSV line, handling quoted fields
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const nextChar = line[i + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }

  result.push(current)
  return result
}

export function sanitiseRows(rows: Record<string, string>[]): {
  valid: ParsedAppointmentRow[]
  issues: RowIssue[]
} {
  const issues: RowIssue[] = []
  const seenNames = new Map<string, number>()
  const valid: ParsedAppointmentRow[] = []

  rows.forEach((row, index) => {
    const rowNumber = index + 2 // include header row
    const nameRaw = row['Appointment Name']?.trim() ?? ''

    if (!nameRaw) {
      issues.push({ row: rowNumber, reason: 'Missing appointment name' })
      return
    }

    if (nameRaw.startsWith(',')) {
      issues.push({ row: rowNumber, reason: 'Name begins with a comma and looks invalid' })
      return
    }

    if (/^[0-9a-f-]{20,}$/i.test(nameRaw)) {
      issues.push({ row: rowNumber, reason: 'Name looks like an ID rather than a label' })
      return
    }

    const hasContent = Object.entries(row).some(
      ([key, value]) => !key.startsWith('__') && value.trim() !== ''
    )

    if (!hasContent) {
      issues.push({ row: rowNumber, reason: 'Row is empty' })
      return
    }

    if (seenNames.has(nameRaw.toLowerCase())) {
      const originalRow = seenNames.get(nameRaw.toLowerCase()) ?? rowNumber
      issues.push({
        row: rowNumber,
        reason: `Duplicate appointment name (already seen on row ${originalRow})`
      })
      return
    }

    seenNames.set(nameRaw.toLowerCase(), rowNumber)

    valid.push({
      name: nameRaw,
      durationMins: parseDuration(row.Duration),
      staffType: pickStaff(row),
      notes: row.Notes?.trim() ? row.Notes.trim() : null
    })
  })

  return { valid, issues }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const surgeryId = formData.get('surgeryId') as string

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    if (!surgeryId) {
      return NextResponse.json(
        { error: 'surgeryId parameter required' },
        { status: 400 }
      )
    }

    const user = await requireSurgeryAdmin(surgeryId)

    if (!file.name.endsWith('.csv')) {
      return NextResponse.json(
        { error: 'File must be a CSV file' },
        { status: 400 }
      )
    }

    const text = await file.text()
    const rows = parseCSV(text)

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'CSV file is empty or invalid' },
        { status: 400 }
      )
    }

    const { valid, issues } = sanitiseRows(rows)

    if (valid.length === 0) {
      return NextResponse.json(
        {
          error: 'No valid appointments found in CSV',
          issues
        },
        { status: 400 }
      )
    }

    let created = 0
    let updated = 0

    await prisma.$transaction(async (tx) => {
      const existingAppointments = await tx.appointmentType.findMany({
        where: {
          surgeryId,
          name: {
            in: valid.map((row) => row.name)
          }
        },
        select: {
          id: true,
          name: true
        }
      })

      const existingMap = new Map(
        existingAppointments.map((appointment) => [appointment.name.toLowerCase(), appointment])
      )

      for (const row of valid) {
        const existing = existingMap.get(row.name.toLowerCase())
        if (existing) {
          await tx.appointmentType.update({
            where: { id: existing.id },
            data: {
              durationMins: row.durationMins,
              staffType: row.staffType,
              notes: row.notes,
              lastEditedBy: user.email,
              lastEditedAt: new Date()
            }
          })
          updated++
        } else {
          const createdAppointment = await tx.appointmentType.create({
            data: {
              surgeryId,
              name: row.name,
              durationMins: row.durationMins,
              staffType: row.staffType,
              notes: row.notes,
              isEnabled: true,
              lastEditedBy: user.email
            }
          })
          existingMap.set(createdAppointment.name.toLowerCase(), createdAppointment)
          created++
        }
      }
    })

    return NextResponse.json({
      created,
      updated,
      total: created + updated,
      skipped: issues.length,
      issues
    })
  } catch (error) {
    console.error('Error importing appointments:', error)

    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      )
    }

    if (error instanceof Error && error.message.includes('missing')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to import appointments' },
      { status: 500 }
    )
  }
}

