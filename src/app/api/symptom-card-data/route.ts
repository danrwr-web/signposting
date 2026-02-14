/**
 * Combined endpoint for symptom card data
 * Returns highlights, image icons, and settings in one request per surgery.
 *
 * Batch mode (no `phrase`): returns all image icons so the client can match locally.
 * Legacy mode (`phrase` provided): returns a single matching icon (kept for backwards compat).
 */

import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCachedHighlightRules, getSurgeryBuiltInHighlightsSetting, getSurgeryImageIconsSetting } from '@/server/highlights'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

const QueryZ = z.object({
  surgeryId: z.string().optional(),
  phrase: z.string().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const parsed = QueryZ.safeParse({
      surgeryId: searchParams.get('surgeryId') ?? undefined,
      phrase: searchParams.get('phrase') ?? undefined,
    })
    const surgeryParam = parsed.success ? parsed.data.surgeryId : undefined
    const phrase = parsed.success ? parsed.data.phrase : undefined

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

    // Fetch highlights and settings in parallel
    const [globalRules, surgeryRules, enableBuiltInHighlights, enableImageIcons] = await Promise.all([
      getCachedHighlightRules(null),
      surgeryId ? getCachedHighlightRules(surgeryId) : Promise.resolve([]),
      surgeryId ? getSurgeryBuiltInHighlightsSetting(surgeryId) : Promise.resolve(true),
      surgeryId ? getSurgeryImageIconsSetting(surgeryId) : Promise.resolve(true)
    ])

    // Combine highlight rules
    const highlights = [...globalRules, ...surgeryRules]

    // Image icons: batch mode returns all, legacy mode returns single match
    let imageIcon = null
    let imageIcons: Array<{ phrase: string; imageUrl: string; cardSize: string; instructionSize: string }> = []

    if (enableImageIcons && ('imageIcon' in prisma)) {
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

        // Batch mode: return all icons for client-side matching
        imageIcons = icons.map((icon: any) => ({
          phrase: icon.phrase,
          imageUrl: icon.imageUrl,
          cardSize: icon.cardSize || 'medium',
          instructionSize: icon.instructionSize || 'medium',
        }))

        // Legacy single-match mode when phrase is provided
        if (phrase) {
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
        }
      } catch {
        // imageIcon model not available yet
      }
    }

    const response = NextResponse.json({
      highlights,
      enableBuiltInHighlights,
      enableImageIcons,
      imageIcon,
      imageIcons,
    })

    // Allow short browser caching (highlights rarely change mid-session).
    response.headers.set('Cache-Control', 'private, max-age=60, stale-while-revalidate=300')
    return response
  } catch (error) {
    console.error('Error fetching symptom card data:', error)
    const response = NextResponse.json({
      highlights: [],
      enableBuiltInHighlights: true,
      enableImageIcons: true,
      imageIcon: null,
      imageIcons: [],
    })
    response.headers.set('Cache-Control', 'no-store')
    return response
  }
}

