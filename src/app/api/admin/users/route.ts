import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser, requireSuperuser } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import bcrypt from 'bcryptjs'

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  password: z.string().min(1, 'Password is required'),
  globalRole: z.enum(['USER', 'SUPERUSER']).default('USER'),
  isTestUser: z.boolean().default(false),
  symptomUsageLimit: z.number().int().positive().optional()
})

const updateUserSchema = z.object({
  globalRole: z.enum(['USER', 'SUPERUSER']).optional(),
  name: z.string().optional()
})

// GET /api/admin/users - List all users
export async function GET() {
  try {
    await requireSuperuser()
    
    const users = await prisma.user.findMany({
      include: {
        memberships: {
          include: {
            surgery: true
          }
        },
        defaultSurgery: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(users)
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/admin/users - Create new user
export async function POST(request: NextRequest) {
  try {
    await requireSuperuser()
    
    const body = await request.json()
    const { email, name, password, globalRole, isTestUser, symptomUsageLimit } = createUserSchema.parse(body)

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json({ error: 'User already exists' }, { status: 400 })
    }

    // For test users, assign them to the first available surgery
    let defaultSurgeryId = null
    if (isTestUser) {
      const firstSurgery = await prisma.surgery.findFirst({
        select: { id: true }
      })
      if (firstSurgery) {
        defaultSurgeryId = firstSurgery.id
      }
    }

    const user = await prisma.user.create({
      data: {
        email,
        name,
        password: await bcrypt.hash(password, 12),
        globalRole,
        isTestUser,
        defaultSurgeryId,
        symptomUsageLimit: isTestUser ? (symptomUsageLimit || 25) : null,
        symptomsUsed: 0,
        // Create membership for test users
        memberships: isTestUser && defaultSurgeryId ? {
          create: {
            surgeryId: defaultSurgeryId,
            role: 'STANDARD'
          }
        } : undefined
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

    return NextResponse.json(user, { status: 201 })
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
