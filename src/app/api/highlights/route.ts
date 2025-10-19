/**
 * API routes for highlight rules management
 * Server-only - uses Prisma directly
 */

import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { getAllHighlightRules, createHighlightRule, getSurgeryBuiltInHighlightsSetting } from '@/server/highlights'
import { getSession } from '@/server/auth'
import { GetHighlightsResZ, CreateHighlightReqZ } from '@/lib/api-contracts'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

// GET /api/highlights - Get highlight rules (global + surgery-specific)
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    const { searchParams } = new URL(request.url)
    const surgeryParam = searchParams.get('surgeryId')

    // Convert surgery parameter to surgeryId (handles both ID and slug)
    let surgeryId: string | null = null
    if (surgeryParam) {
      // First try as ID
      const surgeryById = await prisma.surgery.findUnique({
        where: { id: surgeryParam },
        select: { id: true }
      })
      if (surgeryById) {
        surgeryId = surgeryById.id
      } else {
        // Fallback to slug for backward compatibility
        const surgeryBySlug = await prisma.surgery.findUnique({
          where: { slug: surgeryParam },
          select: { id: true }
        })
        if (surgeryBySlug) {
          surgeryId = surgeryBySlug.id
        }
      }
    }

    // Get global rules (surgeryId = null)
    const globalRules = await getAllHighlightRules(null)
    
    // Get surgery-specific rules if surgeryId is provided
    let surgeryRules: any[] = []
    let enableBuiltInHighlights = true
    if (surgeryId) {
      surgeryRules = await getAllHighlightRules(surgeryId)
      enableBuiltInHighlights = await getSurgeryBuiltInHighlightsSetting(surgeryId)
    }

    // Combine all rules
    const highlights = [...globalRules, ...surgeryRules]

    return NextResponse.json(
      GetHighlightsResZ.parse({ 
        highlights,
        enableBuiltInHighlights 
      }),
      { headers: { 'Cache-Control': 'private, max-age=30' } }
    )
  } catch (error) {
    console.error('Error fetching highlight rules:', error)
    return NextResponse.json(
      { error: 'Failed to fetch highlight rules' },
      { status: 500 }
    )
  }
}

// POST /api/highlights - Create a new highlight rule
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    const body = await request.json()
    const { phrase, textColor, bgColor, isEnabled, surgeryId } = CreateHighlightReqZ.parse(body)

    // Determine surgeryId based on session type
    let targetSurgeryId: string | null = null
    if (session?.type === 'surgery' && session.surgeryId) {
      targetSurgeryId = session.surgeryId
    } else if (surgeryId) {
      targetSurgeryId = surgeryId
    }

    const rule = await createHighlightRule({
      phrase: phrase.trim(),
      textColor,
      bgColor,
      isEnabled: isEnabled ?? true,
      surgeryId: targetSurgeryId
    })

    return NextResponse.json({ rule }, { status: 201 })
  } catch (error) {
    console.error('Error creating highlight rule:', error)
    
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

    return NextResponse.json(
      { error: 'Failed to create highlight rule' },
      { status: 500 }
    )
  }
}
