import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'
import { isDailyDoseAdmin, resolveSurgeryIdForUser } from '@/lib/daily-dose/access'
import { EditorialCardUpdateZ } from '@/lib/schemas/editorial'
import { inferRiskLevel, resolveNeedsSourcing } from '@/lib/editorial/guards'
import { z } from 'zod'

interface RouteParams {
  params: Promise<{ cardId: string }>
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    const { cardId } = await params
    const body = await request.json()
    const parsed = EditorialCardUpdateZ.parse(body)
    const surgeryIdParam = request.nextUrl.searchParams.get('surgeryId') ?? body?.surgeryId
    const surgeryId = resolveSurgeryIdForUser({ requestedId: surgeryIdParam, user })
    if (!surgeryId || !isDailyDoseAdmin(user, surgeryId)) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Admin access required' } },
        { status: 403 }
      )
    }

    const card = await prisma.dailyDoseCard.findFirst({
      where: { id: cardId, surgeryId },
    })
    if (!card) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Card not found' } },
        { status: 404 }
      )
    }

    const reviewByDate = parsed.reviewByDate ? new Date(parsed.reviewByDate) : null
    if (parsed.reviewByDate && Number.isNaN(reviewByDate?.getTime())) {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message: 'Review by date is invalid' } },
        { status: 400 }
      )
    }

    const combined = JSON.stringify({
      title: parsed.title,
      contentBlocks: parsed.contentBlocks,
      interactions: parsed.interactions,
      slotLanguage: parsed.slotLanguage,
      safetyNetting: parsed.safetyNetting,
    })
    const inferredRisk = inferRiskLevel(combined)
    const riskLevel = inferredRisk === 'HIGH' ? 'HIGH' : parsed.riskLevel
    const needsSourcing = resolveNeedsSourcing(parsed.sources, parsed.needsSourcing)

    // Ensure clinicianApproved is always a boolean
    const clinicianApproved =
      riskLevel === 'HIGH' &&
      parsed.clinicianApproved === true &&
      parsed.clinicianApprovedBy &&
      parsed.clinicianApprovedBy.trim() !== ''

    const updated = await prisma.dailyDoseCard.update({
      where: { id: card.id },
      data: {
        title: parsed.title,
        targetRole: parsed.targetRole,
        roleScope: [parsed.targetRole],
        estimatedTimeMinutes: parsed.estimatedTimeMinutes,
        tags: parsed.tags,
        riskLevel,
        needsSourcing,
        reviewByDate,
        sources: parsed.sources,
        contentBlocks: parsed.contentBlocks,
        interactions: parsed.interactions,
        slotLanguage: parsed.slotLanguage,
        safetyNetting: parsed.safetyNetting,
        status: 'DRAFT',
        approvedBy: null,
        approvedAt: null,
        publishedBy: null,
        publishedAt: null,
        clinicianApproved,
        clinicianApprovedBy: clinicianApproved ? parsed.clinicianApprovedBy ?? null : null,
        clinicianApprovedAt: clinicianApproved ? new Date() : null,
      },
    })

    return NextResponse.json({ cardId: updated.id })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message: 'Invalid input', details: error.issues } },
        { status: 400 }
      )
    }
    console.error('PUT /api/editorial/cards/[cardId] error', error)
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
