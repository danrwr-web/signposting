import 'server-only'
import { prisma } from '@/lib/prisma'
import { cache } from 'react'

/**
 * Check if a feature is enabled for a specific user.
 * 
 * Logic:
 * 1. Find feature by key
 * 2. Get user's surgery (either from user or join)
 * 3. Check SurgeryFeatureFlag (if false → return false)
 * 4. Check UserFeatureFlag override (if exists → return that)
 * 5. Otherwise return surgery-level value
 * 
 * @param userId - The user ID to check
 * @param featureKey - The feature key to check (e.g., "ai_instructions")
 * @returns true if the feature is enabled for this user, false otherwise
 */
export const isFeatureEnabledForUser = cache(async (userId: string, featureKey: string): Promise<boolean> => {
  try {
    // 1. Find feature by key
    const feature = await prisma.feature.findUnique({
      where: { key: featureKey }
    })

    if (!feature) {
      // Feature doesn't exist, default to false
      return false
    }

    // 2. Get user with their surgery memberships
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        defaultSurgeryId: true,
        memberships: {
          select: {
            surgeryId: true,
            role: true
          }
        }
      }
    })

    if (!user || !user.defaultSurgeryId) {
      // User doesn't exist or has no default surgery, default to false
      return false
    }

    const surgeryId = user.defaultSurgeryId

    // 3. Check SurgeryFeatureFlag
    const surgeryFlag = await prisma.surgeryFeatureFlag.findUnique({
      where: {
        surgeryId_featureId: {
          surgeryId,
          featureId: feature.id
        }
      }
    })

    if (!surgeryFlag || !surgeryFlag.enabled) {
      // Surgery-level flag is off, so feature is disabled
      return false
    }

    // 4. Check UserFeatureFlag override
    const userFlag = await prisma.userFeatureFlag.findUnique({
      where: {
        userId_featureId: {
          userId,
          featureId: feature.id
        }
      }
    })

    if (userFlag) {
      // User has an explicit override, return that
      return userFlag.enabled
    }

    // 5. Otherwise return surgery-level value (which we know is true from step 3)
    return true
  } catch (error) {
    console.error('Error checking feature flag:', error)
    // On error, default to false for safety
    return false
  }
})

/**
 * Check if a feature is enabled for a specific surgery.
 *
 * Logic:
 * 1. Find feature by key
 * 2. Check SurgeryFeatureFlag (if missing or false → return false)
 * 3. Otherwise return true
 *
 * Note: This does not consider user-level overrides. Use `isFeatureEnabledForUser`
 * where you need per-user feature overrides.
 */
export const isFeatureEnabledForSurgery = cache(
  async (surgeryId: string, featureKey: string): Promise<boolean> => {
    try {
      const feature = await prisma.feature.findUnique({
        where: { key: featureKey },
        select: { id: true },
      })

      if (!feature) {
        // Feature doesn't exist, default to false
        return false
      }

      const surgeryFlag = await prisma.surgeryFeatureFlag.findUnique({
        where: {
          surgeryId_featureId: {
            surgeryId,
            featureId: feature.id,
          },
        },
        select: { enabled: true },
      })

      return surgeryFlag?.enabled ?? false
    } catch (error) {
      console.error('Error checking surgery feature flag:', error)
      // On error, default to false for safety
      return false
    }
  },
)

/**
 * Get all features enabled for a user.
 * 
 * @param userId - The user ID
 * @returns Object mapping feature keys to enabled status
 */
export const getEnabledFeaturesForUser = cache(async (userId: string): Promise<Record<string, boolean>> => {
  try {
    // Get user with their surgery
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        defaultSurgeryId: true
      }
    })

    if (!user || !user.defaultSurgeryId) {
      return {}
    }

    // Get all features
    const features = await prisma.feature.findMany({
      select: {
        id: true,
        key: true
      }
    })

    // Get surgery-level flags
    const surgeryFlags = await prisma.surgeryFeatureFlag.findMany({
      where: {
        surgeryId: user.defaultSurgeryId
      },
      select: {
        featureId: true,
        enabled: true
      }
    })

    // Get user-level flags
    const userFlags = await prisma.userFeatureFlag.findMany({
      where: {
        userId
      },
      select: {
        featureId: true,
        enabled: true
      }
    })

    // Build result
    const surgeryFlagsMap = new Map<string, boolean>()
    for (const flag of surgeryFlags) {
      surgeryFlagsMap.set(flag.featureId, flag.enabled)
    }

    const userFlagsMap = new Map<string, boolean>()
    for (const flag of userFlags) {
      userFlagsMap.set(flag.featureId, flag.enabled)
    }

    const result: Record<string, boolean> = {}
    for (const feature of features) {
      const surgeryEnabled = surgeryFlagsMap.get(feature.id) || false
      const userEnabled = userFlagsMap.get(feature.id)
      
      if (!surgeryEnabled) {
        result[feature.key] = false
      } else if (userEnabled !== undefined) {
        result[feature.key] = userEnabled
      } else {
        result[feature.key] = true
      }
    }

    return result
  } catch (error) {
    console.error('Error getting enabled features:', error)
    return {}
  }
})

