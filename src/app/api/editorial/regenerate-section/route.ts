import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'
import { isDailyDoseAdmin, resolveSurgeryIdForUser } from '@/lib/daily-dose/access'
import {
  EditorialRegenerateSectionRequestZ,
  EditorialInteractionZ,
  EditorialContentBlockZ,
  EditorialSourceZ,
  EditorialSlotLanguageZ,
} from '@/lib/schemas/editorial'
import { regenerateEditorialSection, EditorialAiError } from '@/server/editorialAi'
import { inferRiskLevel, resolveNeedsSourcing } from '@/lib/editorial/guards'
import { z } from 'zod'

const sectionSchemas = {
  title: z.object({ title: z.string().min(1) }),
  scenario: z.object({ contentBlocks: z.array(EditorialContentBlockZ).min(1) }),
  mcq: z.object({ interaction: EditorialInteractionZ }),
  answerOptions: z.object({
    options: z.array(z.string().min(1)).min(2),
    correctIndex: z.number().int().min(0),
  }),
  feedback: z.object({ explanation: z.string().min(1) }),
  safetyNetting: z.object({ safetyNetting: z.array(z.string().min(1)).min(1) }),
  sources: z.object({ sources: z.array(EditorialSourceZ).min(1) }),
  slotLanguage: z.object({ slotLanguage: EditorialSlotLanguageZ }),
} as const

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
    const parsed = EditorialRegenerateSectionRequestZ.parse(body)
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

    const cardPayload = {
      targetRole: card.targetRole,
      title: card.title,
      estimatedTimeMinutes: card.estimatedTimeMinutes,
      tags: Array.isArray(card.tags) ? card.tags : [],
      riskLevel: card.riskLevel,
      needsSourcing: card.needsSourcing,
      reviewByDate: card.reviewByDate ? card.reviewByDate.toISOString().slice(0, 10) : '',
      sources: Array.isArray(card.sources) ? card.sources : [],
      contentBlocks: Array.isArray(card.contentBlocks) ? card.contentBlocks : [],
      interactions: Array.isArray(card.interactions) ? card.interactions : [],
      slotLanguage: card.slotLanguage ?? { relevant: false, guidance: [] },
      safetyNetting: Array.isArray(card.safetyNetting) ? card.safetyNetting : [],
    }

    const regenerated = await regenerateEditorialSection({
      surgeryId,
      card: cardPayload,
      section: parsed.section,
      userInstruction: parsed.userInstruction,
    })

    const schema = sectionSchemas[parsed.section]
    const patchValidation = schema.safeParse(regenerated.patch)
    if (!patchValidation.success) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_SECTION',
            message: 'Regenerated section did not match schema',
            details: patchValidation.error.issues,
          },
        },
        { status: 400 }
      )
    }

    const updated = applySectionPatch({
      card: {
        title: card.title,
        contentBlocks: cardPayload.contentBlocks,
        interactions: cardPayload.interactions,
        safetyNetting: cardPayload.safetyNetting,
        sources: cardPayload.sources,
        slotLanguage: cardPayload.slotLanguage,
      },
      section: parsed.section,
      patch: patchValidation.data,
    })

    const combined = JSON.stringify({
      title: updated.title,
      contentBlocks: updated.contentBlocks,
      interactions: updated.interactions,
      slotLanguage: updated.slotLanguage,
      safetyNetting: updated.safetyNetting,
    })
    const inferredRisk = inferRiskLevel(combined)
    const riskLevel = inferredRisk === 'HIGH' ? 'HIGH' : card.riskLevel
    const needsSourcing = resolveNeedsSourcing(updated.sources, card.needsSourcing)

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

    const nextVersion = card.version + 1
    const result = await prisma.$transaction(async (tx) => {
      await tx.dailyDoseCardVersion.create({
        data: {
          cardId: card.id,
          version: card.version,
          snapshot,
          createdBy: user.id,
        },
      })

      return tx.dailyDoseCard.update({
        where: { id: card.id },
        data: {
          title: updated.title,
          contentBlocks: updated.contentBlocks,
          interactions: updated.interactions,
          safetyNetting: updated.safetyNetting,
          sources: updated.sources,
          slotLanguage: updated.slotLanguage,
          riskLevel,
          needsSourcing,
          version: nextVersion,
          generatedFrom: { type: 'regen', sourceCardId: card.id, section: parsed.section },
          status: 'DRAFT',
          approvedBy: null,
          approvedAt: null,
          publishedBy: null,
          publishedAt: null,
          clinicianApproved: false,
          clinicianApprovedBy: null,
          clinicianApprovedAt: null,
        },
      })
    })

    return NextResponse.json({ updatedCardId: result.id })
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
    console.error('POST /api/editorial/regenerate-section error', error)
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

function applySectionPatch(params: {
  card: {
    title: string
    contentBlocks: unknown[]
    interactions: unknown[]
    safetyNetting: unknown[]
    sources: unknown[]
    slotLanguage: unknown
  }
  section: string
  patch: any
}) {
  const interactions = Array.isArray(params.card.interactions) ? [...params.card.interactions] : []
  const primaryInteraction = (interactions[0] as any) ?? null

  switch (params.section) {
    case 'title':
      return {
        ...params.card,
        title: params.patch.title,
      }
    case 'scenario':
      return {
        ...params.card,
        contentBlocks: params.patch.contentBlocks,
      }
    case 'mcq':
      return {
        ...params.card,
        interactions: [params.patch.interaction, ...interactions.slice(1)],
      }
    case 'answerOptions':
      if (!primaryInteraction) {
        throw new EditorialAiError('INVALID_JSON', 'No interaction to update answer options')
      }
      primaryInteraction.options = params.patch.options
      primaryInteraction.correctIndex = Math.min(
        params.patch.correctIndex,
        params.patch.options.length - 1
      )
      return {
        ...params.card,
        interactions: [primaryInteraction, ...interactions.slice(1)],
      }
    case 'feedback':
      if (!primaryInteraction) {
        throw new EditorialAiError('INVALID_JSON', 'No interaction to update feedback')
      }
      primaryInteraction.explanation = params.patch.explanation
      return {
        ...params.card,
        interactions: [primaryInteraction, ...interactions.slice(1)],
      }
    case 'safetyNetting':
      return {
        ...params.card,
        safetyNetting: params.patch.safetyNetting,
      }
    case 'sources':
      return {
        ...params.card,
        sources: params.patch.sources,
      }
    case 'slotLanguage':
      return {
        ...params.card,
        slotLanguage: params.patch.slotLanguage,
      }
    default:
      return params.card
  }
}
