import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireSurgeryAdmin, requireSuperuser } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { getCachedSymptomsTag, getEffectiveSymptoms } from '@/server/effectiveSymptoms'
import { updateRequiresClinicalReview } from '@/server/updateRequiresClinicalReview'
import { revalidateTag } from 'next/cache'

export const runtime = 'nodejs'

const resetAllSchema = z.object({
  action: z.literal('RESET_ALL'),
  surgeryId: z.string().min(1)
})

// POST /api/admin/clinical-review
// Supports RESET_ALL action to reset all review statuses to PENDING
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Handle RESET_ALL action
    if (body.action === 'RESET_ALL') {
      const { surgeryId } = resetAllSchema.parse(body)
      
      // SUPERUSER can reset any, surgery admin can reset their own
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
      
      // Get all effective symptoms for this surgery
      const symptoms = await getEffectiveSymptoms(surgeryId)
      
      // Reset all review statuses to PENDING, record who reset
      const updates = await prisma.symptomReviewStatus.updateMany({
        where: {
          surgeryId,
          status: { in: ['APPROVED', 'CHANGES_REQUIRED'] }
        },
        data: {
          status: 'PENDING',
          lastReviewedAt: new Date(),
          lastReviewedById: user.id,
          reviewNote: null
        }
      })
      
      // Update requiresClinicalReview flag
      await updateRequiresClinicalReview(surgeryId)

      // Resetting review state can change what appears/flags in the UI.
      revalidateTag(getCachedSymptomsTag(surgeryId, false))
      revalidateTag(getCachedSymptomsTag(surgeryId, true))
      revalidateTag('symptoms')
      
      return NextResponse.json({ 
        ok: true, 
        updated: updates.count 
      })
    }
    
    return NextResponse.json(
      { error: 'Unknown action' },
      { status: 400 }
    )
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
    console.error('Error in clinical-review API:', error)
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    )
  }
}

