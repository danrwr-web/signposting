import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSurgeryAccess, can } from '@/lib/rbac'

export const runtime = 'nodejs'

type TimeWindow = '7d' | '30d'

function getStartDateFromWindow(window: TimeWindow): Date {
  const now = new Date()
  switch (window) {
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const surgeryId = searchParams.get('surgeryId')

    if (!surgeryId) {
      return NextResponse.json({ error: 'surgeryId is required' }, { status: 400 })
    }

    // Verify access - must be an admin of the surgery
    const user = await requireSurgeryAccess(surgeryId)
    if (!can(user).isAdminOfSurgery(surgeryId)) {
      return NextResponse.json({ error: 'Not authorised' }, { status: 403 })
    }

    const now = new Date()
    const sevenDaysAgo = getStartDateFromWindow('7d')
    const thirtyDaysAgo = getStartDateFromWindow('30d')

    // Get total views for last 7 days and last 30 days
    const [totalViews7d, totalViews30d] = await Promise.all([
      prisma.workflowEngagementEvent.count({
        where: {
          surgeryId,
          event: 'view_workflow',
          createdAt: { gte: sevenDaysAgo },
        },
      }),
      prisma.workflowEngagementEvent.count({
        where: {
          surgeryId,
          event: 'view_workflow',
          createdAt: { gte: thirtyDaysAgo },
        },
      }),
    ])

    // Get most viewed workflows (30 days, top 5)
    const topWorkflowsGrouped = await prisma.workflowEngagementEvent.groupBy({
      by: ['templateId'],
      where: {
        surgeryId,
        event: 'view_workflow',
        createdAt: { gte: thirtyDaysAgo },
      },
      _count: { templateId: true },
      orderBy: { _count: { templateId: 'desc' } },
      take: 5,
    })

    // Get template details in a single query to avoid N+1
    const templateIds = topWorkflowsGrouped.map((item) => item.templateId)
    const templates = await prisma.workflowTemplate.findMany({
      where: { id: { in: templateIds } },
      select: { id: true, name: true },
    })

    const topWorkflows = topWorkflowsGrouped.map((item) => {
      const template = templates.find((t) => t.id === item.templateId)
      return {
        id: item.templateId,
        name: template?.name ?? 'Unknown workflow',
        views: item._count.templateId,
      }
    })

    // Get recently viewed workflows (7 days, top 10 distinct, with most recent timestamp)
    const recentViewsRaw = await prisma.workflowEngagementEvent.findMany({
      where: {
        surgeryId,
        event: 'view_workflow',
        createdAt: { gte: sevenDaysAgo },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        templateId: true,
        createdAt: true,
      },
    })

    // Deduplicate by templateId, keeping the most recent view
    const recentByTemplate = new Map<string, Date>()
    for (const view of recentViewsRaw) {
      if (!recentByTemplate.has(view.templateId)) {
        recentByTemplate.set(view.templateId, view.createdAt)
      }
    }

    // Get top 10 most recently viewed
    const recentTemplateIds = Array.from(recentByTemplate.entries())
      .sort((a, b) => b[1].getTime() - a[1].getTime())
      .slice(0, 10)
      .map(([id]) => id)

    // Fetch template names for recent views
    const recentTemplates = await prisma.workflowTemplate.findMany({
      where: { id: { in: recentTemplateIds } },
      select: { id: true, name: true },
    })

    const recentWorkflows = recentTemplateIds.map((templateId) => {
      const template = recentTemplates.find((t) => t.id === templateId)
      const lastViewed = recentByTemplate.get(templateId)
      return {
        id: templateId,
        name: template?.name ?? 'Unknown workflow',
        lastViewedAt: lastViewed?.toISOString() ?? now.toISOString(),
      }
    })

    return NextResponse.json({
      totalViews7d,
      totalViews30d,
      topWorkflows,
      recentWorkflows,
    })
  } catch (error) {
    console.error('Error fetching workflow engagement data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch engagement data' },
      { status: 500 }
    )
  }
}
