import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/rbac'
import { isDailyDoseAdmin, resolveSurgeryIdForUser } from '@/lib/daily-dose/access'
import { deleteCards } from '@/server/editorial/deleteCards'
import { z } from 'zod'

const BulkDeleteBodyZ = z.object({
  cardIds: z.array(z.string().min(1)).min(1).max(100),
  surgeryId: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const parsed = BulkDeleteBodyZ.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_INPUT',
            message: 'Invalid input: cardIds must be a non-empty array of strings (max 100)',
            details: parsed.error.issues,
          },
        },
        { status: 400 }
      )
    }

    const surgeryIdParam = request.nextUrl.searchParams.get('surgeryId') ?? parsed.data.surgeryId
    const surgeryId = resolveSurgeryIdForUser({ requestedId: surgeryIdParam, user })
    if (!surgeryId || !isDailyDoseAdmin(user, surgeryId)) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Admin access required' } },
        { status: 403 }
      )
    }

    const { deletedCount } = await deleteCards(parsed.data.cardIds, surgeryId)

    return NextResponse.json({ ok: true, deletedCount })
  } catch (error) {
    console.error('POST /api/editorial/cards/bulk-delete error', error)
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
