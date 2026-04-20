import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { requireSuperuser } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

/**
 * Setup Guide template is a standalone document (no contract variant).
 * There is at most one row in DocumentTemplate with
 * documentType = 'SetupGuide' and contractVariantId = null.
 */

// GET /api/super/pipeline/setup-guide-template — Download template .docx
export async function GET() {
  try {
    await requireSuperuser()

    const template = await prisma.documentTemplate.findFirst({
      where: { documentType: 'SetupGuide', contractVariantId: null },
      select: { templateDocx: true, fileName: true },
    })

    if (!template?.templateDocx) {
      return NextResponse.json({ error: 'No template uploaded' }, { status: 404 })
    }

    const fileName = template.fileName || 'setup-guide.docx'
    return new NextResponse(template.templateDocx as unknown as BodyInit, {
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

// PUT /api/super/pipeline/setup-guide-template — Upload .docx template
export async function PUT(request: NextRequest) {
  try {
    await requireSuperuser()

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

    // Upsert by finding existing first; can't use findUnique on a compound key
    // that contains a nullable column in Prisma. A partial unique index on
    // (documentType) WHERE contractVariantId IS NULL prevents duplicates at
    // the DB level; on a concurrent-write race we catch P2002 from create
    // and fall back to updating the row the other writer inserted.
    const selectFields = {
      id: true,
      contractVariantId: true,
      documentType: true,
      fileName: true,
      createdAt: true,
      updatedAt: true,
    } as const

    const updateData = {
      templateDocx: buffer,
      fileName: file.name,
      contentHtml: null,
      contentJson: null,
    }

    const writeTemplate = async () => {
      const existing = await prisma.documentTemplate.findFirst({
        where: { documentType: 'SetupGuide', contractVariantId: null },
        select: { id: true },
      })

      if (existing) {
        return prisma.documentTemplate.update({
          where: { id: existing.id },
          data: updateData,
          select: selectFields,
        })
      }

      return prisma.documentTemplate.create({
        data: {
          contractVariantId: null,
          documentType: 'SetupGuide',
          ...updateData,
        },
        select: selectFields,
      })
    }

    let saved
    try {
      saved = await writeTemplate()
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        saved = await writeTemplate()
      } else {
        throw err
      }
    }

    return NextResponse.json(saved)
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/super/pipeline/setup-guide-template — Delete the template
export async function DELETE() {
  try {
    await requireSuperuser()

    const existing = await prisma.documentTemplate.findFirst({
      where: { documentType: 'SetupGuide', contractVariantId: null },
      select: { id: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    await prisma.documentTemplate.delete({ where: { id: existing.id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
