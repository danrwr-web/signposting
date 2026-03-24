import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'

// GET /api/my/features?surgeryId=<optional>
// Returns the current user's effective feature flags (from surgery + user level)
// If surgeryId is provided, resolves features for that specific surgery.
// Otherwise, falls back to the user's defaultSurgeryId (superusers get all features enabled).
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const querySurgeryId = request.nextUrl.searchParams.get('surgeryId')

    // If the user is a superuser with no specific surgery context, return all features as enabled
    if (user.globalRole === 'SUPERUSER' && !querySurgeryId) {
      const features = await prisma.feature.findMany({
        select: {
          key: true
        }
      })

      return NextResponse.json({
        features: features.map(f => ({ key: f.key, enabled: true }))
      })
    }

    // Use the query param surgery ID, falling back to user's default
    const surgeryId = querySurgeryId || user.defaultSurgeryId
    if (!surgeryId) {
      return NextResponse.json({
        features: []
      })
    }

    // Get all features
    const allFeatures = await prisma.feature.findMany({
      select: {
        id: true,
        key: true
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

    // Get user-level flags
    const userFlags = await prisma.userFeatureFlag.findMany({
      where: { userId: user.id },
      select: {
        featureId: true,
        enabled: true
      }
    })

    // Create maps for quick lookup
    const surgeryFlagsMap = new Map<string, boolean>()
    for (const flag of surgeryFlags) {
      surgeryFlagsMap.set(flag.featureId, flag.enabled)
    }

    const userFlagsMap = new Map<string, boolean>()
    for (const flag of userFlags) {
      userFlagsMap.set(flag.featureId, flag.enabled)
    }

    // Build result: enabled = true if surgery-level is enabled AND (no user override OR user override is enabled)
    const features = allFeatures.map(feature => {
      const surgeryEnabled = surgeryFlagsMap.get(feature.id) || false
      const userOverride = userFlagsMap.get(feature.id)
      
      // If surgery-level is off, feature is disabled
      if (!surgeryEnabled) {
        return { key: feature.key, enabled: false }
      }
      
      // If there's a user override, use that
      if (userOverride !== undefined) {
        return { key: feature.key, enabled: userOverride }
      }
      
      // Otherwise, use surgery-level value (which we know is true)
      return { key: feature.key, enabled: true }
    })

    return NextResponse.json({ features })
  } catch (error) {
    console.error('Error fetching user features:', error)
    // Fail-closed: return no features enabled
    return NextResponse.json({ features: [] })
  }
}

