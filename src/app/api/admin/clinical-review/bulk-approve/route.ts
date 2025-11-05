import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireSurgeryAdmin } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { getEffectiveSymptoms } from '@/server/effectiveSymptoms'
import { updateRequiresClinicalReview } from '@/server/updateRequiresClinicalReview'

export const runtime = 'nodejs'

const bulkApproveSchema = z.object({
  surgeryId: z.string().min(1),
  search: z.string().optional(),
})

// POST /api/admin/clinical-review/bulk-approve
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { surgeryId, search } = bulkApproveSchema.parse(body)
    
    // RBAC: SUPERUSER can approve any surgery, surgery admin can approve only their own
    const user = await requireSurgeryAdmin(surgeryId)
    
    // Verify surgery exists
    const surgery = await prisma.surgery.findUnique({
      where: { id: surgeryId },
      select: { id: true }
    })
    if (!surgery) {
      return NextResponse.json(
        { error: 'Surgery not found' },
        { status: 404 }
      )
    }
    
    // Get all effective symptoms for this surgery
    const symptoms = await getEffectiveSymptoms(surgeryId, true) // includeDisabled = true
    
    // Get all review statuses for this surgery
    const allReviewStatuses = await prisma.symptomReviewStatus.findMany({
      where: { surgeryId },
    })
    
    // Build a map of symptom review statuses by symptom key
    const reviewStatusMap = new Map<string, typeof allReviewStatuses[0]>()
    for (const rs of allReviewStatuses) {
      const key = `${rs.symptomId}-${rs.ageGroup || ''}`
      reviewStatusMap.set(key, rs)
    }
    
    // Filter to only PENDING items
    const pendingItems: Array<{ symptomId: string; ageGroup: string | null; reviewStatus?: typeof allReviewStatuses[0] }> = []
    
    for (const symptom of symptoms) {
      const key = `${symptom.id}-${symptom.ageGroup || ''}`
      const reviewStatus = reviewStatusMap.get(key)
      
      // Include if no review status (implicitly pending) or explicitly PENDING
      const isPending = !reviewStatus || reviewStatus.status === 'PENDING'
      
      if (isPending) {
        // Apply search filter if provided
        if (search && search.trim()) {
          const searchLower = search.toLowerCase().trim()
          if (!symptom.name.toLowerCase().includes(searchLower)) {
            continue
          }
        }
        
        pendingItems.push({
          symptomId: symptom.id,
          ageGroup: symptom.ageGroup || null,
          reviewStatus: reviewStatus || undefined,
        })
      }
    }
    
    // Update all pending items to APPROVED
    const now = new Date()
    let approvedCount = 0
    
    for (const item of pendingItems) {
      if (item.reviewStatus) {
        // Update existing review status
        await prisma.symptomReviewStatus.update({
          where: { id: item.reviewStatus.id },
          data: {
            status: 'APPROVED',
            lastReviewedAt: now,
            lastReviewedById: user.id,
            reviewNote: null,
          },
        })
      } else {
        // Create new review status
        await prisma.symptomReviewStatus.create({
          data: {
            surgeryId,
            symptomId: item.symptomId,
            ageGroup: item.ageGroup,
            status: 'APPROVED',
            lastReviewedAt: now,
            lastReviewedById: user.id,
            reviewNote: null,
          },
        })
      }
      approvedCount++
    }
    
    // Update requiresClinicalReview flag on surgery
    await updateRequiresClinicalReview(surgeryId, user.id)
    
    return NextResponse.json({ 
      ok: true, 
      approvedCount 
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
    console.error('Error in bulk approve API:', error)
    return NextResponse.json(
      { error: 'Failed to process bulk approve' },
      { status: 500 }
    )
  }
}

