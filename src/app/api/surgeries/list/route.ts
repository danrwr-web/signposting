import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Both SUPERUSER and PRACTICE_ADMIN can fetch list; PRACTICE_ADMIN will still be scoped by UI
    const surgeries = await prisma.surgery.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json(surgeries)
  } catch (error) {
    console.error('GET /api/surgeries/list error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


