import { NextRequest, NextResponse } from 'next/server'
import { requireSuperuser } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'

// DELETE /api/admin/users/[id]/memberships/[membershipId] - Remove surgery membership
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; membershipId: string }> }
) {
  try {
    await requireSuperuser()
    
    const resolvedParams = await params
    const { id: userId, membershipId } = resolvedParams

    // Check if membership exists and belongs to the user
    const membership = await prisma.userSurgery.findUnique({
      where: { 
        id: membershipId,
        userId 
      }
    })

    if (!membership) {
      return NextResponse.json({ 
        error: 'Membership not found or does not belong to this user' 
      }, { status: 404 })
    }

    // Delete membership
    await prisma.userSurgery.delete({
      where: { id: membershipId }
    })

    return NextResponse.json({ message: 'Membership removed successfully' })
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/admin/users/[id]/memberships/[membershipId] - Update membership role
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; membershipId: string }> }
) {
  try {
    await requireSuperuser()
    
    const resolvedParams = await params
    const { id: userId, membershipId } = resolvedParams
    const body = await request.json()
    const { role } = body

    if (!role || !['STANDARD', 'ADMIN'].includes(role)) {
      return NextResponse.json({ 
        error: 'Valid role (STANDARD or ADMIN) is required' 
      }, { status: 400 })
    }

    // Check if membership exists and belongs to the user
    const membership = await prisma.userSurgery.findUnique({
      where: { 
        id: membershipId,
        userId 
      }
    })

    if (!membership) {
      return NextResponse.json({ 
        error: 'Membership not found or does not belong to this user' 
      }, { status: 404 })
    }

    // Update membership role
    const updatedMembership = await prisma.userSurgery.update({
      where: { id: membershipId },
      data: { role },
      include: {
        surgery: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    return NextResponse.json(updatedMembership)
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
