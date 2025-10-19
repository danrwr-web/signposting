import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser, requireSurgeryAdmin } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateMemberSchema = z.object({
  role: z.enum(['STANDARD', 'ADMIN']).optional(),
  name: z.string().optional(),
  setAsDefault: z.boolean().optional()
})

// PATCH /api/s/[surgeryId]/members/[userId] - Update surgery member
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ surgeryId: string; userId: string }> }
) {
  try {
    const { surgeryId, userId } = await params
    await requireSurgeryAdmin(surgeryId)
    
    const body = await request.json()
    const { role, name, setAsDefault } = updateMemberSchema.parse(body)

    // Check if membership exists
    const membership = await prisma.userSurgery.findUnique({
      where: {
        userId_surgeryId: {
          userId,
          surgeryId
        }
      },
      include: {
        user: true
      }
    })

    if (!membership) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }

    // Update membership role if provided
    if (role) {
      await prisma.userSurgery.update({
        where: {
          userId_surgeryId: {
            userId,
            surgeryId
          }
        },
        data: { role }
      })
    }

    // Update user name if provided
    if (name !== undefined) {
      await prisma.user.update({
        where: { id: userId },
        data: { name: name || null }
      })
    }

    // Set as default surgery if requested
    if (setAsDefault) {
      await prisma.user.update({
        where: { id: userId },
        data: { defaultSurgeryId: surgeryId }
      })
    }

    // Return updated membership
    const updatedMembership = await prisma.userSurgery.findUnique({
      where: {
        userId_surgeryId: {
          userId,
          surgeryId
        }
      },
      include: {
        user: true
      }
    })

    return NextResponse.json(updatedMembership)
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

// DELETE /api/s/[surgeryId]/members/[userId] - Remove user from surgery
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ surgeryId: string; userId: string }> }
) {
  try {
    const { surgeryId, userId } = await params
    await requireSurgeryAdmin(surgeryId)
    
    // Check if membership exists
    const membership = await prisma.userSurgery.findUnique({
      where: {
        userId_surgeryId: {
          userId,
          surgeryId
        }
      }
    })

    if (!membership) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
    }

    // Remove membership
    await prisma.userSurgery.delete({
      where: {
        userId_surgeryId: {
          userId,
          surgeryId
        }
      }
    })

    // If this was the user's default surgery, clear it
    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (user?.defaultSurgeryId === surgeryId) {
      await prisma.user.update({
        where: { id: userId },
        data: { defaultSurgeryId: null }
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
