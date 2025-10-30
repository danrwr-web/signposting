import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/server/auth'
import { prisma } from '@/lib/prisma'
import { unlink } from 'fs/promises'
import { join } from 'path'
import { z } from 'zod'

const updateImageIconSchema = z.object({
  isEnabled: z.boolean().optional(),
  cardSize: z.enum(['small', 'medium', 'large']).optional(),
  instructionSize: z.enum(['small', 'medium', 'large']).optional(),
  alt: z.string().optional()
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    const { id } = await params
    
    // AuthZ: superusers can update all fields; surgery admins may only toggle isEnabled
    if (!session || (session.type !== 'superuser' && session.type !== 'surgery')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const updateData = updateImageIconSchema.parse(body)

    // Build update object with only provided fields
    const updateFields: any = {}
    if (updateData.isEnabled !== undefined) {
      updateFields.isEnabled = updateData.isEnabled
    }
    if (updateData.cardSize !== undefined) {
      updateFields.cardSize = updateData.cardSize
    }
    if (updateData.instructionSize !== undefined) {
      updateFields.instructionSize = updateData.instructionSize
    }
    if (updateData.alt !== undefined) {
      updateFields.alt = updateData.alt
    }

    // Enforce field-level permissions for surgery admins
    if (session.type === 'surgery') {
      const allowedKeys = ['isEnabled']
      const requestedKeys = Object.keys(updateFields)
      const isOnlyToggle = requestedKeys.length === 1 && allowedKeys.includes(requestedKeys[0])
      if (!isOnlyToggle) {
        return NextResponse.json(
          { error: 'Unauthorized - superuser required for this change' },
          { status: 403 }
        )
      }
    }

    const icon = await (prisma as any).imageIcon.update({
      where: { id },
      data: updateFields
    })

    return NextResponse.json({ icon })
  } catch (error) {
    console.error('Error updating image icon:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request format' },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to update image icon' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    const { id } = await params
    
    // Only superusers can delete
    if (!session || session.type !== 'superuser') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const icon = await (prisma as any).imageIcon.findUnique({
      where: { id }
    })

    if (!icon) {
      return NextResponse.json(
        { error: 'Image icon not found' },
        { status: 404 }
      )
    }

    // Delete file from filesystem (if applicable)
    if (icon.filePath) {
      try {
        await unlink(icon.filePath)
      } catch (error) {
        console.warn('Failed to delete file:', error)
      }
    }

    // Delete from database
    await (prisma as any).imageIcon.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting image icon:', error)
    return NextResponse.json(
      { error: 'Failed to delete image icon' },
      { status: 500 }
    )
  }
}
