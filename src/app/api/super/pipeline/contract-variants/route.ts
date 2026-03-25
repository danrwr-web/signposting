import { NextRequest, NextResponse } from 'next/server'
import { requireSuperuser } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createVariantSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  isDefault: z.boolean().default(false),
})

// GET /api/super/pipeline/contract-variants — List all variants, auto-seed default if none exist
export async function GET() {
  try {
    await requireSuperuser()

    // Auto-seed a default variant if the table is empty
    const count = await prisma.contractVariant.count()
    if (count === 0) {
      await prisma.contractVariant.create({
        data: { name: 'Standard 12-month', isDefault: true },
      })
    }

    const variants = await prisma.contractVariant.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        _count: { select: { templates: true } },
      },
    })

    return NextResponse.json(variants)
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/super/pipeline/contract-variants — Create a new variant
export async function POST(request: NextRequest) {
  try {
    await requireSuperuser()

    const body = await request.json()
    const { name, isDefault } = createVariantSchema.parse(body)

    const existing = await prisma.contractVariant.findUnique({ where: { name } })
    if (existing) {
      return NextResponse.json({ error: 'A variant with this name already exists' }, { status: 400 })
    }

    // If this is set as default, unset any existing default
    if (isDefault) {
      await prisma.contractVariant.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      })
    }

    const variant = await prisma.contractVariant.create({
      data: { name, isDefault },
      include: { _count: { select: { templates: true } } },
    })

    return NextResponse.json(variant, { status: 201 })
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
