import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'

// GET /api/user/tour-state?tourKey=onboarding
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const tourKey = request.nextUrl.searchParams.get('tourKey')
    if (!tourKey) {
      return NextResponse.json({ error: 'tourKey is required' }, { status: 400 })
    }

    const state = await prisma.userTourState.findUnique({
      where: {
        userId_tourKey: {
          userId: user.id,
          tourKey,
        },
      },
      select: {
        completedAt: true,
        skippedAt: true,
        lastStepIdx: true,
      },
    })

    return NextResponse.json(state)
  } catch (error) {
    console.error('Error fetching tour state:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/user/tour-state
export async function PUT(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const { tourKey, completedAt, skippedAt, lastStepIdx } = body

    if (!tourKey || typeof tourKey !== 'string') {
      return NextResponse.json({ error: 'tourKey is required' }, { status: 400 })
    }

    const data: Record<string, unknown> = {}
    if (completedAt !== undefined) data.completedAt = new Date(completedAt)
    if (skippedAt !== undefined) data.skippedAt = new Date(skippedAt)
    if (lastStepIdx !== undefined) data.lastStepIdx = lastStepIdx

    await prisma.userTourState.upsert({
      where: {
        userId_tourKey: {
          userId: user.id,
          tourKey,
        },
      },
      create: {
        userId: user.id,
        tourKey,
        ...data,
      },
      update: data,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error updating tour state:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
