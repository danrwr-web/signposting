import { NextRequest, NextResponse } from 'next/server'
import { requireSuperuser } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { UpdateSuggestionTriageReqZ } from '@/lib/api-contracts'
import type { Prisma } from '@prisma/client'

// PATCH /api/super/suggestions/[id] — Update status and/or respond to a suggestion
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireSuperuser()
    const { id } = await params

    const body = await request.json()
    const parsed = UpdateSuggestionTriageReqZ.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      )
    }

    const existing = await prisma.suggestion.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 })
    }

    const data: Prisma.SuggestionUpdateInput = {}
    if (parsed.data.redirectToPractice) {
      if (existing.type === 'SYMPTOM_CONTENT') {
        return NextResponse.json(
          { error: 'This suggestion is already with the practice’s administrators' },
          { status: 400 }
        )
      }
      if (!existing.surgeryId) {
        return NextResponse.json(
          { error: 'This suggestion is not linked to a practice, so it cannot be redirected' },
          { status: 400 }
        )
      }
      const adminCount = await prisma.userSurgery.count({
        where: { surgeryId: existing.surgeryId, role: 'ADMIN' },
      })
      if (adminCount === 0) {
        return NextResponse.json(
          { error: 'This practice has no toolkit administrators to receive the suggestion' },
          { status: 400 }
        )
      }
      // Move it into the practice admins' queue (scope=surgery only lists
      // SYMPTOM_CONTENT rows) as a fresh pending item, keeping the original
      // type so the submitter still recognises their suggestion.
      data.type = 'SYMPTOM_CONTENT'
      data.status = 'PENDING'
      data.redirectedFromType = existing.type
      data.redirectedAt = new Date()
    }
    if (parsed.data.status !== undefined) {
      data.status = parsed.data.status
    }
    if (parsed.data.response !== undefined) {
      data.response = parsed.data.response || null
      data.respondedBy = { connect: { id: user.id } }
      data.respondedAt = new Date()
      // A new or updated response hasn't been seen by the submitter yet.
      data.responseViewedAt = null
    }

    const updated = await prisma.suggestion.update({
      where: { id },
      data,
      include: {
        surgery: { select: { id: true, name: true, slug: true } },
        submittedBy: { select: { id: true, name: true, email: true } },
        respondedBy: { select: { id: true, name: true, email: true } },
      },
    })

    return NextResponse.json({ suggestion: updated })
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Super suggestions API: Error updating suggestion:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/super/suggestions/[id] — Remove a suggestion (e.g. spam)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperuser()
    const { id } = await params

    const existing = await prisma.suggestion.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 })
    }

    await prisma.suggestion.delete({ where: { id } })
    return NextResponse.json({ message: 'Suggestion deleted', deletedId: id })
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Super suggestions API: Error deleting suggestion:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
