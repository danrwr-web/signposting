import { NextRequest, NextResponse } from 'next/server'
import { requireSuperuser } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const VALID_TYPES = ['Proposal', 'SaasAgreement', 'Dpa', 'HostingOverview', 'IgSecurityPack'] as const

const upsertTemplateSchema = z.object({
  contentHtml: z.string().min(1, 'Content is required'),
  contentJson: z.string().optional(),
})

// PUT /api/super/pipeline/contract-variants/[id]/templates/[type] — Create or update a template
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; type: string }> }
) {
  try {
    await requireSuperuser()
    const { id, type } = await params

    // Validate document type
    if (!VALID_TYPES.includes(type as typeof VALID_TYPES[number])) {
      return NextResponse.json({ error: `Invalid document type: ${type}` }, { status: 400 })
    }
    const documentType = type as typeof VALID_TYPES[number]

    // Validate variant exists
    const variant = await prisma.contractVariant.findUnique({ where: { id } })
    if (!variant) {
      return NextResponse.json({ error: 'Variant not found' }, { status: 404 })
    }

    const body = await request.json()
    const { contentHtml, contentJson } = upsertTemplateSchema.parse(body)

    const template = await prisma.documentTemplate.upsert({
      where: {
        contractVariantId_documentType: {
          contractVariantId: id,
          documentType,
        },
      },
      create: {
        contractVariantId: id,
        documentType,
        contentHtml,
        contentJson: contentJson ?? null,
      },
      update: {
        contentHtml,
        contentJson: contentJson ?? null,
      },
    })

    return NextResponse.json(template)
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
