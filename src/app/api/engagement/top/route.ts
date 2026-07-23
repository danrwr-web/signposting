import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/server/auth'
import { getEngagementExtras } from '@/server/engagementAnalytics'
import type { EngagementTopRes } from '@/lib/api-contracts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const QueryZ = z.object({
  surgeryId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).catch(10),
  startDate: z.coerce.date().optional(),
  includeSurgeryBreakdown: z
    .enum(['true', 'false'])
    .optional()
    .transform(v => v === 'true'),
})

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const parsed = QueryZ.safeParse({
      surgeryId: searchParams.get('surgeryId') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      startDate: searchParams.get('startDate') ?? undefined,
      includeSurgeryBreakdown: searchParams.get('includeSurgeryBreakdown') ?? undefined,
    })
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 })
    }
    const { limit, startDate } = parsed.data

    // Scope enforcement: surgery admins only ever see their own surgery;
    // the all-surgeries overview and per-surgery breakdown are superuser-only.
    let surgeryId: string | null
    let includeSurgeryBreakdown: boolean
    if (session.type === 'surgery') {
      if (!session.surgeryId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      if (parsed.data.surgeryId && parsed.data.surgeryId !== session.surgeryId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      surgeryId = session.surgeryId
      includeSurgeryBreakdown = false
    } else {
      surgeryId = parsed.data.surgeryId ?? null
      includeSurgeryBreakdown = parsed.data.includeSurgeryBreakdown
    }

    const where: {
      event: string
      surgeryId?: string
      createdAt?: { gte: Date }
    } = { event: 'view_symptom' }
    if (surgeryId) where.surgeryId = surgeryId
    if (startDate) where.createdAt = { gte: startDate }

    // Top symptoms by view count
    const topSymptoms = await prisma.engagementEvent.groupBy({
      by: ['baseId'],
      where,
      _count: {
        baseId: true,
      },
      orderBy: {
        _count: {
          baseId: 'desc',
        },
      },
      take: limit,
    })

    // Get symptom details
    const symptomIds = topSymptoms.map(item => item.baseId)
    const symptoms = await prisma.baseSymptom.findMany({
      where: { id: { in: symptomIds } },
      select: {
        id: true,
        name: true,
        ageGroup: true,
      }
    })

    // Combine with counts, skipping events whose symptom has since been deleted
    const topSymptomsWithDetails = topSymptoms.flatMap(item => {
      const symptom = symptoms.find(s => s.id === item.baseId)
      if (!symptom) return []
      return [{ ...symptom, viewCount: item._count.baseId }]
    })

    // Top users by engagement count
    const topUsers = await prisma.engagementEvent.groupBy({
      by: ['userEmail'],
      where: {
        ...where,
        userEmail: { not: null },
      },
      _count: {
        userEmail: true,
      },
      orderBy: {
        _count: {
          userEmail: 'desc',
        },
      },
      take: limit,
    })

    const extras = await getEngagementExtras({ surgeryId, startDate: startDate ?? null })

    const response: EngagementTopRes = {
      topSymptoms: topSymptomsWithDetails,
      topUsers: topUsers.map(item => ({
        userEmail: item.userEmail as string,
        engagementCount: item._count.userEmail,
      })),
      surgeryBreakdown: includeSurgeryBreakdown ? await getSurgeryBreakdown(where) : undefined,
      ...extras,
    }
    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching engagement data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch engagement data' },
      { status: 500 }
    )
  }
}

async function getSurgeryBreakdown(where: object) {
  // Get engagement events grouped by surgery
  const surgeryEngagement = await prisma.engagementEvent.groupBy({
    by: ['surgeryId'],
    where,
    _count: {
      surgeryId: true,
    },
    orderBy: {
      _count: {
        surgeryId: 'desc',
      },
    },
  })

  // Get surgery details
  const surgeryIds = surgeryEngagement.map(item => item.surgeryId).filter((id): id is string => id !== null)
  const surgeries = await prisma.surgery.findMany({
    where: { id: { in: surgeryIds } },
    select: {
      id: true,
      name: true,
      slug: true,
    }
  })

  // Combine with counts
  return surgeryEngagement.flatMap(item => {
    if (!item.surgeryId) return []
    const surgery = surgeries.find(s => s.id === item.surgeryId)
    return [{
      surgeryId: item.surgeryId,
      surgeryName: surgery?.name || 'Unknown Surgery',
      surgerySlug: surgery?.slug ?? null,
      engagementCount: item._count.surgeryId,
    }]
  })
}
