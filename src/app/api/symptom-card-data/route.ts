/**
 * Combined endpoint for symptom card data
 * Returns both highlights and image icons in one request to reduce API calls
 */

import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { unstable_noStore as noStore } from 'next/cache'
import { z } from 'zod'
import { getCachedHighlightRules, getSurgeryBuiltInHighlightsSetting, getSurgeryImageIconsSetting } from '@/server/highlights'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const QueryZ = z.object({
  surgeryId: z.string().optional(),
  phrase: z.string().optional(),
})

export async function GET(request: NextRequest) {
  try {
    noStore()
    const { searchParams } = new URL(request.url)
    const parsed = QueryZ.safeParse({
      surgeryId: searchParams.get('surgeryId') ?? undefined,
      phrase: searchParams.get('phrase') ?? undefined,
    })
    const surgeryParam = parsed.success ? parsed.data.surgeryId : undefined
    const phrase = parsed.success ? parsed.data.phrase : undefined // Optional: for image icon lookup

    // Convert surgery parameter to surgeryId (handles both ID and slug)
    let surgeryId: string | null = null
    if (surgeryParam) {
      const surgeryById = await prisma.surgery.findUnique({
        where: { id: surgeryParam },
        select: { id: true }
      })
      if (surgeryById) {
        surgeryId = surgeryById.id
      } else {
        const surgeryBySlug = await prisma.surgery.findUnique({
          where: { slug: surgeryParam },
          select: { id: true }
        })
        if (surgeryBySlug) {
          surgeryId = surgeryBySlug.id
        }
      }
    }

    // Fetch highlights and image icon settings in parallel
    const [globalRules, surgeryRules, enableBuiltInHighlights, enableImageIcons] = await Promise.all([
      getCachedHighlightRules(null),
      surgeryId ? getCachedHighlightRules(surgeryId) : Promise.resolve([]),
      surgeryId ? getSurgeryBuiltInHighlightsSetting(surgeryId) : Promise.resolve(true),
      surgeryId ? getSurgeryImageIconsSetting(surgeryId) : Promise.resolve(true)
    ])

    // Combine highlight rules
    const highlights = [...globalRules, ...surgeryRules]

    // Get matching image icon if phrase provided
    let imageIcon = null
    if (phrase && enableImageIcons && ('imageIcon' in prisma)) {
      try {
        const icons = await (prisma as any).imageIcon.findMany({
          where: { isEnabled: true },
          select: {
            id: true,
            phrase: true,
            imageUrl: true,
            alt: true,
            cardSize: true,
            instructionSize: true
          },
          orderBy: { createdAt: 'desc' }
        })
        
        const phraseLower = phrase.toLowerCase()
        const matching = icons.find((icon: any) =>
          phraseLower.includes(icon.phrase.toLowerCase())
        )
        if (matching) {
          imageIcon = {
            imageUrl: matching.imageUrl,
            cardSize: matching.cardSize || 'medium',
            instructionSize: matching.instructionSize || 'medium'
          }
        }
      } catch (error) {
        // Silently fail if imageIcon model not available
        console.log('ImageIcon model not available')
      }
    }

    const response = NextResponse.json({
      highlights,
      enableBuiltInHighlights,
      enableImageIcons,
      imageIcon
    })

    // The main UI should reflect highlight changes immediately.
    response.headers.set('Cache-Control', 'no-store')
    return response
  } catch (error) {
    console.error('Error fetching symptom card data:', error)
    const response = NextResponse.json({
      highlights: [],
      enableBuiltInHighlights: true,
      enableImageIcons: true,
      imageIcon: null
    })
    response.headers.set('Cache-Control', 'no-store')
    return response
  }
}

