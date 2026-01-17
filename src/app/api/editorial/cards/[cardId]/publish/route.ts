import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'
import { isDailyDoseAdmin, resolveSurgeryIdForUser } from '@/lib/daily-dose/access'
import { EditorialPublishRequestZ } from '@/lib/schemas/editorial'
import { shouldRequireClinicianApproval } from '@/lib/editorial/guards'
import { z } from 'zod'

interface RouteParams {
  params: Promise<{ cardId: string }>
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    const { cardId } = await params
    const body = await request.json().catch(() => ({}))
    const parsed = EditorialPublishRequestZ.parse({
      cardId,
      surgeryId: request.nextUrl.searchParams.get('surgeryId') ?? body?.surgeryId,
    })

    const surgeryId = resolveSurgeryIdForUser({ requestedId: parsed.surgeryId, user })
    if (!surgeryId || !isDailyDoseAdmin(user, surgeryId)) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Admin access required' } },
        { status: 403 }
      )
    }

    const card = await prisma.dailyDoseCard.findFirst({
      where: { id: parsed.cardId, surgeryId },
    })
    if (!card) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Card not found' } },
        { status: 404 }
      )
    }

    const interactions = Array.isArray(card.interactions) ? card.interactions : []
    const sources = Array.isArray(card.sources) ? card.sources : []

    if (card.status !== 'APPROVED') {
      return NextResponse.json(
        { error: { code: 'INVALID_STATE', message: 'Card must be approved before publishing' } },
        { status: 409 }
      )
    }

    if (!card.reviewByDate || sources.length === 0 || interactions.length === 0 || card.needsSourcing) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_STATE',
            message: 'Cards require sources, interactions, and a review-by date before publishing',
          },
        },
        { status: 409 }
      )
    }

    if (shouldRequireClinicianApproval(card.riskLevel as any)) {
      if (!card.clinicianApproved || !card.clinicianApprovedBy) {
        return NextResponse.json(
          {
            error: {
              code: 'CLINICIAN_REQUIRED',
              message: 'Clinician approval is required for high-risk content',
            },
          },
          { status: 409 }
        )
      }
    }

    const nextVersion = card.version + 1
    const snapshot = {
      title: card.title,
      contentBlocks: card.contentBlocks,
      interactions: card.interactions,
      safetyNetting: card.safetyNetting,
      sources: card.sources,
      slotLanguage: card.slotLanguage,
      reviewByDate: card.reviewByDate,
      tags: card.tags,
      targetRole: card.targetRole,
      riskLevel: card.riskLevel,
      needsSourcing: card.needsSourcing,
    }

    const published = await prisma.$transaction(async (tx) => {
      await tx.dailyDoseCardVersion.create({
        data: {
          cardId: card.id,
          version: nextVersion,
          snapshot,
          publishedAt: new Date(),
          createdBy: user.id,
        },
      })

      return tx.dailyDoseCard.update({
        where: { id: card.id },
        data: {
          status: 'PUBLISHED',
          publishedBy: user.id,
          publishedAt: new Date(),
          version: nextVersion,
        },
      })
    })

    return NextResponse.json({ cardId: published.id })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message: 'Invalid input', details: error.issues } },
        { status: 400 }
      )
    }
    console.error('POST /api/editorial/cards/[cardId]/publish error', error)
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
