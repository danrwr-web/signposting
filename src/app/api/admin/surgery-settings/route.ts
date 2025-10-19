/**
 * Surgery settings API route
 * Handles surgery-specific settings updates (surgery admin only)
 */

import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/server/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export const runtime = 'nodejs'

const updateSurgerySettingsSchema = z.object({
  enableBuiltInHighlights: z.boolean().optional(),
})

// PATCH /api/admin/surgery-settings - Update surgery settings
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession()
    console.log('Surgery settings API - Session:', session)
    
    // Check if user is logged in and has surgery access
    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // For surgery admins, they must have a surgeryId
    // For superusers, they can access any surgery
    const targetSurgeryId = session.surgeryId
    if (!targetSurgeryId && session.type !== 'superuser') {
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
    const surgery = await prisma.surgery.update({
      where: { id: targetSurgeryId },
      data,
      select: {
        id: true,
        name: true,
        enableBuiltInHighlights: true,
        updatedAt: true,
      } as any, // Temporary type assertion
    })

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
