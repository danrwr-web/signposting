import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { unlink } from 'fs/promises'
import { join } from 'path'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession()
    const { id } = await params
    
    // Only superusers can delete
    if (!session || session.type !== 'superuser') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const icon = await prisma.imageIcon.findUnique({
      where: { id }
    })

    if (!icon) {
      return NextResponse.json(
        { error: 'Image icon not found' },
        { status: 404 }
      )
    }

    // Delete file from filesystem
    try {
      await unlink(icon.filePath)
    } catch (error) {
      console.warn('Failed to delete file:', error)
    }

    // Delete from database
    await prisma.imageIcon.delete({
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
