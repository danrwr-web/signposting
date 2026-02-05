import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'
import { isDailyDoseAdmin, resolveSurgeryIdForUser } from '@/lib/daily-dose/access'
import { EditorialPublishRequestZ } from '@/lib/schemas/editorial'
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
    
    // Validate sources - at least one must have a title
    const validSources = sources.filter((s: any) => s?.title && s.title.trim())

    if (card.status !== 'APPROVED') {
      return NextResponse.json(
        { error: { code: 'INVALID_STATE', message: 'Card must be approved before publishing' } },
        { status: 409 }
      )
    }

    const missingRequirements: string[] = []
    if (!card.reviewByDate) missingRequirements.push('review-by date')
    if (validSources.length === 0) missingRequirements.push('at least one source with a title')
    if (interactions.length === 0) missingRequirements.push('at least one interaction/question')
    if (card.needsSourcing) missingRequirements.push('sourcing needs to be marked as complete')

    if (missingRequirements.length > 0) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_STATE',
            message: `Card cannot be published. Missing: ${missingRequirements.join(', ')}.`,
          },
        },
        { status: 409 }
      )
    }

    // Note: Editors with access to the editorial section are clinical approvers by default.
    // If the card is HIGH risk and hasn't been approved yet, we'll set clinician approval
    // during the approve step (which happens before publish in the approve+publish flow).
    // For direct publish (if status is already APPROVED), we trust that the editor
    // has the authority to publish without a separate clinician approval gate.

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
