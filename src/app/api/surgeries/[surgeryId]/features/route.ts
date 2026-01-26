import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser, can } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { ensureFeatures } from '@/lib/ensureFeatures'

interface RouteContext {
  params: Promise<{ surgeryId: string }>
}

/**
 * GET /api/surgeries/[surgeryId]/features
 * Returns the enabled feature flags for a surgery.
 * Accessible by any authenticated user with access to the surgery.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { surgeryId } = await context.params
    const user = await getSessionUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Check if user has access to this surgery
    if (!can(user).viewSurgery(surgeryId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Ensure features are up-to-date (upserts by key, so safe to call repeatedly)
    await ensureFeatures()

    // Get all features
    const allFeatures = await prisma.feature.findMany({
      select: {
        id: true,
        key: true,
      },
    })

    // Get surgery-level feature flags
    const surgeryFlags = await prisma.surgeryFeatureFlag.findMany({
      where: { surgeryId },
      select: {
        featureId: true,
        enabled: true,
      },
    })

    const flagsMap = new Map<string, boolean>()
    for (const flag of surgeryFlags) {
      flagsMap.set(flag.featureId, flag.enabled)
    }

    // Build features object: { [featureKey]: boolean }
    const features: Record<string, boolean> = {}
    for (const feature of allFeatures) {
      features[feature.key] = flagsMap.get(feature.id) ?? false
    }

    return NextResponse.json({ features })
  } catch (error) {
    console.error('Error fetching surgery features:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
