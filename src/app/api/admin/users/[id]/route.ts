import { NextRequest, NextResponse } from 'next/server'
import { requireSuperuser } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateUserSchema = z.object({
  name: z.string().optional(),
  globalRole: z.enum(['USER', 'SUPERUSER']).optional(),
  defaultSurgeryId: z.string().optional()
})

// PATCH /api/admin/users/[id] - Update user
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperuser()
    
    const resolvedParams = await params
    const { id } = resolvedParams
    const body = await request.json()
    const { name, globalRole, defaultSurgeryId } = updateUserSchema.parse(body)

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id }
    })

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // If updating defaultSurgeryId, validate that the surgery exists
    if (defaultSurgeryId) {
      const surgery = await prisma.surgery.findUnique({
        where: { id: defaultSurgeryId }
      })
      if (!surgery) {
        return NextResponse.json({ error: 'Surgery not found' }, { status: 400 })
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(globalRole !== undefined && { globalRole }),
        ...(defaultSurgeryId !== undefined && { defaultSurgeryId })
      },
      include: {
        memberships: {
          include: {
            surgery: true
          }
        },
        defaultSurgery: true
      }
    })

    return NextResponse.json(updatedUser)
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
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
    
    const resolvedParams = await params
    const { id } = resolvedParams

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id }
    })

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Prevent deletion of the last superuser
    if (existingUser.globalRole === 'SUPERUSER') {
      const superuserCount = await prisma.user.count({
        where: { globalRole: 'SUPERUSER' }
      })
      
      if (superuserCount <= 1) {
        return NextResponse.json({ 
          error: 'Cannot delete the last superuser' 
        }, { status: 400 })
      }
    }

    // Delete user (cascade will handle memberships)
    await prisma.user.delete({
      where: { id }
    })

    return NextResponse.json({ message: 'User deleted successfully' })
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}