import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'
import { revalidatePath } from 'next/cache'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: {
    id: string
    templateId: string
  }
}

/**
 * POST /s/[id]/workflow/templates/[templateId]/style-defaults/copy
 * Copy style defaults from one template to another
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
    const { sourceTemplateId, overwrite } = body

    if (!sourceTemplateId) {
      return NextResponse.json(
        { success: false, error: 'Source template ID is required' },
        { status: 400 }
      )
    }

    // Verify both templates belong to the same surgery
    const targetTemplate = await prisma.workflowTemplate.findFirst({
      where: { id: templateId, surgeryId },
      select: { id: true },
    })

    if (!targetTemplate) {
      return NextResponse.json(
        { success: false, error: 'Target template not found' },
        { status: 404 }
      )
    }

    const sourceTemplate = await prisma.workflowTemplate.findFirst({
      where: { id: sourceTemplateId, surgeryId },
      select: { id: true },
    })

    if (!sourceTemplate) {
      return NextResponse.json(
        { success: false, error: 'Source template not found' },
        { status: 404 }
      )
    }

    // Fetch source template defaults
    const sourceDefaults = await prisma.workflowNodeStyleDefault.findMany({
      where: { templateId: sourceTemplateId },
      select: {
        nodeType: true,
        bgColor: true,
        textColor: true,
        borderColor: true,
      },
    })

    // Copy to target template
    for (const sourceDefault of sourceDefaults) {
      if (overwrite) {
        // Overwrite: upsert (will replace existing)
        await prisma.workflowNodeStyleDefault.upsert({
          where: {
            templateId_nodeType: {
              templateId,
              nodeType: sourceDefault.nodeType,
            },
          },
          update: {
            bgColor: sourceDefault.bgColor,
            textColor: sourceDefault.textColor,
            borderColor: sourceDefault.borderColor,
          },
          create: {
            templateId,
            nodeType: sourceDefault.nodeType,
            bgColor: sourceDefault.bgColor,
            textColor: sourceDefault.textColor,
            borderColor: sourceDefault.borderColor,
          },
        })
      } else {
        // Don't overwrite: only create if doesn't exist
        const existing = await prisma.workflowNodeStyleDefault.findUnique({
          where: {
            templateId_nodeType: {
              templateId,
              nodeType: sourceDefault.nodeType,
            },
          },
        })

        if (!existing) {
          await prisma.workflowNodeStyleDefault.create({
            data: {
              templateId,
              nodeType: sourceDefault.nodeType,
              bgColor: sourceDefault.bgColor,
              textColor: sourceDefault.textColor,
              borderColor: sourceDefault.borderColor,
            },
          })
        }
      }
    }

    // Revalidate paths
    revalidatePath(`/s/${surgeryId}/workflow/admin/styles`)
    revalidatePath(`/s/${surgeryId}/workflow/templates/${templateId}/view`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error copying template style defaults:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to copy defaults',
      },
      { status: 500 }
    )
  }
}

