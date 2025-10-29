import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireSurgeryAdmin } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export const runtime = 'nodejs'

const completeReviewSchema = z.object({
  surgeryId: z.string().min(1)
})

// POST /api/admin/complete-review
// Completes clinical review sign-off for a surgery
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { surgeryId } = completeReviewSchema.parse(body)

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

    // Check if there are any PENDING review statuses
    const pendingCount = await prisma.symptomReviewStatus.count({
      where: {
        surgeryId,
        status: 'PENDING'
      }
    })

    if (pendingCount > 0) {
      return NextResponse.json(
        { 
          error: 'You still have unresolved symptoms. Everything must be marked Approved or Needs Change before sign-off.',
          pendingCount 
        },
        { status: 400 }
      )
    }

    // Update surgery with sign-off information
    const updatedSurgery = await prisma.surgery.update({
      where: { id: surgeryId },
      data: {
        requiresClinicalReview: false,
        lastClinicalReviewAt: new Date(),
        lastClinicalReviewerId: user.id,
      },
      include: {
        lastClinicalReviewer: {
          select: {
            id: true,
            email: true,
            name: true,
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      surgery: updatedSurgery
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
    console.error('Error completing review:', error)
    return NextResponse.json(
      { error: 'Failed to complete review' },
      { status: 500 }
    )
  }
}

