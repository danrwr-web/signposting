import { NextRequest, NextResponse } from 'next/server'
import { requireSuperuser } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createPipelineSchema = z.object({
  practiceName: z.string().min(1, 'Practice name is required'),
  townCity: z.string().optional(),
  pcnName: z.string().optional(),
  listSize: z.number().int().positive().optional(),
  estimatedFeeGbp: z.number().optional(),
  contactName: z.string().optional(),
  contactRole: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal('')),
  status: z.enum([
    'Enquiry', 'DemoBooked', 'DemoCompleted', 'ProposalSent',
    'DocumentsSent', 'Contracted', 'OnHold', 'Lost',
  ]).default('Enquiry'),
  dateEnquiry: z.coerce.date().optional(),
  dateDemoBooked: z.coerce.date().optional(),
  dateDemoCompleted: z.coerce.date().optional(),
  dateProposalSent: z.coerce.date().optional(),
  dateOnboardingFormSent: z.coerce.date().optional(),
  dateSaasAgreementSent: z.coerce.date().optional(),
  dateSaasAgreementSigned: z.coerce.date().optional(),
  dateDpaSent: z.coerce.date().optional(),
  dateDpaSigned: z.coerce.date().optional(),
  dateContractStart: z.coerce.date().optional(),
  freeTrial: z.boolean().default(false),
  trialEndDate: z.coerce.date().optional(),
  annualValueGbp: z.number().optional(),
  contractVariant: z.string().optional(),
  notes: z.string().optional(),
})

// GET /api/super/pipeline — List all pipeline entries
export async function GET() {
  try {
    await requireSuperuser()

    const entries = await prisma.salesPipeline.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        linkedSurgery: {
          select: { id: true, name: true, slug: true },
        },
      },
    })

    return NextResponse.json(entries)
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/super/pipeline — Create a new pipeline entry
export async function POST(request: NextRequest) {
  try {
    await requireSuperuser()

    const body = await request.json()
    const data = createPipelineSchema.parse(body)

    // Auto-calculate estimatedFeeGbp if listSize provided and fee not explicit
    const estimatedFeeGbp =
      data.estimatedFeeGbp ?? (data.listSize ? data.listSize * 0.07 : undefined)

    // Normalise empty contactEmail to null
    const contactEmail = data.contactEmail === '' ? null : data.contactEmail

    const entry = await prisma.salesPipeline.create({
      data: {
        ...data,
        contactEmail: contactEmail ?? null,
        estimatedFeeGbp: estimatedFeeGbp ?? null,
      },
      include: {
        linkedSurgery: {
          select: { id: true, name: true, slug: true },
        },
      },
    })

    return NextResponse.json(entry, { status: 201 })
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
