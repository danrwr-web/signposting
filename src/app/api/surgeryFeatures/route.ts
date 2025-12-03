import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { ensureFeatures } from '@/lib/ensureFeatures'
import { z } from 'zod'

const updateSurgeryFeatureSchema = z.object({
  surgeryId: z.string(),
  featureId: z.string(),
  enabled: z.boolean()
})

// GET /api/surgeryFeatures?surgeryId=...
// SUPERUSER: can fetch for any surgery
// PRACTICE_ADMIN: can fetch only for their own surgery
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
    const allFeatures = await prisma.feature.findMany({
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

    // Get surgery-level flags for this surgery
    const surgeryFlags = await prisma.surgeryFeatureFlag.findMany({
      where: { surgeryId },
      select: {
        featureId: true,
        enabled: true
      }
    })

    // Create a map of featureId -> enabled
    const flagsMap = new Map<string, boolean>()
    for (const flag of surgeryFlags) {
      flagsMap.set(flag.featureId, flag.enabled)
    }

    // Combine features with their enabled status
    const featuresWithFlags = allFeatures.map(feature => ({
      ...feature,
      enabled: flagsMap.get(feature.id) || false
    }))

    return NextResponse.json({ features: featuresWithFlags })
  } catch (error) {
    console.error('Error fetching surgery features:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/surgeryFeatures
// { surgeryId, featureId, enabled }
// SUPERUSER only
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Only SUPERUSER can modify surgery features
    const isSuperuser = user.globalRole === 'SUPERUSER'
    if (!isSuperuser) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { surgeryId, featureId, enabled } = updateSurgeryFeatureSchema.parse(body)

    // Upsert the surgery feature flag
    const flag = await prisma.surgeryFeatureFlag.upsert({
      where: {
        surgeryId_featureId: {
          surgeryId,
          featureId
        }
      },
      update: {
        enabled,
        updatedAt: new Date()
      },
      create: {
        surgeryId,
        featureId,
        enabled
      }
    })

    return NextResponse.json({ flag })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    console.error('Error updating surgery feature:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

