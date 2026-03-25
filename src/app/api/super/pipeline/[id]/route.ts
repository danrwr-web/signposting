import { NextRequest, NextResponse } from 'next/server'
import { requireSuperuser } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updatePipelineSchema = z.object({
  practiceName: z.string().min(1).optional(),
  townCity: z.string().nullable().optional(),
  pcnName: z.string().nullable().optional(),
  listSize: z.number().int().positive().nullable().optional(),
  estimatedFeeGbp: z.number().nullable().optional(),
  contactName: z.string().nullable().optional(),
  contactRole: z.string().nullable().optional(),
  contactEmail: z.string().email().nullable().optional().or(z.literal('')),
  status: z.enum([
    'Enquiry', 'DemoBooked', 'DemoCompleted', 'ProposalSent',
    'DocumentsSent', 'Contracted', 'OnHold', 'Lost',
  ]).optional(),
  dateEnquiry: z.coerce.date().nullable().optional(),
  dateDemoBooked: z.coerce.date().nullable().optional(),
  dateDemoCompleted: z.coerce.date().nullable().optional(),
  dateProposalSent: z.coerce.date().nullable().optional(),
  dateOnboardingFormSent: z.coerce.date().nullable().optional(),
  dateSaasAgreementSent: z.coerce.date().nullable().optional(),
  dateSaasAgreementSigned: z.coerce.date().nullable().optional(),
  dateDpaSent: z.coerce.date().nullable().optional(),
  dateDpaSigned: z.coerce.date().nullable().optional(),
  dateContractStart: z.coerce.date().nullable().optional(),
  freeTrial: z.boolean().optional(),
  trialEndDate: z.coerce.date().nullable().optional(),
  annualValueGbp: z.number().nullable().optional(),
  contractVariantLabel: z.string().nullable().optional(),
  contractVariantId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  linkedSurgeryId: z.string().nullable().optional(),
})

// GET /api/super/pipeline/[id] — Get a single pipeline entry
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperuser()
    const { id } = await params

    const entry = await prisma.salesPipeline.findUnique({
      where: { id },
      include: {
        linkedSurgery: {
          select: { id: true, name: true, slug: true },
        },
        contractVariant: {
          select: { id: true, name: true },
        },
      },
    })

    if (!entry) {
      return NextResponse.json({ error: 'Pipeline entry not found' }, { status: 404 })
    }

    return NextResponse.json(entry)
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/super/pipeline/[id] — Update a pipeline entry
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperuser()
    const { id } = await params

    const existing = await prisma.salesPipeline.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Pipeline entry not found' }, { status: 404 })
    }

    const body = await request.json()
    const data = updatePipelineSchema.parse(body)

    // Auto-recalculate estimatedFeeGbp when listSize changes and fee not explicitly provided
    let estimatedFeeGbp = data.estimatedFeeGbp
    if (data.listSize !== undefined && !('estimatedFeeGbp' in body)) {
      estimatedFeeGbp = data.listSize !== null ? data.listSize * 0.07 : null
    }

    // Normalise empty contactEmail to null
    if (data.contactEmail === '') {
      data.contactEmail = null
    }

    // Build update payload — only include fields that were actually sent
    const updateData: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        updateData[key] = value
      }
    }
    if (estimatedFeeGbp !== undefined) {
      updateData.estimatedFeeGbp = estimatedFeeGbp
    }

    const updated = await prisma.salesPipeline.update({
      where: { id },
      data: updateData,
      include: {
        linkedSurgery: {
          select: { id: true, name: true, slug: true },
        },
        contractVariant: {
          select: { id: true, name: true },
        },
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/super/pipeline/[id] — Delete a pipeline entry
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperuser()
    const { id } = await params

    const existing = await prisma.salesPipeline.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Pipeline entry not found' }, { status: 404 })
    }

    if (existing.linkedSurgeryId) {
      return NextResponse.json(
        { error: 'Cannot delete a pipeline entry linked to a provisioned surgery' },
        { status: 400 }
      )
    }

    await prisma.salesPipeline.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
