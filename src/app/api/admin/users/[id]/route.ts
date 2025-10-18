import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser, requireSuperuser } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateUserSchema = z.object({
  globalRole: z.enum(['USER', 'SUPERUSER']).optional(),
  name: z.string().optional(),
  defaultSurgeryId: z.string().optional()
})

// PATCH /api/admin/users/[id] - Update user
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperuser()
    
    const { id } = await params
    const body = await request.json()
    const updateData = updateUserSchema.parse(body)

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id }
    })

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // If updating defaultSurgeryId, verify the surgery exists
    if (updateData.defaultSurgeryId) {
      const surgery = await prisma.surgery.findUnique({
        where: { id: updateData.defaultSurgeryId }
      })
      
      if (!surgery) {
        return NextResponse.json({ error: 'Surgery not found' }, { status: 400 })
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        memberships: {
          include: {
            surgery: true
          }
        },
        defaultSurgery: true
      }
    })

    return NextResponse.json(user)
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/admin/users/[id] - Delete user
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperuser()
    
    const { id } = await params

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id }
    })

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Prevent deleting the last superuser
    if (existingUser.globalRole === 'SUPERUSER') {
      const superuserCount = await prisma.user.count({
        where: { globalRole: 'SUPERUSER' }
      })
      
      if (superuserCount <= 1) {
        return NextResponse.json({ error: 'Cannot delete the last superuser' }, { status: 400 })
      }
    }

    await prisma.user.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
