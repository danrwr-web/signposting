import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireSurgeryAccess } from '@/lib/rbac'
import { isFeatureEnabledForSurgery } from '@/lib/features'

export const runtime = 'nodejs'

const recordViewInput = z.object({
  surgeryId: z.string().min(1),
  itemId: z.string().min(1),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = recordViewInput.safeParse(body)
    
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    const { surgeryId, itemId } = parsed.data

    // Verify access
    const user = await requireSurgeryAccess(surgeryId)
    const enabled = await isFeatureEnabledForSurgery(surgeryId, 'admin_toolkit')
    
    if (!enabled) {
      return NextResponse.json({ error: 'Practice Handbook is not enabled' }, { status: 403 })
    }

    // Verify the item exists
    const item = await prisma.adminItem.findFirst({
      where: { id: itemId, surgeryId, deletedAt: null },
      select: { id: true },
    })
    
    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    // Record the engagement event
    await prisma.adminToolkitEngagementEvent.create({
      data: {
        surgeryId,
        adminItemId: itemId,
        userId: user.id,
        event: 'view_item',
      },
    })

    return NextResponse.json({ recorded: true })
  } catch (error) {
    // Log but don't expose error details - this is non-critical tracking
    console.error('Error recording admin toolkit view:', error)
    return NextResponse.json({ error: 'Failed to record view' }, { status: 500 })
  }
}
