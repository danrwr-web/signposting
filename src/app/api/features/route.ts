import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'

// GET /api/features
// Returns the list of features (id, key, name, description)
// SUPERUSER and PRACTICE_ADMIN can call
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Check if user is SUPERUSER or has ADMIN membership
    const isSuperuser = user.globalRole === 'SUPERUSER'
    const isPracticeAdmin = user.memberships.some(m => m.role === 'ADMIN')
    if (!isSuperuser && !isPracticeAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const features = await prisma.feature.findMany({
      select: {
        id: true,
        key: true,
        name: true,
        description: true
      },
      orderBy: {
        name: 'asc'
      }
    })

    return NextResponse.json({ features })
  } catch (error) {
    console.error('Error fetching features:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

