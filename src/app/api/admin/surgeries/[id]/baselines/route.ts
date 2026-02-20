/**
 * API route for updating "What's changed" baseline dates per surgery.
 * Super Admin only - allows setting baseline dates to filter out initial import noise.
 */

import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireSuperuser } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'

export const runtime = 'nodejs'

const updateBaselinesSchema = z.object({
  signpostingBaseline: z.string().nullable().optional(),
  practiceHandbookBaseline: z.string().nullable().optional(),
})

interface UiConfigWithBaselines {
  signposting?: {
    changesBaselineDate?: string
  }
  practiceHandbook?: {
    changesBaselineDate?: string
  }
  [key: string]: unknown
}

/**
 * GET /api/admin/surgeries/[id]/baselines
 * Returns the current baseline dates for a surgery.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperuser()
    const { id: surgeryId } = await params

    const surgery = await prisma.surgery.findUnique({
      where: { id: surgeryId },
      select: { id: true, name: true, uiConfig: true },
    })

    if (!surgery) {
      return NextResponse.json({ error: 'Surgery not found' }, { status: 404 })
    }

    const uiConfig = (surgery.uiConfig as UiConfigWithBaselines) ?? {}

    return NextResponse.json({
      surgeryId: surgery.id,
      surgeryName: surgery.name,
      signpostingBaseline: uiConfig.signposting?.changesBaselineDate ?? null,
      practiceHandbookBaseline: uiConfig.practiceHandbook?.changesBaselineDate ?? null,
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Superuser')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('Error fetching baseline dates:', error)
    return NextResponse.json({ error: 'Failed to fetch baseline dates' }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/surgeries/[id]/baselines
 * Updates the baseline dates for a surgery.
 * 
 * Body:
 *   signpostingBaseline: ISO date string or null to clear
 *   practiceHandbookBaseline: ISO date string or null to clear
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperuser()
    const { id: surgeryId } = await params

    const body = await request.json()
    const parsed = updateBaselinesSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      )
    }

    const { signpostingBaseline, practiceHandbookBaseline } = parsed.data

    // Get current surgery config
    const surgery = await prisma.surgery.findUnique({
      where: { id: surgeryId },
      select: { id: true, name: true, uiConfig: true },
    })

    if (!surgery) {
      return NextResponse.json({ error: 'Surgery not found' }, { status: 404 })
    }

    const currentConfig = (surgery.uiConfig as UiConfigWithBaselines) ?? {}

    // Build updated config
    const updatedConfig: UiConfigWithBaselines = { ...currentConfig }

    // Update signposting baseline
    if (signpostingBaseline !== undefined) {
      if (signpostingBaseline) {
        // Validate date
        const date = new Date(signpostingBaseline)
        if (isNaN(date.getTime())) {
          return NextResponse.json(
            { error: 'Invalid signposting baseline date' },
            { status: 400 }
          )
        }
        updatedConfig.signposting = {
          ...updatedConfig.signposting,
          changesBaselineDate: date.toISOString(),
        }
      } else {
        // Clear the baseline
        if (updatedConfig.signposting) {
          delete updatedConfig.signposting.changesBaselineDate
          if (Object.keys(updatedConfig.signposting).length === 0) {
            delete updatedConfig.signposting
          }
        }
      }
    }

    // Update practiceHandbook baseline
    if (practiceHandbookBaseline !== undefined) {
      if (practiceHandbookBaseline) {
        // Validate date
        const date = new Date(practiceHandbookBaseline)
        if (isNaN(date.getTime())) {
          return NextResponse.json(
            { error: 'Invalid practice handbook baseline date' },
            { status: 400 }
          )
        }
        updatedConfig.practiceHandbook = {
          ...updatedConfig.practiceHandbook,
          changesBaselineDate: date.toISOString(),
        }
      } else {
        // Clear the baseline
        if (updatedConfig.practiceHandbook) {
          delete updatedConfig.practiceHandbook.changesBaselineDate
          if (Object.keys(updatedConfig.practiceHandbook).length === 0) {
            delete updatedConfig.practiceHandbook
          }
        }
      }
    }

    // Update surgery
    await prisma.surgery.update({
      where: { id: surgeryId },
      data: { uiConfig: updatedConfig as import('@prisma/client').Prisma.InputJsonValue },
    })

    // Revalidate affected paths
    revalidatePath(`/s/${surgeryId}`)
    revalidatePath(`/s/${surgeryId}/admin-toolkit`)

    return NextResponse.json({
      success: true,
      signpostingBaseline: updatedConfig.signposting?.changesBaselineDate ?? null,
      practiceHandbookBaseline: updatedConfig.practiceHandbook?.changesBaselineDate ?? null,
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Superuser')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('Error updating baseline dates:', error)
    return NextResponse.json({ error: 'Failed to update baseline dates' }, { status: 500 })
  }
}
