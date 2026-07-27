import { NextRequest, NextResponse } from 'next/server'
import { requireSuperuser } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { SuggestionStatusZ, SuggestionTypeZ } from '@/lib/api-contracts'
import type { Prisma } from '@prisma/client'

// GET /api/super/suggestions — List all suggestions for triage
export async function GET(request: NextRequest) {
  try {
    await requireSuperuser()

    const { searchParams } = new URL(request.url)
    const typeParam = searchParams.get('type')
    const statusParam = searchParams.get('status')
    const q = searchParams.get('q')?.trim()

    const where: Prisma.SuggestionWhereInput = {}
    if (typeParam && typeParam !== 'all') {
      const parsed = SuggestionTypeZ.safeParse(typeParam)
      if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid type filter' }, { status: 400 })
      }
      where.type = parsed.data
    }
    if (statusParam && statusParam !== 'all') {
      const parsed = SuggestionStatusZ.safeParse(statusParam)
      if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid status filter' }, { status: 400 })
      }
      where.status = parsed.data
    }
    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { text: { contains: q, mode: 'insensitive' } },
        { userEmail: { contains: q, mode: 'insensitive' } },
        { symptom: { contains: q, mode: 'insensitive' } },
      ]
    }

    const suggestions = await prisma.suggestion.findMany({
      where,
      include: {
        surgery: { select: { id: true, name: true, slug: true } },
        submittedBy: { select: { id: true, name: true, email: true } },
        respondedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ suggestions })
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Super suggestions API: Error fetching suggestions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
