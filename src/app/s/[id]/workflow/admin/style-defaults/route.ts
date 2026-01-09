import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'
import { revalidatePath } from 'next/cache'
import { WorkflowNodeType } from '@prisma/client'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: {
    id: string
  }
}

/**
 * GET /s/[id]/workflow/admin/style-defaults
 * Get surgery-level style defaults
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: surgeryId } = params

    // Check superuser access
    const user = await getSessionUser()
    if (!user || user.globalRole !== 'SUPERUSER') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Superuser access required' },
        { status: 403 }
      )
    }

    // Verify surgery exists
    const surgery = await prisma.surgery.findUnique({
      where: { id: surgeryId },
      select: { id: true },
    })

    if (!surgery) {
      return NextResponse.json(
        { success: false, error: 'Surgery not found' },
        { status: 404 }
      )
    }

    // Fetch surgery defaults
    const defaults = await prisma.workflowNodeStyleDefaultSurgery.findMany({
      where: { surgeryId },
      select: {
        nodeType: true,
        bgColor: true,
        textColor: true,
        borderColor: true,
      },
    })

    return NextResponse.json({ success: true, defaults })
  } catch (error) {
    console.error('Error fetching surgery style defaults:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch style defaults',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /s/[id]/workflow/admin/style-defaults
 * Upsert a surgery-level style default for a specific node type
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: surgeryId } = params

    // Check superuser access
    const user = await getSessionUser()
    if (!user || user.globalRole !== 'SUPERUSER') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Superuser access required' },
        { status: 403 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { nodeType, bgColor, textColor, borderColor } = body

    // Validate nodeType
    const validNodeTypes: WorkflowNodeType[] = ['INSTRUCTION', 'QUESTION', 'END', 'PANEL', 'REFERENCE']
    if (!validNodeTypes.includes(nodeType)) {
      return NextResponse.json(
        { success: false, error: 'Invalid node type' },
        { status: 400 }
      )
    }

    // Verify surgery exists
    const surgery = await prisma.surgery.findUnique({
      where: { id: surgeryId },
      select: { id: true },
    })

    if (!surgery) {
      return NextResponse.json(
        { success: false, error: 'Surgery not found' },
        { status: 404 }
      )
    }

    // Upsert style default
    await prisma.workflowNodeStyleDefaultSurgery.upsert({
      where: {
        surgeryId_nodeType: {
          surgeryId,
          nodeType,
        },
      },
      update: {
        bgColor: bgColor || null,
        textColor: textColor || null,
        borderColor: borderColor || null,
      },
      create: {
        surgeryId,
        nodeType,
        bgColor: bgColor || null,
        textColor: textColor || null,
        borderColor: borderColor || null,
      },
    })

    // Revalidate paths
    revalidatePath(`/s/${surgeryId}/workflow/admin/styles`)
    revalidatePath(`/s/${surgeryId}/workflow/templates`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error upserting surgery style default:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update style default',
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /s/[id]/workflow/admin/style-defaults
 * Reset surgery-level style defaults (optionally for a specific node type)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: surgeryId } = params

    // Check superuser access
    const user = await getSessionUser()
    if (!user || user.globalRole !== 'SUPERUSER') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Superuser access required' },
        { status: 403 }
      )
    }

    // Parse query params for optional nodeType
    const { searchParams } = new URL(request.url)
    const nodeType = searchParams.get('nodeType') as WorkflowNodeType | null

    // Verify surgery exists
    const surgery = await prisma.surgery.findUnique({
      where: { id: surgeryId },
      select: { id: true },
    })

    if (!surgery) {
      return NextResponse.json(
        { success: false, error: 'Surgery not found' },
        { status: 404 }
      )
    }

    // Delete style defaults
    if (nodeType) {
      // Reset single node type
      await prisma.workflowNodeStyleDefaultSurgery.deleteMany({
        where: {
          surgeryId,
          nodeType,
        },
      })
    } else {
      // Reset all node types
      await prisma.workflowNodeStyleDefaultSurgery.deleteMany({
        where: {
          surgeryId,
        },
      })
    }

    // Revalidate paths
    revalidatePath(`/s/${surgeryId}/workflow/admin/styles`)
    revalidatePath(`/s/${surgeryId}/workflow/templates`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error resetting surgery style defaults:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reset style defaults',
      },
      { status: 500 }
    )
  }
}

