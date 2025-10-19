import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'

// GET /api/user/profile - Get current user profile
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Get fresh user data including test user fields
    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        name: true,
        globalRole: true,
        isTestUser: true,
        symptomUsageLimit: true,
        symptomsUsed: true,
        defaultSurgeryId: true,
        memberships: {
          include: {
            surgery: true
          }
        }
      }
    })

    if (!fullUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json(fullUser)
  } catch (error) {
    console.error('Error fetching user profile:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
