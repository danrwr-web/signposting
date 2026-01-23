import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSurgeryAccess } from '@/lib/rbac'
import { isFeatureEnabledForSurgery } from '@/lib/features'
import { canAccessAdminToolkitAdminDashboard } from '@/lib/adminToolkitPermissions'

export const runtime = 'nodejs'

type TimeWindow = '7d' | '30d' | '90d' | 'all'

function getStartDateFromWindow(window: TimeWindow): Date | null {
  const now = new Date()
  switch (window) {
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    case '90d':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    case 'all':
      return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const surgeryId = searchParams.get('surgeryId')
    const timeWindow = (searchParams.get('timeWindow') || '30d') as TimeWindow
    const limit = parseInt(searchParams.get('limit') || '10')

    if (!surgeryId) {
      return NextResponse.json({ error: 'surgeryId is required' }, { status: 400 })
    }

    // Verify access
    const user = await requireSurgeryAccess(surgeryId)
    const enabled = await isFeatureEnabledForSurgery(surgeryId, 'admin_toolkit')
    if (!enabled) {
      return NextResponse.json({ error: 'Practice Handbook is not enabled' }, { status: 403 })
    }

    if (!canAccessAdminToolkitAdminDashboard(user, surgeryId)) {
      return NextResponse.json({ error: 'Not authorised' }, { status: 403 })
    }

    const startDate = getStartDateFromWindow(timeWindow)
    const where = {
      surgeryId,
      event: 'view_item',
      ...(startDate ? { createdAt: { gte: startDate } } : {}),
    }

    // Top items by view count
    const topItems = await prisma.adminToolkitEngagementEvent.groupBy({
      by: ['adminItemId'],
      where,
      _count: { adminItemId: true },
      orderBy: { _count: { adminItemId: 'desc' } },
      take: limit,
    })

    // Get item details and category names
    const itemIds = topItems.map((item) => item.adminItemId)
    const items = await prisma.adminItem.findMany({
      where: { id: { in: itemIds } },
      select: {
        id: true,
        title: true,
        type: true,
        category: { select: { id: true, name: true } },
      },
    })

    const topItemsWithDetails = topItems.map((item) => {
      const details = items.find((i) => i.id === item.adminItemId)
      return {
        id: item.adminItemId,
        title: details?.title ?? 'Unknown',
        type: details?.type ?? 'PAGE',
        categoryName: details?.category?.name ?? 'Uncategorised',
        views: item._count.adminItemId,
      }
    })

    // Top users by view count
    const topUsers = await prisma.adminToolkitEngagementEvent.groupBy({
      by: ['userId'],
      where,
      _count: { userId: true },
      orderBy: { _count: { userId: 'desc' } },
      take: limit,
    })

    // Get user details
    const userIds = topUsers.map((u) => u.userId)
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true },
    })

    const topUsersWithDetails = topUsers.map((u) => {
      const details = users.find((user) => user.id === u.userId)
      return {
        id: u.userId,
        name: details?.name ?? details?.email ?? 'Unknown',
        views: u._count.userId,
      }
    })

    return NextResponse.json({
      topItems: topItemsWithDetails,
      topUsers: topUsersWithDetails,
      timeWindow,
    })
  } catch (error) {
    console.error('Error fetching admin toolkit engagement data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch engagement data' },
      { status: 500 }
    )
  }
}
