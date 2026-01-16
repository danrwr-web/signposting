import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'
import { isDailyDoseAdmin, resolveSurgeryIdForUser } from '@/lib/daily-dose/access'
import { DailyDoseCardInputZ, DailyDoseSurgeryQueryZ } from '@/lib/daily-dose/schemas'
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

    const statusFilter = request.nextUrl.searchParams.get('status') ?? undefined
    const cards = await prisma.dailyDoseCard.findMany({
      where: {
        OR: [{ surgeryId }, { surgeryId: null }],
        ...(statusFilter ? { status: statusFilter } : {}),
      },
      include: { topic: true },
      orderBy: { updatedAt: 'desc' },
    })

    return NextResponse.json({ cards, surgeryId })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    console.error('GET /api/daily-dose/admin/cards error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = DailyDoseCardInputZ.parse(body)
    const query = DailyDoseSurgeryQueryZ.parse({
      surgeryId: request.nextUrl.searchParams.get('surgeryId') ?? body?.surgeryId,
    })
    const surgeryId = resolveSurgeryIdForUser({ requestedId: query.surgeryId, user })
    if (!surgeryId || !isDailyDoseAdmin(user, surgeryId)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const card = await prisma.dailyDoseCard.create({
      data: {
        surgeryId,
        title: parsed.title.trim(),
        topicId: parsed.topicId,
        roleScope: parsed.roleScope,
        contentBlocks: parsed.contentBlocks,
        sources: parsed.sources,
        reviewByDate: parsed.reviewByDate ? new Date(parsed.reviewByDate) : null,
        tags: parsed.tags ?? [],
        status: parsed.status ?? 'DRAFT',
        createdBy: user.id,
      },
      include: { topic: true },
    })

    return NextResponse.json({ card }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    console.error('POST /api/daily-dose/admin/cards error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
