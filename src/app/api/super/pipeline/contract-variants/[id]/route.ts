import { NextRequest, NextResponse } from 'next/server'
import { requireSuperuser } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateVariantSchema = z.object({
  name: z.string().min(1).optional(),
  isDefault: z.boolean().optional(),
})

// PATCH /api/super/pipeline/contract-variants/[id] — Update a variant
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperuser()
    const { id } = await params

    const existing = await prisma.contractVariant.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Variant not found' }, { status: 404 })
    }

    const body = await request.json()
    const data = updateVariantSchema.parse(body)

    // If setting as default, unset any existing default
    if (data.isDefault) {
      await prisma.contractVariant.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      })
    }

    // Check name uniqueness if changing name
    if (data.name && data.name !== existing.name) {
      const nameConflict = await prisma.contractVariant.findUnique({ where: { name: data.name } })
      if (nameConflict) {
        return NextResponse.json({ error: 'A variant with this name already exists' }, { status: 400 })
      }
    }

    const updated = await prisma.contractVariant.update({
      where: { id },
      data,
      include: { _count: { select: { templates: true } } },
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

// DELETE /api/super/pipeline/contract-variants/[id] — Delete a variant
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperuser()
    const { id } = await params

    const existing = await prisma.contractVariant.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Variant not found' }, { status: 404 })
    }

    // Don't allow deleting the default variant
    if (existing.isDefault) {
      return NextResponse.json(
        { error: 'Cannot delete the default variant. Set another variant as default first.' },
        { status: 400 }
      )
    }

    // Check for pipeline entries using this variant
    const pipelineCount = await prisma.salesPipeline.count({
      where: { contractVariantId: id },
    })
    if (pipelineCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete: ${pipelineCount} pipeline entries use this variant` },
        { status: 400 }
      )
    }

    // Cascade deletes templates
    await prisma.contractVariant.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
