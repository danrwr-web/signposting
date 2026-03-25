import { NextRequest, NextResponse } from 'next/server'
import { requireSuperuser } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'

const VALID_TYPES = ['Proposal', 'SaasAgreement', 'Dpa', 'HostingOverview', 'IgSecurityPack'] as const
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

function validateType(type: string): type is typeof VALID_TYPES[number] {
  return VALID_TYPES.includes(type as typeof VALID_TYPES[number])
}

// GET /api/super/pipeline/contract-variants/[id]/templates/[type] — Download template .docx
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; type: string }> }
) {
  try {
    await requireSuperuser()
    const { id, type } = await params

    if (!validateType(type)) {
      return NextResponse.json({ error: `Invalid document type: ${type}` }, { status: 400 })
    }

    const template = await prisma.documentTemplate.findUnique({
      where: { contractVariantId_documentType: { contractVariantId: id, documentType: type } },
      select: { templateDocx: true, fileName: true },
    })

    if (!template?.templateDocx) {
      return NextResponse.json({ error: 'No template uploaded' }, { status: 404 })
    }

    const fileName = template.fileName || `${type}.docx`
    return new NextResponse(template.templateDocx, {
      headers: {
        'Content-Type': DOCX_MIME,
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/super/pipeline/contract-variants/[id]/templates/[type] — Upload .docx template
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; type: string }> }
) {
  try {
    await requireSuperuser()
    const { id, type } = await params

    if (!validateType(type)) {
      return NextResponse.json({ error: `Invalid document type: ${type}` }, { status: 400 })
    }

    const variant = await prisma.contractVariant.findUnique({ where: { id } })
    if (!variant) {
      return NextResponse.json({ error: 'Variant not found' }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    if (!file.name.endsWith('.docx')) {
      return NextResponse.json({ error: 'Only .docx files are accepted' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const template = await prisma.documentTemplate.upsert({
      where: {
        contractVariantId_documentType: { contractVariantId: id, documentType: type },
      },
      create: {
        contractVariantId: id,
        documentType: type,
        templateDocx: buffer,
        fileName: file.name,
        contentHtml: null,
        contentJson: null,
      },
      update: {
        templateDocx: buffer,
        fileName: file.name,
        contentHtml: null,
        contentJson: null,
      },
      select: {
        id: true,
        contractVariantId: true,
        documentType: true,
        fileName: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json(template)
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/super/pipeline/contract-variants/[id]/templates/[type] — Delete template
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; type: string }> }
) {
  try {
    await requireSuperuser()
    const { id, type } = await params

    if (!validateType(type)) {
      return NextResponse.json({ error: `Invalid document type: ${type}` }, { status: 400 })
    }

    const existing = await prisma.documentTemplate.findUnique({
      where: { contractVariantId_documentType: { contractVariantId: id, documentType: type } },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    await prisma.documentTemplate.delete({
      where: { contractVariantId_documentType: { contractVariantId: id, documentType: type } },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
