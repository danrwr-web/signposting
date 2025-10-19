import { NextRequest, NextResponse } from 'next/server'
import { requireSuperuser } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const addMembershipSchema = z.object({
  surgeryId: z.string().min(1, 'Surgery ID is required'),
  role: z.enum(['STANDARD', 'ADMIN']).default('STANDARD')
})

const updateMembershipSchema = z.object({
  role: z.enum(['STANDARD', 'ADMIN'])
})

// POST /api/admin/users/[id]/memberships - Add surgery membership
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperuser()
    
    const resolvedParams = await params
    const { id: userId } = resolvedParams
    const body = await request.json()
    const { surgeryId, role } = addMembershipSchema.parse(body)

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check if surgery exists
    const surgery = await prisma.surgery.findUnique({
      where: { id: surgeryId }
    })

    if (!surgery) {
      return NextResponse.json({ error: 'Surgery not found' }, { status: 400 })
    }

    // Check if membership already exists
    const existingMembership = await prisma.userSurgery.findUnique({
      where: {
        userId_surgeryId: {
          userId,
          surgeryId
        }
      }
    })

    if (existingMembership) {
      return NextResponse.json({ 
        error: 'User already has access to this surgery' 
      }, { status: 400 })
    }

    // Create membership
    const membership = await prisma.userSurgery.create({
      data: {
        userId,
        surgeryId,
        role
      },
      include: {
        surgery: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    return NextResponse.json(membership, { status: 201 })
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

// GET /api/admin/users/[id]/memberships - Get user memberships
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperuser()
    
    const resolvedParams = await params
    const { id: userId } = resolvedParams

    const memberships = await prisma.userSurgery.findMany({
      where: { userId },
      include: {
        surgery: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    return NextResponse.json(memberships)
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
