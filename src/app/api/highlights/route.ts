/**
 * API routes for highlight rules management
 * Server-only - uses Prisma directly
 */

import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { unstable_noStore as noStore } from 'next/cache'
import { z } from 'zod'
import { revalidateTag } from 'next/cache'
import {
  getAllHighlightRules,
  createHighlightRule,
  getSurgeryBuiltInHighlightsSetting,
  getSurgeryImageIconsSetting,
  HIGHLIGHTS_TAG,
  getCachedHighlightsTag,
} from '@/server/highlights'
import { getSession } from '@/server/auth'
import { GetHighlightsResZ, CreateHighlightReqZ } from '@/lib/api-contracts'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const HighlightsQueryZ = z.object({
  surgeryId: z.string().min(1).optional(),
})

// GET /api/highlights - Get highlight rules (global + surgery-specific)
export async function GET(request: NextRequest) {
  try {
    noStore()
    const { searchParams } = new URL(request.url)
    const parsedQuery = HighlightsQueryZ.safeParse({ surgeryId: searchParams.get('surgeryId') ?? undefined })
    const surgeryParam = parsedQuery.success ? parsedQuery.data.surgeryId : undefined

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
    let enableImageIcons = true
    if (surgeryId) {
      surgeryRules = await getAllHighlightRules(surgeryId)
      enableBuiltInHighlights = await getSurgeryBuiltInHighlightsSetting(surgeryId)
      enableImageIcons = await getSurgeryImageIconsSetting(surgeryId)
    }

    // Combine all rules
    const highlights = [...globalRules, ...surgeryRules]

    const response = NextResponse.json(
      { 
        highlights,
        enableBuiltInHighlights,
        enableImageIcons 
      }
    )
    // Highlight configuration should update immediately after changes.
    response.headers.set('Cache-Control', 'no-store')
    return response
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
    const { phrase, textColor, bgColor, isEnabled, surgeryId, isGlobal } = CreateHighlightReqZ.parse(body)
    const phraseTrimmed = phrase.trim()
    if (!phraseTrimmed) {
      return NextResponse.json(
        { error: 'Phrase must be between 1 and 80 characters' },
        { status: 400 }
      )
    }

    // Determine surgeryId based on session type and global rule setting
    let targetSurgeryId: string | null = null
    
    if (session?.type === 'superuser' && isGlobal) {
      // For superusers creating global rules, surgeryId should be null
      targetSurgeryId = null
    } else if (session?.type === 'surgery' && session.surgeryId) {
      // For surgery admins, use their surgery ID
      targetSurgeryId = session.surgeryId
    } else if (surgeryId) {
      // Fallback to provided surgeryId
      targetSurgeryId = surgeryId
    } else {
      // No valid surgery context
      return NextResponse.json(
        { error: 'Surgery context required for highlight rule creation' },
        { status: 400 }
      )
    }

    const rule = await createHighlightRule({
      phrase: phraseTrimmed,
      textColor,
      bgColor,
      isEnabled: isEnabled ?? true,
      surgeryId: targetSurgeryId
    })

    // Invalidate highlight caches (main UI + admin UI).
    revalidateTag(HIGHLIGHTS_TAG)
    revalidateTag(getCachedHighlightsTag(targetSurgeryId))

    return NextResponse.json({ rule }, { status: 201 })
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

    console.error('Error creating highlight rule:', error)
    return NextResponse.json(
      { error: 'Failed to create highlight rule' },
      { status: 500 }
    )
  }
}
