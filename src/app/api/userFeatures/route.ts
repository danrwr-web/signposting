import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { ensureFeatures } from '@/lib/ensureFeatures'
import { z } from 'zod'

const updateUserFeatureSchema = z.object({
  userId: z.string(),
  featureId: z.string(),
  enabled: z.boolean()
})

// GET /api/userFeatures?surgeryId=...
// PRACTICE_ADMIN: returns users in that surgery + their feature flags
// SUPERUSER: can also fetch if needed
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const surgeryId = searchParams.get('surgeryId')

    if (!surgeryId) {
      return NextResponse.json({ error: 'surgeryId parameter required' }, { status: 400 })
    }

    // Check permissions
    const isSuperuser = user.globalRole === 'SUPERUSER'
    const isPracticeAdmin = user.memberships.some(m => m.role === 'ADMIN')
    
    if (isSuperuser) {
      // Superuser can view any surgery
    } else if (isPracticeAdmin) {
      // Practice admin can only view their own surgery
      if (user.surgeryId !== surgeryId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Ensure features are up-to-date (upserts by key, so safe to call repeatedly)
    await ensureFeatures()

    // Get all features
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

    // Get surgery-level flags to know which features are enabled at surgery level
    const surgeryFlags = await prisma.surgeryFeatureFlag.findMany({
      where: { surgeryId },
      select: {
        featureId: true,
        enabled: true
      }
    })

    // Get all users in this surgery
    const userSurgeries = await prisma.userSurgery.findMany({
      where: { surgeryId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    // Get all user feature flags for users in this surgery
    const userIds = userSurgeries.map(us => us.user.id)
    const userFlags = await prisma.userFeatureFlag.findMany({
      where: {
        userId: { in: userIds }
      },
      select: {
        userId: true,
        featureId: true,
        enabled: true
      }
    })

    // Create maps for quick lookup
    const surgeryFlagsMap = new Map<string, boolean>()
    for (const flag of surgeryFlags) {
      surgeryFlagsMap.set(flag.featureId, flag.enabled)
    }

    const userFlagsMap = new Map<string, Map<string, boolean>>()
    for (const flag of userFlags) {
      if (!userFlagsMap.has(flag.userId)) {
        userFlagsMap.set(flag.userId, new Map())
      }
      userFlagsMap.get(flag.userId)!.set(flag.featureId, flag.enabled)
    }

    // Build the response
    const users = userSurgeries.map(us => {
      const userFeatureMap = userFlagsMap.get(us.user.id) || new Map()
      const userFeatures = features.map(feature => ({
        featureId: feature.id,
        enabled: userFeatureMap.get(feature.id) || false
      }))

      return {
        id: us.user.id,
        name: us.user.name,
        email: us.user.email,
        features: userFeatures
      }
    })

    return NextResponse.json({ users, features })
  } catch (error) {
    console.error('Error fetching user features:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/userFeatures
// { userId, featureId, enabled }
// PRACTICE_ADMIN: only allowed if the user belongs to their surgery AND the feature is enabled at the surgery level
// SUPERUSER: allowed always
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const { userId, featureId, enabled } = updateUserFeatureSchema.parse(body)

    // Get the target user to check which surgery they belong to
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          include: {
            surgery: true
          }
        }
      }
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check permissions
    const isSuperuser = user.globalRole === 'SUPERUSER'
    const isPracticeAdmin = user.memberships.some(m => m.role === 'ADMIN')
    
    if (isSuperuser) {
      // Superuser can modify any user's features
    } else if (isPracticeAdmin) {
      // Practice admin can only modify users in their surgery
      const userSurgeryIds = targetUser.memberships.map(m => m.surgeryId)
      if (!userSurgeryIds.includes(user.surgeryId!)) {
        return NextResponse.json({ error: 'User does not belong to your surgery' }, { status: 403 })
      }

      // Check that the feature is enabled at surgery level
      const surgeryFlag = await prisma.surgeryFeatureFlag.findUnique({
        where: {
          surgeryId_featureId: {
            surgeryId: user.surgeryId!,
            featureId
          }
        }
      })

      if (!surgeryFlag || !surgeryFlag.enabled) {
        return NextResponse.json({ error: 'Feature is not enabled for this surgery' }, { status: 403 })
      }
    } else {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Upsert the user feature flag
    const flag = await prisma.userFeatureFlag.upsert({
      where: {
        userId_featureId: {
          userId,
          featureId
        }
      },
      update: {
        enabled,
        updatedAt: new Date()
      },
      create: {
        userId,
        featureId,
        enabled
      }
    })

    return NextResponse.json({ flag })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    console.error('Error updating user feature:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

