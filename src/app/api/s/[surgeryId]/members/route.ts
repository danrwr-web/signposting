import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser, requireSurgeryAdmin } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import bcrypt from 'bcryptjs'

const addMemberSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  password: z.string().min(1, 'Password is required'),
  role: z.enum(['STANDARD', 'ADMIN']).default('STANDARD')
})

const updateMemberSchema = z.object({
  role: z.enum(['STANDARD', 'ADMIN']).optional(),
  name: z.string().optional(),
  setAsDefault: z.boolean().optional()
})

// GET /api/s/[surgeryId]/members - List surgery members
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ surgeryId: string }> }
) {
  try {
    const { surgeryId } = await params
    await requireSurgeryAdmin(surgeryId)
    
    const surgery = await prisma.surgery.findUnique({
      where: { id: surgeryId },
      include: {
        users: {
          include: {
            user: true
          }
        }
      }
    })

    if (!surgery) {
      return NextResponse.json({ error: 'Surgery not found' }, { status: 404 })
    }

    return NextResponse.json(surgery.users)
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/s/[surgeryId]/members - Add user to surgery
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ surgeryId: string }> }
) {
  try {
    const { surgeryId } = await params
    await requireSurgeryAdmin(surgeryId)
    
    const body = await request.json()
    const { email, name, password, role } = addMemberSchema.parse(body)

    // Check if surgery exists
    const surgery = await prisma.surgery.findUnique({
      where: { id: surgeryId }
    })

    if (!surgery) {
      return NextResponse.json({ error: 'Surgery not found' }, { status: 404 })
    }

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name: name || null,
          password: await bcrypt.hash(password, 12),
          globalRole: 'USER',
          defaultSurgeryId: surgeryId
        }
      })
    }

    // Check if user is already a member
    const existingMembership = await prisma.userSurgery.findUnique({
      where: {
        userId_surgeryId: {
          userId: user.id,
          surgeryId
        }
      }
    })

    if (existingMembership) {
      return NextResponse.json({ error: 'User is already a member of this surgery' }, { status: 400 })
    }

    // Add user to surgery
    const membership = await prisma.userSurgery.create({
      data: {
        userId: user.id,
        surgeryId,
        role
      },
      include: {
        user: true
      }
    })

    return NextResponse.json(membership, { status: 201 })
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
