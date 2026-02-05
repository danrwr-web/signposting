import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'
import { isDailyDoseAdmin, resolveSurgeryIdForUser } from '@/lib/daily-dose/access'
import { DailyDoseCardUpdateZ, DailyDoseSurgeryQueryZ } from '@/lib/daily-dose/schemas'
import { z } from 'zod'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { id } = await params
    const query = DailyDoseSurgeryQueryZ.parse({
      surgeryId: request.nextUrl.searchParams.get('surgeryId') ?? undefined,
    })
    const surgeryId = resolveSurgeryIdForUser({ requestedId: query.surgeryId, user })
    if (!surgeryId || !isDailyDoseAdmin(user, surgeryId)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const card = await prisma.dailyDoseCard.findFirst({
      where: {
        id,
        OR: [{ surgeryId }, { surgeryId: null }],
      },
      include: { topic: true, versions: true },
    })

    if (!card) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 })
    }

    return NextResponse.json({ card })
  } catch (error) {
    console.error('GET /api/daily-dose/admin/cards/[id] error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const parsed = DailyDoseCardUpdateZ.parse(body)
    const query = DailyDoseSurgeryQueryZ.parse({
      surgeryId: request.nextUrl.searchParams.get('surgeryId') ?? body?.surgeryId,
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

    if (parsed.status === 'PUBLISHED') {
      return NextResponse.json(
        { error: 'Use the publish endpoint to publish cards' },
        { status: 400 }
      )
    }

    const isApproving = parsed.status === 'APPROVED' && existing.status !== 'APPROVED'
    const isRevertingApproval =
      existing.status === 'APPROVED' && parsed.status && parsed.status !== 'APPROVED'
    const reviewByDate =
      parsed.reviewByDate === null
        ? null
        : parsed.reviewByDate
          ? new Date(parsed.reviewByDate)
          : existing.reviewByDate

    const card = await prisma.dailyDoseCard.update({
      where: { id },
      data: {
        title: parsed.title?.trim() ?? existing.title,
        topicId: parsed.topicId ?? existing.topicId,
        roleScope: parsed.roleScope ?? existing.roleScope,
        contentBlocks: parsed.contentBlocks ?? existing.contentBlocks,
        sources: parsed.sources ?? existing.sources,
        reviewByDate,
        tags: parsed.tags ?? existing.tags,
        status: parsed.status ?? existing.status,
        isActive: parsed.isActive ?? existing.isActive,
        approvedBy: isApproving ? user.id : isRevertingApproval ? null : existing.approvedBy,
        approvedAt: isApproving ? new Date() : isRevertingApproval ? null : existing.approvedAt,
      },
      include: { topic: true },
    })

    return NextResponse.json({ card })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    console.error('PUT /api/daily-dose/admin/cards/[id] error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { id } = await params
    const query = DailyDoseSurgeryQueryZ.parse({
      surgeryId: request.nextUrl.searchParams.get('surgeryId') ?? undefined,
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

    const card = await prisma.dailyDoseCard.update({
      where: { id },
      data: {
        status: 'RETIRED',
      },
    })

    return NextResponse.json({ card })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    console.error('DELETE /api/daily-dose/admin/cards/[id] error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
