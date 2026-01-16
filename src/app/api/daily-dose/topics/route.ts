import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'
import { resolveSurgeryIdForUser } from '@/lib/daily-dose/access'
import { normaliseRoleScope } from '@/lib/daily-dose/utils'
import { DailyDoseTopicsQueryZ } from '@/lib/daily-dose/schemas'
import { z } from 'zod'

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const query = DailyDoseTopicsQueryZ.parse({
      surgeryId: request.nextUrl.searchParams.get('surgeryId') ?? undefined,
      role: request.nextUrl.searchParams.get('role') ?? undefined,
    })
    const surgeryId = resolveSurgeryIdForUser({ requestedId: query.surgeryId, user })
    if (!surgeryId) {
      return NextResponse.json({ error: 'Surgery access required' }, { status: 403 })
    }

    const topics = await prisma.dailyDoseTopic.findMany({
      where: {
        isActive: true,
        OR: [{ surgeryId }, { surgeryId: null }],
      },
      orderBy: [{ ordering: 'asc' }, { name: 'asc' }],
    })

    const filtered = query.role
      ? topics.filter((topic) => {
          const scope = normaliseRoleScope(topic.roleScope)
          return scope.length === 0 ? true : scope.includes(query.role)
        })
      : topics

    return NextResponse.json({ topics: filtered, surgeryId })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    console.error('GET /api/daily-dose/topics error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
