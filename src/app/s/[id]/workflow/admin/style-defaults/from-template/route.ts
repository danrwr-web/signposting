import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'
import { revalidatePath } from 'next/cache'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: {
    id: string
  }
}

/**
 * POST /s/[id]/workflow/admin/style-defaults/from-template
 * Copy template defaults to surgery defaults
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
    const { templateId } = body

    if (!templateId) {
      return NextResponse.json(
        { success: false, error: 'Template ID is required' },
        { status: 400 }
      )
    }

    // Verify surgery and template belong to surgery
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

    const template = await prisma.workflowTemplate.findFirst({
      where: { id: templateId, surgeryId },
      select: { id: true },
    })

    if (!template) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 }
      )
    }

    // Fetch template defaults
    const templateDefaults = await prisma.workflowNodeStyleDefault.findMany({
      where: { templateId },
      select: {
        nodeType: true,
        bgColor: true,
        textColor: true,
        borderColor: true,
      },
    })

    // Copy to surgery defaults (upsert for each node type)
    for (const templateDefault of templateDefaults) {
      await prisma.workflowNodeStyleDefaultSurgery.upsert({
        where: {
          surgeryId_nodeType: {
            surgeryId,
            nodeType: templateDefault.nodeType,
          },
        },
        update: {
          bgColor: templateDefault.bgColor,
          textColor: templateDefault.textColor,
          borderColor: templateDefault.borderColor,
        },
        create: {
          surgeryId,
          nodeType: templateDefault.nodeType,
          bgColor: templateDefault.bgColor,
          textColor: templateDefault.textColor,
          borderColor: templateDefault.borderColor,
        },
      })
    }

    // Revalidate paths
    revalidatePath(`/s/${surgeryId}/workflow/admin/styles`)
    revalidatePath(`/s/${surgeryId}/workflow/templates`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error copying template defaults to surgery:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to copy defaults',
      },
      { status: 500 }
    )
  }
}

