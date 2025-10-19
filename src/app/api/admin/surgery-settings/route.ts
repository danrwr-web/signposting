/**
 * Surgery settings API route
 * Handles surgery-specific settings updates (surgery admin only)
 */

import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export const runtime = 'nodejs'

const updateSurgerySettingsSchema = z.object({
  enableBuiltInHighlights: z.boolean().optional(),
})

// PATCH /api/admin/surgery-settings - Update surgery settings
export async function PATCH(request: NextRequest) {
  try {
    const user = await getSessionUser()
    console.log('Surgery settings API - User:', user)
    
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
    
    console.log('Surgery settings API - targetSurgeryId:', targetSurgeryId, 'user role:', user.globalRole)
    
    if (!targetSurgeryId) {
      console.log('Surgery settings API - No surgeryId found')
      return NextResponse.json(
        { error: 'Unauthorized - surgery admin access required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const updateData = updateSurgerySettingsSchema.parse(body)

    // Prepare update data
    const data: any = {}
    if (updateData.enableBuiltInHighlights !== undefined) {
      data.enableBuiltInHighlights = updateData.enableBuiltInHighlights
    }

    // Update the surgery settings
    // Note: Using raw SQL to avoid Prisma client generation issues
    const updateQuery = `
      UPDATE "Surgery" 
      SET ${Object.keys(data).map((key, index) => `"${key}" = $${index + 2}`).join(', ')}, "updatedAt" = NOW()
      WHERE id = $1
      RETURNING id, name, "enableBuiltInHighlights", "updatedAt"
    `
    
    const updateValues = [targetSurgeryId, ...Object.values(data)]
    console.log('Surgery settings API - Update query:', updateQuery)
    console.log('Surgery settings API - Update values:', updateValues)
    
    const result = await prisma.$queryRawUnsafe(updateQuery, ...updateValues) as any[]
    console.log('Surgery settings API - Query result:', result)
    
    if (result.length === 0) {
      console.log('Surgery settings API - No surgery found with ID:', targetSurgeryId)
      return NextResponse.json(
        { error: 'Surgery not found' },
        { status: 404 }
      )
    }
    
    const surgery = result[0]

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
