import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSuperuser } from '@/lib/rbac'
import {
  importListSizeRows,
  PracticeDataRefreshError,
  MIN_IMPORT_ROWS,
} from '@/server/practiceListSize'

const uploadSchema = z.object({
  rows: z
    .array(
      z.object({
        odsCode: z.string().trim().min(3).max(12),
        listSize: z.number().int().positive(),
      })
    )
    .min(MIN_IMPORT_ROWS, `A full national file has several thousand practices; refusing to import fewer than ${MIN_IMPORT_ROWS} rows`)
    .max(20000),
  extractDate: z.string().datetime().nullable().optional(),
})

// POST /api/super/practice-data/upload — Replace the list-size cache from an uploaded CSV
export async function POST(request: NextRequest) {
  try {
    await requireSuperuser()

    const body = await request.json()
    const parsed = uploadSchema.safeParse(body)
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Invalid upload payload'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const { count } = await importListSizeRows(parsed.data.rows, {
      extractDate: parsed.data.extractDate ? new Date(parsed.data.extractDate) : null,
      sourceUrl: 'manual-upload',
    })
    return NextResponse.json({ count })
  } catch (error) {
    if (error instanceof PracticeDataRefreshError) {
      return NextResponse.json({ error: error.clientMessage }, { status: 400 })
    }
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
