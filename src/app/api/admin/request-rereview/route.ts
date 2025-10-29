import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireSurgeryAdmin } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export const runtime = 'nodejs'

const requestRereviewSchema = z.object({
  surgeryId: z.string().min(1)
})

// POST /api/admin/request-rereview
// Resets clinical review status for a surgery, requiring re-review
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { surgeryId } = requestRereviewSchema.parse(body)

    // Auth: SUPERUSER OR ADMIN of that surgery
    await requireSurgeryAdmin(surgeryId)

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

    // Use a transaction to ensure atomicity
    await prisma.$transaction(async (tx) => {
      // Reset all review statuses to PENDING and clear reviewer info
      await tx.symptomReviewStatus.updateMany({
        where: { surgeryId },
        data: {
          status: 'PENDING',
          lastReviewedAt: null,
          lastReviewedById: null,
        }
      })

      // Reset surgery sign-off status
      await tx.surgery.update({
        where: { id: surgeryId },
        data: {
          requiresClinicalReview: true,
          // Keep lastClinicalReviewAt and lastClinicalReviewerId for historical record
        }
      })
    })

    return NextResponse.json({
      success: true,
      message: 'Re-review requested. All symptoms are now marked as pending review.'
    })
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
    console.error('Error requesting re-review:', error)
    return NextResponse.json(
      { error: 'Failed to request re-review' },
      { status: 500 }
    )
  }
}

