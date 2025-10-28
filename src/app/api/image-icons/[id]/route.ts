import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/server/auth'
import { prisma } from '@/lib/prisma'
import { unlink } from 'fs/promises'
import { join } from 'path'

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
