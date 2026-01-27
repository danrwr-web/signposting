import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireSurgeryAdmin } from '@/lib/rbac'
import { isFeatureEnabledForSurgery } from '@/lib/features'

export const runtime = 'nodejs'

/**
 * Analytics API - Aggregated, practice-level analytics for governance and onboarding.
 * 
 * This endpoint provides high-level usage summaries across enabled modules:
 * - Signposting Toolkit
 * - Practice Handbook (admin_toolkit)
 * - Workflow Guidance (workflow_guidance)
 * 
 * Design principle: Visibility over surveillance.
 * - Shows aggregated views and staff presence, not individual performance.
 * - No rankings, scores, or "top users" language.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const surgeryId = searchParams.get('surgeryId')

    if (!surgeryId) {
      return NextResponse.json({ error: 'surgeryId is required' }, { status: 400 })
    }

    // Verify access - must be an admin of the surgery
    await requireSurgeryAdmin(surgeryId)

    // Check which modules are enabled
    const [handbookEnabled, workflowEnabled] = await Promise.all([
      isFeatureEnabledForSurgery(surgeryId, 'admin_toolkit'),
      isFeatureEnabledForSurgery(surgeryId, 'workflow_guidance'),
    ])

    // Signposting is always enabled
    const signpostingEnabled = true

    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    // Gather data for each enabled module in parallel
    const [
      signpostingData,
      handbookData,
      workflowData,
      staffUsageData,
    ] = await Promise.all([
      signpostingEnabled ? getSignpostingData(surgeryId, sevenDaysAgo, thirtyDaysAgo) : null,
      handbookEnabled ? getHandbookData(surgeryId, sevenDaysAgo, thirtyDaysAgo) : null,
      workflowEnabled ? getWorkflowData(surgeryId, sevenDaysAgo, thirtyDaysAgo) : null,
      getStaffUsageData(surgeryId, thirtyDaysAgo, signpostingEnabled, handbookEnabled, workflowEnabled),
    ])

    return NextResponse.json({
      enabledModules: {
        signposting: signpostingEnabled,
        handbook: handbookEnabled,
        workflow: workflowEnabled,
      },
      signposting: signpostingData,
      handbook: handbookData,
      workflow: workflowData,
      staffUsage: staffUsageData,
    })
  } catch (error) {
    console.error('Error fetching analytics data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analytics data' },
      { status: 500 }
    )
  }
}

/**
 * Signposting Toolkit data:
 * - Views (7d, 30d)
 * - Most used symptoms (top 5, 30d)
 * - Distinct staff count (30d)
 */
async function getSignpostingData(
  surgeryId: string,
  sevenDaysAgo: Date,
  thirtyDaysAgo: Date
) {
  // Views
  const [views7d, views30d] = await Promise.all([
    prisma.engagementEvent.count({
      where: {
        surgeryId,
        event: 'view_symptom',
        createdAt: { gte: sevenDaysAgo },
      },
    }),
    prisma.engagementEvent.count({
      where: {
        surgeryId,
        event: 'view_symptom',
        createdAt: { gte: thirtyDaysAgo },
      },
    }),
  ])

  // Most used symptoms (top 5, 30d)
  const topSymptomsGrouped = await prisma.engagementEvent.groupBy({
    by: ['baseId'],
    where: {
      surgeryId,
      event: 'view_symptom',
      createdAt: { gte: thirtyDaysAgo },
    },
    _count: { baseId: true },
    orderBy: { _count: { baseId: 'desc' } },
    take: 5,
  })

  const symptomIds = topSymptomsGrouped.map((item) => item.baseId)
  const symptoms = await prisma.baseSymptom.findMany({
    where: { id: { in: symptomIds } },
    select: { id: true, name: true },
  })

  const topSymptoms = topSymptomsGrouped.map((item) => {
    const symptom = symptoms.find((s) => s.id === item.baseId)
    return {
      id: item.baseId,
      name: symptom?.name ?? 'Unknown symptom',
      views: item._count.baseId,
    }
  })

  // Distinct staff count (30d) - using userEmail
  const distinctStaff = await prisma.engagementEvent.groupBy({
    by: ['userEmail'],
    where: {
      surgeryId,
      event: 'view_symptom',
      createdAt: { gte: thirtyDaysAgo },
      userEmail: { not: null },
    },
  })

  return {
    views7d,
    views30d,
    topSymptoms,
    distinctStaffCount: distinctStaff.length,
  }
}

/**
 * Practice Handbook data:
 * - Views (7d, 30d)
 * - Most viewed pages (top 5, 30d)
 * - Distinct staff count (30d)
 */
async function getHandbookData(
  surgeryId: string,
  sevenDaysAgo: Date,
  thirtyDaysAgo: Date
) {
  // Views
  const [views7d, views30d] = await Promise.all([
    prisma.adminToolkitEngagementEvent.count({
      where: {
        surgeryId,
        event: 'view_item',
        createdAt: { gte: sevenDaysAgo },
      },
    }),
    prisma.adminToolkitEngagementEvent.count({
      where: {
        surgeryId,
        event: 'view_item',
        createdAt: { gte: thirtyDaysAgo },
      },
    }),
  ])

  // Most viewed pages (top 5, 30d)
  const topPagesGrouped = await prisma.adminToolkitEngagementEvent.groupBy({
    by: ['adminItemId'],
    where: {
      surgeryId,
      event: 'view_item',
      createdAt: { gte: thirtyDaysAgo },
    },
    _count: { adminItemId: true },
    orderBy: { _count: { adminItemId: 'desc' } },
    take: 5,
  })

  const itemIds = topPagesGrouped.map((item) => item.adminItemId)
  const items = await prisma.adminItem.findMany({
    where: { id: { in: itemIds } },
    select: { id: true, title: true },
  })

  const topPages = topPagesGrouped.map((item) => {
    const page = items.find((i) => i.id === item.adminItemId)
    return {
      id: item.adminItemId,
      name: page?.title ?? 'Unknown page',
      views: item._count.adminItemId,
    }
  })

  // Distinct staff count (30d)
  const distinctStaff = await prisma.adminToolkitEngagementEvent.groupBy({
    by: ['userId'],
    where: {
      surgeryId,
      event: 'view_item',
      createdAt: { gte: thirtyDaysAgo },
    },
  })

  return {
    views7d,
    views30d,
    topPages,
    distinctStaffCount: distinctStaff.length,
  }
}

/**
 * Workflow Guidance data:
 * - Views (7d, 30d)
 * - Most viewed workflows (top 5, 30d)
 * - Distinct staff count (30d)
 */
async function getWorkflowData(
  surgeryId: string,
  sevenDaysAgo: Date,
  thirtyDaysAgo: Date
) {
  // Views
  const [views7d, views30d] = await Promise.all([
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

  // Most viewed workflows (top 5, 30d)
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

  // Distinct staff count (30d)
  const distinctStaff = await prisma.workflowEngagementEvent.groupBy({
    by: ['userId'],
    where: {
      surgeryId,
      event: 'view_workflow',
      createdAt: { gte: thirtyDaysAgo },
    },
  })

  return {
    views7d,
    views30d,
    topWorkflows,
    distinctStaffCount: distinctStaff.length,
  }
}

/**
 * Staff usage data across all enabled modules.
 * 
 * Returns one row per staff member with:
 * - Name and email
 * - Which modules they've accessed (presence only, not counts)
 * - Last active timestamp (most recent across all modules)
 * 
 * Sorted alphabetically by name.
 */
async function getStaffUsageData(
  surgeryId: string,
  thirtyDaysAgo: Date,
  signpostingEnabled: boolean,
  handbookEnabled: boolean,
  workflowEnabled: boolean
) {
  // Get all users with surgery membership
  const surgeryUsers = await prisma.userSurgery.findMany({
    where: { surgeryId },
    include: {
      user: {
        select: { id: true, name: true, email: true },
      },
    },
  })

  const userIds = surgeryUsers.map((u) => u.user.id)
  const userEmails = surgeryUsers.map((u) => u.user.email)

  // Build maps for module access
  const signpostingAccess = new Map<string, Date>()
  const handbookAccess = new Map<string, Date>()
  const workflowAccess = new Map<string, Date>()

  // Signposting - uses userEmail
  if (signpostingEnabled && userEmails.length > 0) {
    const signpostingEvents = await prisma.engagementEvent.groupBy({
      by: ['userEmail'],
      where: {
        surgeryId,
        event: 'view_symptom',
        createdAt: { gte: thirtyDaysAgo },
        userEmail: { in: userEmails },
      },
      _max: { createdAt: true },
    })

    // Map email back to userId
    const emailToUserId = new Map<string, string>(surgeryUsers.map((u) => [u.user.email, u.user.id]))
    for (const event of signpostingEvents) {
      const userEmail = event.userEmail as string | null
      const createdAt = event._max.createdAt
      if (userEmail && createdAt) {
        const userId = emailToUserId.get(userEmail)
        if (userId) {
          signpostingAccess.set(userId, createdAt)
        }
      }
    }
  }

  // Handbook - uses userId
  if (handbookEnabled && userIds.length > 0) {
    const handbookEvents = await prisma.adminToolkitEngagementEvent.groupBy({
      by: ['userId'],
      where: {
        surgeryId,
        event: 'view_item',
        createdAt: { gte: thirtyDaysAgo },
        userId: { in: userIds },
      },
      _max: { createdAt: true },
    })

    for (const event of handbookEvents) {
      if (event._max.createdAt) {
        handbookAccess.set(event.userId, event._max.createdAt)
      }
    }
  }

  // Workflow - uses userId
  if (workflowEnabled && userIds.length > 0) {
    const workflowEvents = await prisma.workflowEngagementEvent.groupBy({
      by: ['userId'],
      where: {
        surgeryId,
        event: 'view_workflow',
        createdAt: { gte: thirtyDaysAgo },
        userId: { in: userIds },
      },
      _max: { createdAt: true },
    })

    for (const event of workflowEvents) {
      if (event._max.createdAt) {
        workflowAccess.set(event.userId, event._max.createdAt)
      }
    }
  }

  // Build staff usage list
  const staffUsage = surgeryUsers
    .map((membership) => {
      const userId = membership.user.id
      const signpostingDate = signpostingAccess.get(userId)
      const handbookDate = handbookAccess.get(userId)
      const workflowDate = workflowAccess.get(userId)

      // Determine last active (most recent across all modules)
      const dates = [signpostingDate, handbookDate, workflowDate].filter(Boolean) as Date[]
      const lastActive = dates.length > 0 
        ? dates.reduce((latest, current) => current > latest ? current : latest)
        : null

      return {
        userId,
        name: membership.user.name ?? membership.user.email,
        email: membership.user.email,
        accessedSignposting: !!signpostingDate,
        accessedHandbook: !!handbookDate,
        accessedWorkflow: !!workflowDate,
        lastActiveAt: lastActive?.toISOString() ?? null,
      }
    })
    // Only include staff who have accessed at least one module
    .filter((staff) => staff.accessedSignposting || staff.accessedHandbook || staff.accessedWorkflow)
    // Sort alphabetically by name
    .sort((a, b) => a.name.localeCompare(b.name))

  return staffUsage
}
