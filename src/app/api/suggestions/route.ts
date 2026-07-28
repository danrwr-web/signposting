import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser, can } from '@/lib/rbac'
import { CreateSuggestionReqZ, SuggestionStatusZ, type SuggestionStatus } from '@/lib/api-contracts'
import { sendSuggestionNotificationEmail } from '@/lib/email'
import type { Prisma } from '@prisma/client'

export const runtime = 'nodejs'

const SURGERY_SELECT = { select: { id: true, name: true, slug: true } } as const

type SuggestionWithSurgery = Prisma.SuggestionGetPayload<{
  include: { surgery: { select: { id: true; name: true; slug: true } } }
}>

// Explicit allowlist: internal fields (legacyAuditJson, respondedByUserId)
// must not reach submitters via scope=mine.
function serialiseSuggestion(suggestion: SuggestionWithSurgery) {
  return {
    id: suggestion.id,
    type: suggestion.type,
    status: suggestion.status,
    surgeryId: suggestion.surgeryId,
    baseId: suggestion.baseId,
    symptom: suggestion.symptom,
    title: suggestion.title,
    text: suggestion.text,
    pageContext: suggestion.pageContext,
    userEmail: suggestion.userEmail,
    submittedByUserId: suggestion.submittedByUserId,
    response: suggestion.response,
    respondedAt: suggestion.respondedAt ? suggestion.respondedAt.toISOString() : null,
    responseViewedAt: suggestion.responseViewedAt ? suggestion.responseViewedAt.toISOString() : null,
    createdAt: suggestion.createdAt.toISOString(),
    updatedAt: suggestion.updatedAt.toISOString(),
    surgery: suggestion.surgery,
  }
}

// Handle CORS preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  })
}

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const scope = searchParams.get('scope') || 'mine'
    const statusParam = searchParams.get('status')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10) || 50, 200)

    let status: SuggestionStatus | undefined
    if (statusParam && statusParam !== 'all') {
      const parsed = SuggestionStatusZ.safeParse(statusParam)
      if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid status filter' }, { status: 400 })
      }
      status = parsed.data
    }

    const where: Prisma.SuggestionWhereInput = {}

    if (scope === 'surgery') {
      // Surgery admins review their teams' symptom-content suggestions; app-level
      // feedback is triaged by superusers only (see /api/super/suggestions).
      where.type = 'SYMPTOM_CONTENT'
      if (!can(user).isSuperuser()) {
        const surgeryIds = can(user).getAdminSurgeryIds()
        if (surgeryIds.length === 0) {
          return NextResponse.json({ suggestions: [], unreadCount: 0 })
        }
        where.surgeryId = { in: surgeryIds }
      }
    } else {
      // Default: the caller's own submissions (legacy rows matched by email).
      where.OR = [{ submittedByUserId: user.id }, { userEmail: user.email }]
    }

    const [suggestions, unreadCount, unreadResponseCount] = await Promise.all([
      prisma.suggestion.findMany({
        where: status ? { ...where, status } : where,
        include: { surgery: SURGERY_SELECT },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.suggestion.count({ where: { ...where, status: 'PENDING' } }),
      // Responses the submitter hasn't seen yet (only meaningful for their own submissions).
      scope === 'surgery'
        ? Promise.resolve(0)
        : prisma.suggestion.count({
            where: { ...where, response: { not: null }, responseViewedAt: null },
          }),
    ])

    return NextResponse.json({
      suggestions: suggestions.map(serialiseSuggestion),
      unreadCount,
      unreadResponseCount,
    })
  } catch (error) {
    console.error('Suggestions API: Error fetching suggestions:', error)
    return NextResponse.json({ error: 'Failed to fetch suggestions' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = CreateSuggestionReqZ.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      )
    }
    const data = parsed.data

    if (data.surgeryId && !can(user).viewSurgery(data.surgeryId)) {
      return NextResponse.json(
        { error: 'Insufficient permissions for this surgery' },
        { status: 403 }
      )
    }

    const suggestion = await prisma.suggestion.create({
      data: {
        type: data.type,
        surgeryId: data.surgeryId || null,
        baseId: data.baseId || null,
        symptom: data.symptom || null,
        title: data.title || null,
        text: data.text,
        pageContext: data.pageContext || null,
        userEmail: user.email,
        submittedByUserId: user.id,
      },
      include: { surgery: SURGERY_SELECT },
    })

    // Notify the reviewers, but never fail the submission if email delivery breaks.
    // Symptom-content suggestions are reviewed by the surgery's own admins, so
    // notify them (not the central team); everything else goes to the toolkit team.
    try {
      let recipients: string[] | undefined
      let reviewPath: string | undefined
      if (suggestion.type === 'SYMPTOM_CONTENT' && suggestion.surgeryId) {
        const admins = await prisma.userSurgery.findMany({
          where: { surgeryId: suggestion.surgeryId, role: 'ADMIN' },
          select: { user: { select: { email: true } } },
        })
        const adminEmails = admins.map((a) => a.user.email).filter(Boolean)
        if (adminEmails.length > 0) {
          recipients = adminEmails
          reviewPath = '/admin?tab=suggestions'
        }
      }
      await sendSuggestionNotificationEmail({
        type: suggestion.type,
        title: suggestion.title,
        text: suggestion.text,
        submitterEmail: user.email,
        surgeryName: suggestion.surgery?.name ?? null,
        symptomName: suggestion.symptom,
        pageContext: suggestion.pageContext,
        recipients,
        reviewPath,
      })
    } catch (emailError) {
      console.error('Suggestions API: Failed to send notification email:', emailError)
    }

    return NextResponse.json(
      {
        suggestion: serialiseSuggestion(suggestion),
        message: 'Suggestion created successfully',
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Suggestions API: Error creating suggestion:', error)
    return NextResponse.json({ error: 'Failed to create suggestion' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { suggestionId } = body
    const parsedStatus = SuggestionStatusZ.safeParse(body.status)
    if (!suggestionId || !parsedStatus.success) {
      return NextResponse.json({ error: 'Missing or invalid suggestionId/status' }, { status: 400 })
    }

    const suggestion = await prisma.suggestion.findUnique({ where: { id: suggestionId } })
    if (!suggestion) {
      return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 })
    }

    if (!can(user).isSuperuser()) {
      // Surgery admins may only triage their own surgery's symptom-content suggestions.
      const isAdminOfSurgery =
        suggestion.surgeryId !== null &&
        can(user).getAdminSurgeryIds().includes(suggestion.surgeryId)
      if (!isAdminOfSurgery || suggestion.type !== 'SYMPTOM_CONTENT') {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
      }
    }

    const updated = await prisma.suggestion.update({
      where: { id: suggestionId },
      data: { status: parsedStatus.data },
      include: { surgery: SURGERY_SELECT },
    })

    return NextResponse.json({ suggestion: serialiseSuggestion(updated) })
  } catch (error) {
    console.error('Suggestions API: Error updating suggestion:', error)
    return NextResponse.json({ error: 'Failed to update suggestion' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const suggestionId = searchParams.get('id')
    if (!suggestionId) {
      return NextResponse.json({ error: 'Missing suggestion id' }, { status: 400 })
    }

    const suggestion = await prisma.suggestion.findUnique({ where: { id: suggestionId } })
    if (!suggestion) {
      return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 })
    }

    if (!can(user).isSuperuser()) {
      const isAdminOfSurgery =
        suggestion.surgeryId !== null &&
        can(user).getAdminSurgeryIds().includes(suggestion.surgeryId)
      if (!isAdminOfSurgery || suggestion.type !== 'SYMPTOM_CONTENT') {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
      }
    }

    await prisma.suggestion.delete({ where: { id: suggestionId } })

    return NextResponse.json({ message: 'Suggestion deleted successfully', deletedId: suggestionId })
  } catch (error) {
    console.error('Suggestions API: Error deleting suggestion:', error)
    return NextResponse.json({ error: 'Failed to delete suggestion' }, { status: 500 })
  }
}
