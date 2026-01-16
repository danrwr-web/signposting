import 'server-only'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'
import { isDailyDoseAdmin, resolveSurgeryIdForUser } from '@/lib/daily-dose/access'
import { DailyDoseSurgeryQueryZ } from '@/lib/daily-dose/schemas'
import { z } from 'zod'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { id } = await params
    const url = new URL(request.url)
    const query = DailyDoseSurgeryQueryZ.parse({
      surgeryId: url.searchParams.get('surgeryId') ?? undefined,
    })
    const surgeryId = resolveSurgeryIdForUser({ requestedId: query.surgeryId, user })
    if (!surgeryId || !isDailyDoseAdmin(user, surgeryId)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const flag = await prisma.dailyDoseFlaggedContent.findUnique({ where: { id } })
    if (!flag || flag.surgeryId !== surgeryId) {
      return NextResponse.json({ error: 'Flag not found' }, { status: 404 })
    }

    const updated = await prisma.dailyDoseFlaggedContent.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        resolvedBy: user.id,
        resolvedAt: new Date(),
      },
    })

    return NextResponse.json({ flag: updated })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    console.error('POST /api/daily-dose/admin/flags/[id]/resolve error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
