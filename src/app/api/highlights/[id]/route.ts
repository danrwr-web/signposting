/**
 * API routes for individual highlight rule management
 * Server-only - uses Prisma directly
 */

import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { revalidateTag } from 'next/cache'
import {
  updateHighlightRule,
  deleteHighlightRule,
  HIGHLIGHTS_TAG,
  getCachedHighlightsTag,
} from '@/server/highlights'
import { getSession } from '@/server/auth'
import { UpdateHighlightReqZ } from '@/lib/api-contracts'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

const IdParamsZ = z.object({
  id: z.string().min(1),
})

// PATCH /api/highlights/[id] - Update a highlight rule
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rawParams = await params
    const { id } = IdParamsZ.parse(rawParams)
    const body = await request.json()
    const { phrase, textColor, bgColor, isEnabled } = UpdateHighlightReqZ.parse(body)

    // Check the rule exists and authorise edits
    const currentRule = await prisma.highlightRule.findUnique({
      where: { id },
      select: { surgeryId: true },
    })

    if (!currentRule) {
      return NextResponse.json({ error: 'Highlight rule not found' }, { status: 404 })
    }

    // Global rules are superuser-only
    if (currentRule.surgeryId === null && session.type !== 'superuser') {
      return NextResponse.json(
        { error: 'Unauthorized - superuser required for this change' },
        { status: 403 }
      )
    }

    // Surgery admins can only edit their own surgery rules
    if (currentRule.surgeryId && session.type === 'surgery' && session.surgeryId !== currentRule.surgeryId) {
      return NextResponse.json(
        { error: 'Cannot edit rules from other surgeries' },
        { status: 403 }
      )
    }

    // Extra validation: treat phrase as trimmed, non-empty
    if (phrase !== undefined && (phrase.trim().length < 1 || phrase.trim().length > 80)) {
      return NextResponse.json(
        { error: 'Phrase must be between 1 and 80 characters' },
        { status: 400 }
      )
    }

    const rule = await updateHighlightRule(id, {
      phrase: phrase?.trim(),
      textColor,
      bgColor,
      isEnabled
    })

    revalidateTag(HIGHLIGHTS_TAG)
    revalidateTag(getCachedHighlightsTag(currentRule.surgeryId))

    return NextResponse.json(rule)
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid request format' },
        { status: 400 }
      )
    }

    if (error instanceof Error && (error.name === 'DuplicatePhraseError' || error.message.includes('already exists'))) {
      return NextResponse.json(
        { error: 'A highlight rule with this phrase already exists' },
        { status: 409 }
      )
    }

    console.error('Error updating highlight rule:', error)
    return NextResponse.json(
      { error: 'Failed to update highlight rule' },
      { status: 500 }
    )
  }
}

// DELETE /api/highlights/[id] - Delete a highlight rule
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rawParams = await params
    const { id } = IdParamsZ.parse(rawParams)

    const ruleToDelete = await prisma.highlightRule.findUnique({
      where: { id },
      select: { surgeryId: true },
    })
    if (!ruleToDelete) {
      return NextResponse.json({ error: 'Highlight rule not found' }, { status: 404 })
    }
    
    // If rule is global (surgeryId is null) and user is not a superuser, prevent deletion
    if (ruleToDelete.surgeryId === null && session.type !== 'superuser') {
      return NextResponse.json(
        { error: 'Cannot delete global rules - only disable/enable is allowed' },
        { status: 403 }
      )
    }

    // If rule belongs to a surgery and user is not the admin of that surgery or superuser, prevent deletion
    if (ruleToDelete.surgeryId && session.type === 'surgery' && session.surgeryId !== ruleToDelete.surgeryId) {
      return NextResponse.json(
        { error: 'Cannot delete rules from other surgeries' },
        { status: 403 }
      )
    }

    await deleteHighlightRule(id)

    revalidateTag(HIGHLIGHTS_TAG)
    revalidateTag(getCachedHighlightsTag(ruleToDelete.surgeryId))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting highlight rule:', error)
    return NextResponse.json(
      { error: 'Failed to delete highlight rule' },
      { status: 500 }
    )
  }
}
