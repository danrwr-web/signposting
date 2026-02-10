import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'
import { isDailyDoseAdmin, resolveSurgeryIdForUser } from '@/lib/daily-dose/access'
import { EditorialVariationsRequestZ, EditorialLearningCardZ } from '@/lib/schemas/editorial'
import { generateEditorialVariations, EditorialAiError } from '@/server/editorialAi'
import { inferRiskLevel, resolveNeedsSourcing } from '@/lib/editorial/guards'
import { z } from 'zod'

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    const body = await request.json()
    const parsed = EditorialVariationsRequestZ.parse(body)
    const surgeryId = resolveSurgeryIdForUser({ requestedId: parsed.surgeryId, user })
    if (!surgeryId || !isDailyDoseAdmin(user, surgeryId)) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Admin access required' } },
        { status: 403 }
      )
    }

    const card = await prisma.dailyDoseCard.findFirst({
      where: {
        id: parsed.cardId,
        surgeryId,
      },
    })

    if (!card) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Card not found' } },
        { status: 404 }
      )
    }

    const now = new Date()
    const cardReviewDate = card.reviewByDate ? new Date(card.reviewByDate) : null
    const fallbackReviewByDate = 
      (cardReviewDate && !Number.isNaN(cardReviewDate.getTime()) && cardReviewDate > now)
        ? cardReviewDate
        : new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000) // 6 months (180 days) from now
    const fallbackSources =
      Array.isArray(card.sources) && card.sources.length > 0
        ? card.sources
        : [
            {
              title: 'Needs sourcing',
              url: 'https://needs-sourcing.invalid',
              publisher: 'Needs sourcing',
            },
          ]

    const sourceCard = EditorialLearningCardZ.parse({
      targetRole: card.targetRole,
      title: card.title,
      estimatedTimeMinutes: card.estimatedTimeMinutes,
      tags: Array.isArray(card.tags) ? card.tags : [],
      riskLevel: card.riskLevel,
      needsSourcing: card.needsSourcing,
      reviewByDate: fallbackReviewByDate.toISOString().slice(0, 10),
      sources: fallbackSources,
      contentBlocks: Array.isArray(card.contentBlocks) ? card.contentBlocks : [],
      interactions: Array.isArray(card.interactions) ? card.interactions : [],
      slotLanguage: card.slotLanguage ?? { relevant: false, guidance: [] },
      safetyNetting: Array.isArray(card.safetyNetting) ? card.safetyNetting : [],
    })

    const generated = await generateEditorialVariations({
      surgeryId,
      sourceCard,
      variationsCount: parsed.variationsCount,
    })

    const createdCards = await prisma.$transaction(
      generated.cards.map((variation) => {
        const combined = JSON.stringify(variation)
        const inferredRisk = inferRiskLevel(combined)
        const riskLevel = inferredRisk === 'HIGH' ? 'HIGH' : variation.riskLevel
        const variationNow = new Date()
        const reviewByDate = new Date(variation.reviewByDate)
        const reviewByDateValid = !Number.isNaN(reviewByDate.getTime()) && reviewByDate > variationNow
        const defaultReviewByDate = new Date(variationNow.getTime() + 180 * 24 * 60 * 60 * 1000) // 6 months (180 days) from now
        const needsSourcing = resolveNeedsSourcing(variation.sources, variation.needsSourcing) || !reviewByDateValid

        return prisma.dailyDoseCard.create({
          data: {
            batchId: card.batchId,
            surgeryId,
            targetRole: variation.targetRole,
            title: variation.title,
            roleScope: [variation.targetRole],
            topicId: card.topicId,
            contentBlocks: variation.contentBlocks,
            interactions: variation.interactions,
            slotLanguage: variation.slotLanguage,
            safetyNetting: variation.safetyNetting,
            sources: variation.sources,
            estimatedTimeMinutes: variation.estimatedTimeMinutes,
            riskLevel,
            needsSourcing,
            reviewByDate: reviewByDateValid ? reviewByDate : defaultReviewByDate,
            tags: variation.tags,
            status: 'DRAFT',
            createdBy: user.id,
            generatedFrom: { type: 'variation', sourceCardId: card.id },
            clinicianApproved: false,
          },
        })
      })
    )

    return NextResponse.json({
      newCardIds: createdCards.map((created) => created.id),
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message: 'Invalid input', details: error.issues } },
        { status: 400 }
      )
    }
    if (error instanceof EditorialAiError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message, details: error.details } },
        { status: 502 }
      )
    }
    console.error('POST /api/editorial/variations error', error)
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
