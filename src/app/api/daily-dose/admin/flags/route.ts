import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'
import { isDailyDoseAdmin, resolveSurgeryIdForUser } from '@/lib/daily-dose/access'
import { DailyDoseSurgeryQueryZ } from '@/lib/daily-dose/schemas'
import { z } from 'zod'

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const query = DailyDoseSurgeryQueryZ.parse({
      surgeryId: request.nextUrl.searchParams.get('surgeryId') ?? undefined,
    })
    const surgeryId = resolveSurgeryIdForUser({ requestedId: query.surgeryId, user })
    if (!surgeryId || !isDailyDoseAdmin(user, surgeryId)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const flags = await prisma.dailyDoseFlaggedContent.findMany({
      where: { surgeryId },
      include: {
        card: { select: { title: true } },
        user: { select: { email: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ flags, surgeryId })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    console.error('GET /api/daily-dose/admin/flags error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
