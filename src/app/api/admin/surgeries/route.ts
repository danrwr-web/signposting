import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser, requireSuperuser } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createSurgerySchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional()
})

const updateSurgerySchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().optional()
})

// GET /api/admin/surgeries - List all surgeries
export async function GET() {
  try {
    await requireSuperuser()
    
    const surgeries = await prisma.surgery.findMany({
      include: {
        users: {
          include: {
            user: true
          }
        },
        _count: {
          select: {
            users: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(surgeries)
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/admin/surgeries - Create new surgery
export async function POST(request: NextRequest) {
  try {
    await requireSuperuser()
    
    const body = await request.json()
    const { name, slug } = createSurgerySchema.parse(body)

    // Check if surgery with same name already exists
    const existingSurgery = await prisma.surgery.findUnique({
      where: { name }
    })

    if (existingSurgery) {
      return NextResponse.json({ error: 'Surgery with this name already exists' }, { status: 400 })
    }

    // If slug provided, check if it's unique
    if (slug) {
      const existingSlug = await prisma.surgery.findUnique({
        where: { slug }
      })

      if (existingSlug) {
        return NextResponse.json({ error: 'Surgery with this slug already exists' }, { status: 400 })
      }
    }

    const surgery = await prisma.surgery.create({
      data: {
        name,
        slug: slug || null
      },
      include: {
        users: {
          include: {
            user: true
          }
        },
        _count: {
          select: {
            users: true
          }
        }
      }
    })

    return NextResponse.json(surgery, { status: 201 })
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