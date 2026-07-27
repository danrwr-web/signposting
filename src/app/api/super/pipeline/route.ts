import { NextRequest, NextResponse } from 'next/server'
import { requireSuperuser } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Optional fields accept null as well as being omitted, so clients that
// serialise cleared inputs as null (rather than dropping the key) don't fail
// validation. Mirrors updatePipelineSchema in [id]/route.ts.
const createPipelineSchema = z.object({
  practiceName: z.string().min(1, 'Practice name is required'),
  odsCode: z.string().trim().max(12).nullable().optional(),
  practiceAddress: z.string().nullable().optional(),
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
  ]).default('Enquiry'),
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
  freeTrial: z.boolean().default(false),
  trialEndDate: z.coerce.date().nullable().optional(),
  annualValueGbp: z.number().nullable().optional(),
  contractVariantLabel: z.string().nullable().optional(),
  contractVariantId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
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
        contractVariant: {
          select: { id: true, name: true },
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
      data.estimatedFeeGbp ?? (data.listSize ? Math.round(data.listSize * 7) / 100 : undefined)

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
        contractVariant: {
          select: { id: true, name: true },
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
