import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser, requireSurgeryAdmin } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { revalidateTag } from 'next/cache'
import { getCachedSymptomsTag } from '@/server/effectiveSymptoms'
import { markSymptomPendingReview } from '@/server/clinicalReview'
import { Prisma } from '@prisma/client'
import { LinkToPagesZ } from '@/lib/api-contracts'
import { sanitizeSymptomHtml } from '@/lib/sanitizeHtml'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const surgeryId = searchParams.get('surgeryId')
    const baseId = searchParams.get('baseId')

    if (!surgeryId || !baseId) {
      return NextResponse.json(
        { error: 'surgeryId and baseId are required' },
        { status: 400 }
      )
    }

    // Check if user has access to this surgery
    await requireSurgeryAdmin(surgeryId)

    const override = await prisma.surgerySymptomOverride.findUnique({
      where: {
        surgeryId_baseSymptomId: {
          surgeryId,
          baseSymptomId: baseId,
        }
      },
      include: {
        baseSymptom: true,
        surgery: true,
      }
    })

    return NextResponse.json(override)
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error fetching override:', error)
    return NextResponse.json(
      { error: 'Failed to fetch override' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { surgeryId, baseId, ...overrideData } = body

    if (!surgeryId || !baseId) {
      return NextResponse.json(
        { error: 'surgeryId and baseId are required' },
        { status: 400 }
      )
    }

    // Check if user has access to this surgery
    await requireSurgeryAdmin(surgeryId)

    // Validate that the surgery exists
    const surgery = await prisma.surgery.findUnique({
      where: { id: surgeryId }
    })
    if (!surgery) {
      return NextResponse.json(
        { error: 'Surgery not found' },
        { status: 404 }
      )
    }

    // Validate that the base symptom exists
    const baseSymptom = await prisma.baseSymptom.findUnique({
      where: { id: baseId }
    })
    if (!baseSymptom) {
      return NextResponse.json(
        { error: 'Base symptom not found' },
        { status: 404 }
      )
    }

    // Tri-state semantics for prose fields:
    //   undefined = field not in payload, leave row untouched
    //   null      = inherit from base (read path falls back to BaseSymptom)
    //   string    = explicit override value (including "" = blank by choice)
    const allowedFields = ['name', 'ageGroup', 'briefInstruction', 'highlightedText', 'instructions', 'linkToPage', 'isHidden']
    const cleanData = Object.fromEntries(
      Object.entries(overrideData).filter(([key, value]) =>
        allowedFields.includes(key) && value !== undefined
      )
    )

    // Server-side sanitization: with <img> allowed, the internal-src-only
    // invariant must not rely on the client. Idempotent for well-formed input.
    for (const f of ['instructions', 'instructionsHtml'] as const) {
      if (typeof cleanData[f] === 'string') {
        cleanData[f] = sanitizeSymptomHtml(cleanData[f] as string)
      }
    }

    // Related-symptom links, kept in sync across both columns. Tri-state on
    // the stored array: null = inherit base links, [] = explicitly none,
    // [...] = replace. A legacy linkToPage string is folded into the array.
    if (overrideData.linkToPages !== undefined) {
      if (overrideData.linkToPages === null) {
        cleanData.linkToPages = Prisma.DbNull
        cleanData.linkToPage = null
      } else {
        const parsed = LinkToPagesZ.safeParse(overrideData.linkToPages)
        if (!parsed.success) {
          return NextResponse.json(
            { error: 'Invalid linkToPages shape', details: parsed.error.flatten() },
            { status: 400 }
          )
        }
        const links = parsed.data.map((l: string) => l.trim()).filter((l: string) => l !== '')
        cleanData.linkToPages = links
        cleanData.linkToPage = links[0] ?? null
      }
    } else if (typeof cleanData.linkToPage === 'string') {
      const legacy = cleanData.linkToPage.trim()
      cleanData.linkToPages = legacy ? [legacy] : Prisma.DbNull
    } else if (cleanData.linkToPage === null) {
      cleanData.linkToPages = Prisma.DbNull
    }

    // Debug logging
    console.error('Override API received:', { surgeryId, baseId, overrideData, cleanData })

    const override = await prisma.surgerySymptomOverride.upsert({
      where: {
        surgeryId_baseSymptomId: {
          surgeryId,
          baseSymptomId: baseId,
        }
      },
      update: cleanData,
      create: {
        surgeryId,
        baseSymptomId: baseId,
        ...cleanData,
      },
      include: {
        baseSymptom: true,
        surgery: true,
      }
    })

    // Practice content changed — the symptom must be clinically re-approved.
    // Visibility toggles (isHidden) alone don't alter advice, so they don't
    // reset review. Statuses are keyed by the effective age group: an
    // override's non-empty ageGroup wins over the base's.
    const contentChanged = Object.keys(cleanData).some(key => key !== 'isHidden')
    if (contentChanged) {
      const effectiveAgeGroup =
        override.ageGroup && override.ageGroup.trim() !== ''
          ? override.ageGroup
          : baseSymptom.ageGroup
      await markSymptomPendingReview(surgeryId, baseId, effectiveAgeGroup)
    }

    revalidateTag(getCachedSymptomsTag(surgeryId, false))
    revalidateTag(getCachedSymptomsTag(surgeryId, true))
    revalidateTag('symptoms')

    return NextResponse.json(override)
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error creating/updating override:', error)
    
    // Provide more specific error details
    let errorMessage = 'Failed to create/update override'
    if (error instanceof Error) {
      errorMessage += `: ${error.message}`
    }
    
    return NextResponse.json(
      { error: errorMessage, details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const surgeryId = searchParams.get('surgeryId')
    const baseId = searchParams.get('baseId')

    if (!surgeryId || !baseId) {
      return NextResponse.json(
        { error: 'surgeryId and baseId are required' },
        { status: 400 }
      )
    }

    // Check if user has access to this surgery
    await requireSurgeryAdmin(surgeryId)

    await prisma.surgerySymptomOverride.delete({
      where: {
        surgeryId_baseSymptomId: {
          surgeryId,
          baseSymptomId: baseId,
        }
      }
    })

    return NextResponse.json({ message: 'Override deleted successfully' })
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error deleting override:', error)
    return NextResponse.json(
      { error: 'Failed to delete override' },
      { status: 500 }
    )
  }
}
