/**
 * API routes for individual highlight rule management
 * Server-only - uses Prisma directly
 */

import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { updateHighlightRule, deleteHighlightRule, getAllHighlightRules } from '@/server/highlights'
import { getSession } from '@/server/auth'

export const runtime = 'nodejs'

// PATCH /api/highlights/[id] - Update a highlight rule
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { phrase, textColor, bgColor, isEnabled } = body

    // Validation
    if (phrase !== undefined && (typeof phrase !== 'string' || phrase.trim().length < 1 || phrase.trim().length > 80)) {
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

    return NextResponse.json(rule)
  } catch (error) {
    console.error('Error updating highlight rule:', error)
    
    if (error instanceof Error && (error.name === 'DuplicatePhraseError' || error.message.includes('already exists'))) {
      return NextResponse.json(
        { error: 'A highlight rule with this phrase already exists' },
        { status: 409 }
      )
    }

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
    const { id } = await params

    // Check if the rule exists and get its details
    // Get all rules (both global and surgery-specific) to find the rule
    const globalRules = await getAllHighlightRules(null)
    const surgeryRules = session?.type === 'surgery' ? await getAllHighlightRules(session.surgeryId) : []
    const allRules = [...globalRules, ...surgeryRules]
    const ruleToDelete = allRules.find(rule => rule.id === id)
    
    // If rule is global (surgeryId is null) and user is not a superuser, prevent deletion
    if (ruleToDelete && ruleToDelete.surgeryId === null && session?.type !== 'superuser') {
      return NextResponse.json(
        { error: 'Cannot delete global rules - only disable/enable is allowed' },
        { status: 403 }
      )
    }

    // If rule belongs to a surgery and user is not the admin of that surgery or superuser, prevent deletion
    if (ruleToDelete && ruleToDelete.surgeryId && session?.type === 'surgery' && session.surgeryId !== ruleToDelete.surgeryId) {
      return NextResponse.json(
        { error: 'Cannot delete rules from other surgeries' },
        { status: 403 }
      )
    }

    await deleteHighlightRule(id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting highlight rule:', error)
    return NextResponse.json(
      { error: 'Failed to delete highlight rule' },
      { status: 500 }
    )
  }
}
