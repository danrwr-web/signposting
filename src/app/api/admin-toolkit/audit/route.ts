import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSurgeryAccess } from '@/lib/rbac'
import { isFeatureEnabledForSurgery } from '@/lib/features'
import { canAccessAdminToolkitAdminDashboard } from '@/lib/adminToolkitPermissions'

export const runtime = 'nodejs'

type TimeWindow = '7d' | '30d' | '90d' | 'all'
type EntityTypeFilter = 'all' | 'ADMIN_ITEM' | 'CATEGORY' | 'QUICK_ACCESS' | 'ROTA' | 'OP_PANEL'

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
    const entityType = (searchParams.get('entityType') || 'all') as EntityTypeFilter
    const limit = parseInt(searchParams.get('limit') || '50')
    const cursor = searchParams.get('cursor') // For pagination

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
    const where: {
      surgeryId: string
      createdAt?: { gte: Date }
      entityType?: string
    } = {
      surgeryId,
      ...(startDate ? { createdAt: { gte: startDate } } : {}),
      ...(entityType !== 'all' ? { entityType } : {}),
    }

    // Fetch audit events with pagination
    const events = await prisma.adminHistory.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1, // Fetch one extra to check for more
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        action: true,
        entityType: true,
        summary: true,
        createdAt: true,
        adminItemId: true,
        adminCategoryId: true,
        adminItem: {
          select: { id: true, title: true, type: true, deletedAt: true },
        },
        adminCategory: {
          select: { id: true, name: true, deletedAt: true },
        },
        actorUser: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    const hasMore = events.length > limit
    const items = hasMore ? events.slice(0, limit) : events
    const nextCursor = hasMore ? items[items.length - 1]?.id : null

    // Transform events for the frontend
    const auditEvents = items.map((event) => {
      // Generate a human-readable action label if summary is not available
      let actionLabel = event.summary
      if (!actionLabel) {
        const actionLabels: Record<string, string> = {
          ITEM_CREATE: 'Created item',
          ITEM_UPDATE: 'Updated item',
          ITEM_DELETE: 'Deleted item',
          CATEGORY_CREATE: 'Created category',
          CATEGORY_UPDATE: 'Updated category',
          CATEGORY_DELETE: 'Deleted category',
          CATEGORY_REORDER: 'Reordered categories',
          CATEGORY_VISIBILITY_SET: 'Updated category visibility',
          QUICK_ACCESS_SET: 'Updated Quick Access',
          ON_TAKE_WEEK_SET: 'Updated on-take rota',
          PINNED_PANEL_UPDATE: 'Updated operational panel',
          LIST_COLUMN_CREATE: 'Added list column',
          LIST_COLUMN_UPDATE: 'Updated list column',
          LIST_COLUMN_DELETE: 'Deleted list column',
          LIST_COLUMN_REORDER: 'Reordered list columns',
          LIST_ROW_CREATE: 'Added list row',
          LIST_ROW_UPDATE: 'Updated list row',
          LIST_ROW_DELETE: 'Deleted list row',
          ATTACHMENT_ADD: 'Added attachment',
          ATTACHMENT_REMOVE: 'Removed attachment',
          ITEM_EDITORS_SET: 'Updated item editors',
          ITEM_EDIT_GRANTS_SET: 'Updated item permissions',
        }
        actionLabel = actionLabels[event.action] || event.action
      }

      // Determine the target name
      let targetName: string | null = null
      let targetId: string | null = null
      let targetDeleted = false

      if (event.adminItem) {
        targetName = event.adminItem.title
        targetId = event.adminItem.id
        targetDeleted = !!event.adminItem.deletedAt
      } else if (event.adminCategory) {
        targetName = event.adminCategory.name
        targetId = event.adminCategoryId
        targetDeleted = !!event.adminCategory.deletedAt
      }

      return {
        id: event.id,
        action: event.action,
        actionLabel,
        entityType: event.entityType ?? inferEntityType(event.action),
        targetName,
        targetId,
        targetDeleted,
        actorName: event.actorUser.name ?? event.actorUser.email ?? 'Unknown',
        actorId: event.actorUser.id,
        createdAt: event.createdAt.toISOString(),
      }
    })

    return NextResponse.json({
      events: auditEvents,
      nextCursor,
      hasMore,
      timeWindow,
      entityType,
    })
  } catch (error) {
    console.error('Error fetching admin toolkit audit data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch audit data' },
      { status: 500 }
    )
  }
}

// Helper to infer entity type from action for older records without entityType
function inferEntityType(action: string): string {
  if (action.startsWith('ITEM_') || action.startsWith('LIST_') || action.startsWith('ATTACHMENT_')) {
    return 'ADMIN_ITEM'
  }
  if (action.startsWith('CATEGORY_')) {
    return 'CATEGORY'
  }
  if (action === 'QUICK_ACCESS_SET') {
    return 'QUICK_ACCESS'
  }
  if (action === 'ON_TAKE_WEEK_SET') {
    return 'ROTA'
  }
  if (action === 'PINNED_PANEL_UPDATE') {
    return 'OP_PANEL'
  }
  return 'ADMIN_ITEM'
}
