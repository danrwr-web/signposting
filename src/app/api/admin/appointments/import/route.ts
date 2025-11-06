import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireSurgeryAdmin } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

// Parse duration string like "20 mins" or "10 mins" to integer
function parseDuration(raw: string | null | undefined): number | null {
  if (!raw) return null
  const cleaned = raw.replace(/mins?/i, '').trim()
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

// Pick staff type from Personnel or AppointmentType columns
function pickStaff(row: Record<string, string>): string {
  if (row.Personnel && row.Personnel.trim()) {
    return row.Personnel.trim()
  }
  if (row.AppointmentType && row.AppointmentType.trim()) {
    return row.AppointmentType.trim()
  }
  return 'All'
}

// Simple CSV parser
function parseCSV(csvText: string): Record<string, string>[] {
  const lines = csvText.split('\n').filter(line => line.trim())
  if (lines.length === 0) return []

  // Parse header and filter out columns starting with __
  const allHeaders = parseCSVLine(lines[0])
  const headers = allHeaders.filter(h => !h.startsWith('__'))
  const headerIndices = allHeaders.map((h, i) => headers.includes(h) ? i : -1).filter(i => i !== -1)
  
  const rows: Record<string, string>[] = []

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    if (values.length === 0) continue

    const row: Record<string, string> = {}
    headers.forEach((header, headerIdx) => {
      const valueIdx = headerIndices[headerIdx]
      row[header] = values[valueIdx] || ''
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
        // Escaped quote
        current += '"'
        i++
      } else {
        // Toggle quote state
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  // Add last field
  result.push(current.trim())
  return result
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

    // Check permissions
    const user = await requireSurgeryAdmin(surgeryId)

    // Validate file type
    if (!file.name.endsWith('.csv')) {
      return NextResponse.json(
        { error: 'File must be a CSV file' },
        { status: 400 }
      )
    }

    // Read file content
    const text = await file.text()
    const rows = parseCSV(text)

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'CSV file is empty or invalid' },
        { status: 400 }
      )
    }

    let created = 0
    let updated = 0

    // Process each row
    for (const row of rows) {
      // Skip rows without Appointment Name
      if (!row['Appointment Name'] || !row['Appointment Name'].trim()) {
        continue
      }

      const name = row['Appointment Name'].trim()
      const durationMins = parseDuration(row.Duration)
      const staffType = pickStaff(row)
      const notes = row.Notes?.trim() || null

      // Check if appointment with same name exists for this surgery (idempotent)
      const existing = await prisma.appointmentType.findFirst({
        where: {
          surgeryId,
          name
        }
      })

      if (existing) {
        // Update existing
        await prisma.appointmentType.update({
          where: { id: existing.id },
          data: {
            durationMins,
            staffType,
            notes,
            lastEditedBy: user.email,
            lastEditedAt: new Date()
          }
        })
        updated++
      } else {
        // Create new
        await prisma.appointmentType.create({
          data: {
            surgeryId,
            name,
            durationMins,
            staffType,
            notes,
            isEnabled: true,
            lastEditedBy: user.email
          }
        })
        created++
      }
    }

    return NextResponse.json({
      created,
      updated,
      total: created + updated
    })
  } catch (error) {
    console.error('Error importing appointments:', error)
    
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to import appointments' },
      { status: 500 }
    )
  }
}

