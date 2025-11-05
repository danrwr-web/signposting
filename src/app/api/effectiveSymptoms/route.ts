import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { getEffectiveSymptoms } from '@/server/effectiveSymptoms'
import { requireSurgeryAdmin } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

// GET /api/effectiveSymptoms?surgeryId=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const surgeryId = searchParams.get('surgeryId')
    const includeDisabled = searchParams.get('includeDisabled') === '1' || searchParams.get('includeDisabled') === 'true'

    if (!surgeryId) {
      return NextResponse.json(
        { error: 'surgeryId is required' },
        { status: 400 }
      )
    }

    // Check permissions - user must be superuser or admin of this surgery
    await requireSurgeryAdmin(surgeryId)

    const symptoms = await getEffectiveSymptoms(surgeryId, includeDisabled)

    return NextResponse.json({ symptoms })
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error fetching effective symptoms:', error)
    return NextResponse.json(
      { error: 'Failed to fetch symptoms' },
      { status: 500 }
    )
  }
}

