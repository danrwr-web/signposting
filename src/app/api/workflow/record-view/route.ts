import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireSurgeryAccess } from '@/lib/rbac'

export const runtime = 'nodejs'

const recordViewInput = z.object({
  surgeryId: z.string().min(1),
  templateId: z.string().min(1),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = recordViewInput.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    const { surgeryId, templateId } = parsed.data

    // Verify access
    const user = await requireSurgeryAccess(surgeryId)

    // Verify the template exists and is viewable
    // Templates can be owned by the surgery or inherited from the Global Default surgery
    const template = await prisma.workflowTemplate.findFirst({
      where: {
        id: templateId,
        OR: [
          { surgeryId },
          { surgeryId: 'global-default-buttons' },
        ],
        isActive: true,
      },
      select: { id: true },
    })

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // Record the engagement event
    await prisma.workflowEngagementEvent.create({
      data: {
        surgeryId,
        templateId,
        userId: user.id,
        event: 'view_workflow',
      },
    })

    return NextResponse.json({ recorded: true })
  } catch (error) {
    // Log but don't expose error details - this is non-critical tracking
    console.error('Error recording workflow view:', error)
    return NextResponse.json({ error: 'Failed to record view' }, { status: 500 })
  }
}
