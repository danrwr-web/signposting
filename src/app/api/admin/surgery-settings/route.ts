/**
 * Surgery settings API route
 * Handles surgery-specific settings updates (surgery admin only)
 */

import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { validateCommonReasonsConfig, CommonReasonsConfig, UiConfig } from '@/lib/commonReasons'
import { revalidatePath } from 'next/cache'

export const runtime = 'nodejs'

// GET /api/admin/surgery-settings - Get surgery settings
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    let targetSurgeryId: string | null = null
    
    if (user.globalRole === 'SUPERUSER') {
      const url = new URL(request.url)
      const surgeryParam = url.searchParams.get('surgeryId')
      if (surgeryParam) {
        targetSurgeryId = surgeryParam
      } else {
        const firstSurgery = await prisma.surgery.findFirst()
        targetSurgeryId = firstSurgery?.id || null
      }
    } else {
      const adminMembership = user.memberships.find(m => m.role === 'ADMIN')
      targetSurgeryId = adminMembership?.surgeryId || null
    }
    
    if (!targetSurgeryId) {
      return NextResponse.json(
        { error: 'Unauthorized - surgery admin access required' },
        { status: 401 }
      )
    }

    const surgery = await prisma.surgery.findUnique({
      where: { id: targetSurgeryId },
      select: {
        id: true,
        name: true,
        enableBuiltInHighlights: true,
        enableImageIcons: true,
        uiConfig: true,
      }
    })

    if (!surgery) {
      return NextResponse.json(
        { error: 'Surgery not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ surgery })
  } catch (error) {
    console.error('Error fetching surgery settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch surgery settings' },
      { status: 500 }
    )
  }
}

const updateSurgerySettingsSchema = z.object({
  enableBuiltInHighlights: z.boolean().optional(),
  enableImageIcons: z.boolean().optional(),
  commonReasons: z.object({
    commonReasonsEnabled: z.boolean(),
    commonReasonsMax: z.number().min(0).max(20),
    // New format: items array with optional labels
    items: z.array(z.object({
      symptomId: z.string(),
      label: z.string().optional().nullable(),
    })).optional(),
    // Legacy format: symptomIds array (for backward compatibility)
    commonReasonsSymptomIds: z.array(z.string()).optional(),
  }).optional(),
})

// PATCH /api/admin/surgery-settings - Update surgery settings
export async function PATCH(request: NextRequest) {
  try {
    const user = await getSessionUser()
    
    // Check if user is logged in
    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // For surgery admins, get surgery ID from their admin membership
    // For superusers, they can access any surgery (but we need a surgery ID)
    let targetSurgeryId: string | null = null
    
    if (user.globalRole === 'SUPERUSER') {
      // For superusers, we need to get surgery ID from request or use first available
      const url = new URL(request.url)
      const surgeryParam = url.searchParams.get('surgeryId')
      if (surgeryParam) {
        targetSurgeryId = surgeryParam
      } else {
        // Use first available surgery for superuser
        const firstSurgery = await prisma.surgery.findFirst()
        targetSurgeryId = firstSurgery?.id || null
      }
    } else {
      // For surgery admins, use their admin surgery ID
      const adminMembership = user.memberships.find(m => m.role === 'ADMIN')
      targetSurgeryId = adminMembership?.surgeryId || null
    }
    
    if (!targetSurgeryId) {
      return NextResponse.json(
        { error: 'Unauthorized - surgery admin access required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const updateData = updateSurgerySettingsSchema.parse(body)

    // Validate common reasons config if provided
    if (updateData.commonReasons) {
      const validation = validateCommonReasonsConfig(updateData.commonReasons)
      if (!validation.valid) {
        return NextResponse.json(
          { error: 'Invalid common reasons config', details: validation.errors },
          { status: 400 }
        )
      }
    }

    // Get current surgery to preserve existing uiConfig
    const currentSurgery = await prisma.surgery.findUnique({
      where: { id: targetSurgeryId },
      select: { uiConfig: true }
    })

    // Prepare update data
    const data: any = {}
    if (updateData.enableBuiltInHighlights !== undefined) {
      data.enableBuiltInHighlights = updateData.enableBuiltInHighlights
    }
    if (updateData.enableImageIcons !== undefined) {
      data.enableImageIcons = updateData.enableImageIcons
    }

    // Handle uiConfig update
    if (updateData.commonReasons) {
      const currentUiConfig = (currentSurgery?.uiConfig as UiConfig | null) || {}
      
      // Prefer new format (items) if provided, otherwise use legacy format (symptomIds)
      let items: Array<{ symptomId: string; label?: string | null }> | undefined
      if (updateData.commonReasons.items && Array.isArray(updateData.commonReasons.items)) {
        // Normalize: trim labels, convert empty strings to undefined, deduplicate by symptomId
        const seen = new Set<string>()
        items = updateData.commonReasons.items
          .filter(item => {
            if (!item.symptomId || seen.has(item.symptomId)) return false
            seen.add(item.symptomId)
            return true
          })
          .map(item => {
            let label = item.label?.trim()
            if (label) {
              // Collapse multiple internal spaces to single space
              label = label.replace(/\s+/g, ' ')
            }
            return {
              symptomId: item.symptomId,
              label: label || undefined
            }
          })
      } else if (updateData.commonReasons.commonReasonsSymptomIds && Array.isArray(updateData.commonReasons.commonReasonsSymptomIds)) {
        // Legacy format: convert to items
        const seen = new Set<string>()
        items = updateData.commonReasons.commonReasonsSymptomIds
          .filter(id => {
            if (!id || seen.has(id)) return false
            seen.add(id)
            return true
          })
          .map(id => ({ symptomId: id }))
      }

      const updatedUiConfig: UiConfig = {
        ...currentUiConfig,
        commonReasons: {
          commonReasonsEnabled: updateData.commonReasons.commonReasonsEnabled,
          commonReasonsMax: updateData.commonReasons.commonReasonsMax,
          ...(items ? { items } : {}),
        }
      }
      data.uiConfig = updatedUiConfig
    }

    // Update the surgery settings
    // Note: Using raw SQL to avoid Prisma client generation issues
    const updateFields = Object.keys(data).map((key, index) => {
      if (key === 'uiConfig') {
        return `"${key}" = $${index + 2}::jsonb`
      }
      return `"${key}" = $${index + 2}`
    }).join(', ')

    const updateQuery = `
      UPDATE "Surgery" 
      SET ${updateFields}, "updatedAt" = NOW()
      WHERE id = $1
      RETURNING id, name, "enableBuiltInHighlights", "enableImageIcons", "uiConfig", "updatedAt"
    `
    
    const updateValues = [targetSurgeryId, ...Object.values(data)]
    const result = await prisma.$queryRawUnsafe(updateQuery, ...updateValues) as any[]
    
    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Surgery not found' },
        { status: 404 }
      )
    }
    
    const surgery = result[0]

    // Revalidate affected paths to reflect UI config changes immediately
    revalidatePath(`/s/${targetSurgeryId}`)
    revalidatePath(`/s/${targetSurgeryId}/`)
    revalidatePath('/admin')

    return NextResponse.json({ surgery })
  } catch (error) {
    console.error('Error updating surgery settings:', error)
    
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid request format' },
        { status: 400 }
      )
    }
    
    if (error instanceof Error && error.message.includes('Record to update not found')) {
      return NextResponse.json(
        { error: 'Surgery not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to update surgery settings',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
