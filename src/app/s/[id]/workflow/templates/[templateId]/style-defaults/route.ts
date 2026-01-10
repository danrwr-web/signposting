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
    templateId: string
  }
}

/**
 * POST /s/[id]/workflow/templates/[templateId]/style-defaults
 * Upsert a template style default for a specific node type
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: surgeryId, templateId } = params

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

    // Verify template belongs to surgery
    const template = await prisma.workflowTemplate.findFirst({
      where: { id: templateId, surgeryId },
    })

    if (!template) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 }
      )
    }

    // Upsert style default
    await prisma.workflowNodeStyleDefault.upsert({
      where: {
        templateId_nodeType: {
          templateId,
          nodeType,
        },
      },
      update: {
        bgColor: bgColor || null,
        textColor: textColor || null,
        borderColor: borderColor || null,
      },
      create: {
        templateId,
        nodeType,
        bgColor: bgColor || null,
        textColor: textColor || null,
        borderColor: borderColor || null,
      },
    })

    // Revalidate paths
    revalidatePath(`/s/${surgeryId}/workflow/templates/${templateId}/view`)
    revalidatePath(`/s/${surgeryId}/workflow/templates/${templateId}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error upserting template style default:', error)
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
 * DELETE /s/[id]/workflow/templates/[templateId]/style-defaults
 * Reset template style defaults (optionally for a specific node type)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: surgeryId, templateId } = params

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

    // Verify template belongs to surgery
    const template = await prisma.workflowTemplate.findFirst({
      where: { id: templateId, surgeryId },
    })

    if (!template) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 }
      )
    }

    // Delete style defaults
    if (nodeType) {
      // Reset single node type
      await prisma.workflowNodeStyleDefault.deleteMany({
        where: {
          templateId,
          nodeType,
        },
      })
    } else {
      // Reset all node types
      await prisma.workflowNodeStyleDefault.deleteMany({
        where: {
          templateId,
        },
      })
    }

    // Revalidate paths
    revalidatePath(`/s/${surgeryId}/workflow/templates/${templateId}/view`)
    revalidatePath(`/s/${surgeryId}/workflow/templates/${templateId}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error resetting template style defaults:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reset style defaults',
      },
      { status: 500 }
    )
  }
}

