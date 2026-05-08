import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/rbac'
import { isDailyDoseAdmin, resolveSurgeryIdForUser } from '@/lib/daily-dose/access'
import { EditorialCardUpdateZ } from '@/lib/schemas/editorial'
import { inferRiskLevel, resolveNeedsSourcing } from '@/lib/editorial/guards'
import { deleteCard } from '@/server/editorial/deleteCards'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

interface RouteParams {
  params: Promise<{ cardId: string }>
}

const CardIdZ = z.string().min(1, 'Card ID is required')

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

    const assignmentCategoryIds = new Set<string>()
    if (parsed.learningCategoryId) assignmentCategoryIds.add(parsed.learningCategoryId)
    if (Array.isArray(parsed.learningAssignments)) {
      for (const assignment of parsed.learningAssignments) {
        assignmentCategoryIds.add(assignment.categoryId)
      }
    }

    const categoriesById = assignmentCategoryIds.size
      ? new Map(
          (
            await prisma.learningCategory.findMany({
              where: { id: { in: Array.from(assignmentCategoryIds) }, isActive: true },
              select: { id: true, subsections: true, name: true },
            })
          ).map((cat) => [cat.id, cat])
        )
      : new Map()

    if (parsed.learningCategoryId && !categoriesById.has(parsed.learningCategoryId)) {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message: 'Selected learning category is not active or does not exist' } },
        { status: 400 }
      )
    }

    if (parsed.learningCategoryId && parsed.learningSubsection) {
      const category = categoriesById.get(parsed.learningCategoryId)
      const subsections = Array.isArray(category?.subsections) ? (category!.subsections as string[]) : []
      if (subsections.length > 0 && !subsections.includes(parsed.learningSubsection)) {
        return NextResponse.json(
          {
            error: {
              code: 'INVALID_INPUT',
              message: `Subsection "${parsed.learningSubsection}" is not valid for category "${category?.name ?? 'Unknown'}"`,
            },
          },
          { status: 400 }
        )
      }
    }

    if (Array.isArray(parsed.learningAssignments)) {
      for (const assignment of parsed.learningAssignments) {
        const category = categoriesById.get(assignment.categoryId)
        if (!category) {
          return NextResponse.json(
            {
              error: {
                code: 'INVALID_INPUT',
                message: `Assigned category "${assignment.categoryName}" is not active or does not exist`,
              },
            },
            { status: 400 }
          )
        }
        const subsection = assignment.subsection?.trim()
        if (!subsection) continue
        const subsections = Array.isArray(category.subsections) ? (category.subsections as string[]) : []
        if (subsections.length > 0 && !subsections.includes(subsection)) {
          return NextResponse.json(
            {
              error: {
                code: 'INVALID_INPUT',
                message: `Subsection "${subsection}" is not valid for category "${category.name}"`,
              },
            },
            { status: 400 }
          )
        }
      }
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
    // If user explicitly sets needsSourcing to false (sources verified), respect that.
    // Otherwise, use the automatic resolution logic.
    const needsSourcing = parsed.needsSourcing === false 
      ? false 
      : resolveNeedsSourcing(parsed.sources, parsed.needsSourcing)

    // When saving a draft, we clear approval status but preserve existing clinician approval
    // (Clinician approval is now set separately via the /approve endpoint)
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
        // Note: clinician approval is preserved; it's set via the /approve endpoint
        // Learning pathway assignment (null = unassign, undefined = leave unchanged)
        ...(parsed.learningCategoryId !== undefined
          ? { learningCategoryId: parsed.learningCategoryId }
          : {}),
        ...(parsed.learningSubsection !== undefined
          ? { learningSubsection: parsed.learningSubsection }
          : {}),
        // Multi-category assignments
        ...(parsed.learningAssignments !== undefined
          ? { learningAssignments: parsed.learningAssignments ?? [] }
          : {}),
        // Always clear validation issues on any save (fix or explicit override)
        validationIssues: null,
        unitLevel: parsed.unitLevel,
      },
    })

    return NextResponse.json({ cardId: updated.id })
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issueMessages = error.issues.map((issue) => {
        const path = issue.path.join('.')
        return `${path}: ${issue.message}`
      })
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_INPUT',
            message: `Validation failed: ${issueMessages.join('; ')}`,
            details: error.issues,
          },
        },
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

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    const { cardId } = await params
    const parsedId = CardIdZ.safeParse(cardId)
    if (!parsedId.success) {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message: 'Invalid card ID', details: parsedId.error.issues } },
        { status: 400 }
      )
    }

    const surgeryIdParam = request.nextUrl.searchParams.get('surgeryId')
    const surgeryId = resolveSurgeryIdForUser({ requestedId: surgeryIdParam ?? undefined, user })
    if (!surgeryId || !isDailyDoseAdmin(user, surgeryId)) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Admin access required' } },
        { status: 403 }
      )
    }

    const result = await deleteCard(parsedId.data, surgeryId)
    if (!result) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Card not found' } },
        { status: 404 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/editorial/cards/[cardId] error', error)
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
