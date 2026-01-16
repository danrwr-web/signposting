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

    const existing = await prisma.dailyDoseCard.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 })
    }

    if (existing.surgeryId && existing.surgeryId !== surgeryId) {
      return NextResponse.json({ error: 'Card does not belong to this surgery' }, { status: 403 })
    }

    if (!existing.surgeryId && user.globalRole !== 'SUPERUSER') {
      return NextResponse.json({ error: 'Superuser access required' }, { status: 403 })
    }

    if (existing.status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Card must be approved before publishing' },
        { status: 409 }
      )
    }

    const now = new Date()
    const nextVersion = existing.version + 1

    const snapshot = {
      title: existing.title,
      roleScope: existing.roleScope,
      topicId: existing.topicId,
      contentBlocks: existing.contentBlocks,
      sources: existing.sources,
      reviewByDate: existing.reviewByDate,
      tags: existing.tags,
    }

    const card = await prisma.$transaction(async (tx) => {
      await tx.dailyDoseCardVersion.create({
        data: {
          cardId: existing.id,
          version: nextVersion,
          snapshot,
          publishedAt: now,
          createdBy: user.id,
        },
      })

      return tx.dailyDoseCard.update({
        where: { id: existing.id },
        data: {
          status: 'PUBLISHED',
          version: nextVersion,
          approvedBy: existing.approvedBy ?? user.id,
          approvedAt: existing.approvedAt ?? now,
        },
      })
    })

    return NextResponse.json({ card })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    console.error('POST /api/daily-dose/admin/cards/[id]/publish error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
