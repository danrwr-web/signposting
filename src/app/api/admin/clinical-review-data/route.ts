import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireSurgeryAdmin } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { unstable_noStore as noStore } from 'next/cache'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

// GET /api/admin/clinical-review-data?surgeryId=xxx
export async function GET(request: NextRequest) {
  try {
    noStore()

    const { searchParams } = new URL(request.url)
    const surgeryId = searchParams.get('surgeryId')

    if (!surgeryId) {
      return NextResponse.json(
        { error: 'surgeryId is required' },
        { status: 400 }
      )
    }

    // Check permissions - user must be superuser or admin of this surgery
    await requireSurgeryAdmin(surgeryId)

    // Get surgery details with review information
    const surgery = await prisma.surgery.findUnique({
      where: { id: surgeryId },
      include: {
        lastClinicalReviewer: {
          select: {
            id: true,
            email: true,
            name: true,
          }
        },
        symptomReviews: {
          select: {
            id: true,
            surgeryId: true,
            symptomId: true,
            ageGroup: true,
            status: true,
            lastReviewedAt: true,
            lastReviewedById: true,
            reviewNote: true,
            lastReviewedBy: {
              select: {
                id: true,
                email: true,
                name: true,
              }
            }
          }
        }
      }
    })

    if (!surgery) {
      return NextResponse.json(
        { error: 'Surgery not found' },
        { status: 404 }
      )
    }

    const res = NextResponse.json({
      surgery: {
        id: surgery.id,
        name: surgery.name,
        requiresClinicalReview: surgery.requiresClinicalReview,
        lastClinicalReviewAt: surgery.lastClinicalReviewAt,
        lastClinicalReviewer: surgery.lastClinicalReviewer,
      },
      reviewStatuses: surgery.symptomReviews
    })
    res.headers.set('Cache-Control', 'no-store')
    return res
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error fetching clinical review data:', error)
    const res = NextResponse.json(
      { error: 'Failed to fetch clinical review data' },
      { status: 500 }
    )
    res.headers.set('Cache-Control', 'no-store')
    return res
  }
}

