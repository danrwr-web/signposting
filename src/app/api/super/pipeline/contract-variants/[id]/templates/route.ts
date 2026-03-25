import { NextRequest, NextResponse } from 'next/server'
import { requireSuperuser } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'

// GET /api/super/pipeline/contract-variants/[id]/templates — List all templates for a variant
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperuser()
    const { id } = await params

    const variant = await prisma.contractVariant.findUnique({ where: { id } })
    if (!variant) {
      return NextResponse.json({ error: 'Variant not found' }, { status: 404 })
    }

    // Exclude templateDocx bytes from list response — they can be large
    const templates = await prisma.documentTemplate.findMany({
      where: { contractVariantId: id },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        contractVariantId: true,
        documentType: true,
        fileName: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json(templates)
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
