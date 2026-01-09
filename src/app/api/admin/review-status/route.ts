import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireSurgeryAdmin } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { updateRequiresClinicalReview } from '@/server/updateRequiresClinicalReview'
import { revalidateTag } from 'next/cache'
import { getCachedSymptomsTag } from '@/server/effectiveSymptoms'

export const runtime = 'nodejs'

const reviewStatusSchema = z.object({
  surgeryId: z.string().min(1),
  symptomId: z.string().min(1),
  ageGroup: z.string().nullable().optional(),
  newStatus: z.enum(['PENDING', 'APPROVED', 'CHANGES_REQUIRED']),
  reviewNote: z.string().max(1000).optional().nullable(),
})

// POST /api/admin/review-status
// Updates or creates a SymptomReviewStatus entry for a surgery/symptom
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { surgeryId, symptomId, ageGroup, newStatus, reviewNote } = reviewStatusSchema.parse(body)

    // Auth: SUPERUSER OR ADMIN of that surgery
    const user = await requireSurgeryAdmin(surgeryId)

    // Verify surgery exists
    const surgery = await prisma.surgery.findUnique({
      where: { id: surgeryId }
    })
    if (!surgery) {
      return NextResponse.json(
        { error: 'Surgery not found' },
        { status: 404 }
      )
    }

    // Upsert review status
    const reviewStatus = await prisma.symptomReviewStatus.upsert({
      where: {
        surgeryId_symptomId_ageGroup: {
          surgeryId,
          symptomId,
          ageGroup: ageGroup || null,
        }
      },
      update: {
        status: newStatus,
        lastReviewedAt: new Date(),
        lastReviewedById: user.id,
        // Only set note when changes requested; clear on approve/pending
        reviewNote: newStatus === 'CHANGES_REQUIRED' ? (reviewNote ?? null) : null,
      },
      create: {
        surgeryId,
        symptomId,
        ageGroup: ageGroup || null,
        status: newStatus,
        lastReviewedAt: new Date(),
        lastReviewedById: user.id,
        reviewNote: newStatus === 'CHANGES_REQUIRED' ? (reviewNote ?? null) : null,
      },
      include: {
        lastReviewedBy: {
          select: {
            id: true,
            email: true,
            name: true,
          }
        }
      }
    })

    // Update requiresClinicalReview flag
    await updateRequiresClinicalReview(surgeryId)

    // Review status can affect what is shown/flagged in surgery symptom lists.
    revalidateTag(getCachedSymptomsTag(surgeryId, false))
    revalidateTag(getCachedSymptomsTag(surgeryId, true))
    revalidateTag('symptoms')

    return NextResponse.json(reviewStatus)
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }
    console.error('Error updating review status:', error)
    return NextResponse.json(
      { error: 'Failed to update review status' },
      { status: 500 }
    )
  }
}

