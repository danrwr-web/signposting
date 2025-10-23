import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const surgeryId = searchParams.get('surgeryId')
    const limit = parseInt(searchParams.get('limit') || '5')
    const startDate = searchParams.get('startDate')
    const includeSurgeryBreakdown = searchParams.get('includeSurgeryBreakdown') === 'true'

    const where: any = { event: 'view_symptom' }
    if (surgeryId) where.surgeryId = surgeryId
    if (startDate) {
      where.createdAt = {
        gte: new Date(startDate)
      }
    }

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

    // Combine with counts
    const topSymptomsWithDetails = topSymptoms.map(item => {
      const symptom = symptoms.find(s => s.id === item.baseId)
      return {
        ...symptom,
        viewCount: item._count.baseId,
      }
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

    return NextResponse.json({
      topSymptoms: topSymptomsWithDetails,
      topUsers: topUsers.map(item => ({
        userEmail: item.userEmail,
        engagementCount: item._count.userEmail,
      })),
      surgeryBreakdown: includeSurgeryBreakdown ? await getSurgeryBreakdown(where) : undefined,
    })
  } catch (error) {
    console.error('Error fetching engagement data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch engagement data' },
      { status: 500 }
    )
  }
}

async function getSurgeryBreakdown(where: any) {
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
  const surgeryIds = surgeryEngagement.map(item => item.surgeryId).filter(Boolean)
  const surgeries = await prisma.surgery.findMany({
    where: { id: { in: surgeryIds } },
    select: {
      id: true,
      name: true,
      slug: true,
    }
  })

  // Combine with counts
  return surgeryEngagement.map(item => {
    const surgery = surgeries.find(s => s.id === item.surgeryId)
    return {
      surgeryId: item.surgeryId,
      surgeryName: surgery?.name || 'Unknown Surgery',
      surgerySlug: surgery?.slug,
      engagementCount: item._count.surgeryId,
    }
  })
}
