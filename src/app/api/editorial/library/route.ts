import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'
import { isDailyDoseAdmin, resolveSurgeryIdForUser } from '@/lib/daily-dose/access'
import { Prisma } from '@prisma/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    const { searchParams } = request.nextUrl
    const surgeryIdParam = searchParams.get('surgeryId')
    const surgeryId = resolveSurgeryIdForUser({ requestedId: surgeryIdParam, user })

    if (!surgeryId || !isDailyDoseAdmin(user, surgeryId)) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Admin access required' } },
        { status: 403 }
      )
    }

    // Parse filters
    const status = searchParams.get('status')
    const role = searchParams.get('role')
    const risk = searchParams.get('risk')
    const search = searchParams.get('search')
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    // Build where clause
    const where: Prisma.DailyDoseCardWhereInput = {
      surgeryId,
    }

    if (status && status !== 'all') {
      where.status = status
    }

    if (role && role !== 'all') {
      where.targetRole = role
    }

    if (risk && risk !== 'all') {
      where.riskLevel = risk
    }

    if (search) {
      where.title = {
        contains: search,
        mode: 'insensitive',
      }
    }

    // Build orderBy
    const orderBy: Prisma.DailyDoseCardOrderByWithRelationInput = {}
    if (sortBy === 'createdAt') {
      orderBy.createdAt = sortOrder as 'asc' | 'desc'
    } else if (sortBy === 'reviewByDate') {
      orderBy.reviewByDate = sortOrder as 'asc' | 'desc'
    } else if (sortBy === 'title') {
      orderBy.title = sortOrder as 'asc' | 'desc'
    }

    const cards = await prisma.dailyDoseCard.findMany({
      where,
      orderBy,
      select: {
        id: true,
        batchId: true,
        title: true,
        status: true,
        riskLevel: true,
        needsSourcing: true,
        targetRole: true,
        tags: true,
        reviewByDate: true,
        createdAt: true,
        clinicianApproved: true,
        clinicianApprovedAt: true,
        clinicianApprovedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      take: 100, // Limit to 100 cards for now
    })

    // Transform the response
    const transformedCards = cards.map((card) => ({
      id: card.id,
      batchId: card.batchId,
      title: card.title,
      status: card.status,
      riskLevel: card.riskLevel,
      needsSourcing: card.needsSourcing,
      targetRole: card.targetRole,
      tags: card.tags,
      reviewByDate: card.reviewByDate?.toISOString() ?? null,
      createdAt: card.createdAt.toISOString(),
      clinicianApproved: card.clinicianApproved,
      clinicianApprovedBy: card.clinicianApprovedByUser,
      clinicianApprovedAt: card.clinicianApprovedAt?.toISOString() ?? null,
    }))

    return NextResponse.json({ cards: transformedCards })
  } catch (error) {
    console.error('GET /api/editorial/library error', error)
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
