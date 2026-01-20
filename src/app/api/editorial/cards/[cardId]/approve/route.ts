import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'
import { isDailyDoseAdmin, resolveSurgeryIdForUser } from '@/lib/daily-dose/access'
import { EditorialApproveRequestZ } from '@/lib/schemas/editorial'
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
    const parsed = EditorialApproveRequestZ.parse({
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
            message: `Card cannot be approved. Missing: ${missingRequirements.join(', ')}.`,
          },
        },
        { status: 409 }
      )
    }

    // For HIGH risk cards, also record clinician approval
    const isHighRisk = card.riskLevel === 'HIGH'
    
    const approved = await prisma.dailyDoseCard.update({
      where: { id: card.id },
      data: {
        status: 'APPROVED',
        approvedBy: user.id,
        approvedAt: new Date(),
        // Auto-set clinician approval for HIGH risk cards
        ...(isHighRisk && {
          clinicianApproved: true,
          clinicianApprovedBy: user.id,
          clinicianApprovedAt: new Date(),
        }),
      },
    })

    return NextResponse.json({ cardId: approved.id })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message: 'Invalid input', details: error.issues } },
        { status: 400 }
      )
    }
    console.error('POST /api/editorial/cards/[cardId]/approve error', error)
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
