import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'
import { DailyDoseProfileUpsertZ, DailyDoseSurgeryQueryZ } from '@/lib/daily-dose/schemas'
import { resolveSurgeryIdForUser } from '@/lib/daily-dose/access'
import { z } from 'zod'

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const query = DailyDoseSurgeryQueryZ.parse({
      surgeryId: request.nextUrl.searchParams.get('surgeryId') ?? undefined,
    })
    const surgeryId = resolveSurgeryIdForUser({ requestedId: query.surgeryId, user })
    if (!surgeryId) {
      return NextResponse.json({ error: 'Surgery access required' }, { status: 403 })
    }

    const profile = await prisma.dailyDoseProfile.findUnique({
      where: {
        userId_surgeryId: {
          userId: user.id,
          surgeryId,
        },
      },
    })

    return NextResponse.json({ profile, surgeryId })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    console.error('GET /api/daily-dose/profile error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = DailyDoseProfileUpsertZ.parse(body)
    const surgeryId = resolveSurgeryIdForUser({ requestedId: parsed.surgeryId, user })

    if (!surgeryId) {
      return NextResponse.json({ error: 'Surgery access required' }, { status: 403 })
    }

    const profile = await prisma.dailyDoseProfile.upsert({
      where: {
        userId_surgeryId: {
          userId: user.id,
          surgeryId,
        },
      },
      update: {
        role: parsed.role,
        preferences: parsed.preferences,
        onboardingCompleted: parsed.onboardingCompleted ?? true,
      },
      create: {
        userId: user.id,
        surgeryId,
        role: parsed.role,
        preferences: parsed.preferences,
        onboardingCompleted: parsed.onboardingCompleted ?? true,
      },
    })

    return NextResponse.json({ profile, surgeryId })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: (error as any).issues },
        { status: 400 }
      )
    }
    console.error('POST /api/daily-dose/profile error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
