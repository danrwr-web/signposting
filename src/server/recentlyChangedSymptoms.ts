/**
 * Server-only module for fetching recently changed (approved) symptoms.
 * Only surfaces approved, live content - never drafts or pending reviews.
 */

import 'server-only'
import { prisma } from '@/lib/prisma'
import { computeEffectiveCutoffDate } from './whatsChangedBaseline'

/**
 * Represents a recently changed symptom with metadata about the change type.
 */
export interface RecentlyChangedSymptom {
  id: string
  name: string
  ageGroup: 'U5' | 'O5' | 'Adult'
  briefInstruction: string | null
  source: 'base' | 'override' | 'custom'
  changeType: 'new' | 'updated'
  approvedAt: Date
}

/**
 * Default time window for "recently changed" symptoms (14 days).
 */
export const DEFAULT_CHANGE_WINDOW_DAYS = 14

/**
 * Fetches symptoms that have been approved within the specified time window.
 * Only returns APPROVED symptoms - never exposes drafts, pending, or internal metadata.
 * 
 * @param surgeryId - The surgery to scope the query to
 * @param windowDays - Number of days to look back (default: 14)
 * @param baselineDate - Surgery-specific baseline date (optional)
 * @returns Array of recently changed symptoms, sorted by approval date (most recent first)
 */
export async function getRecentlyChangedSymptoms(
  surgeryId: string,
  windowDays: number = DEFAULT_CHANGE_WINDOW_DAYS,
  baselineDate: Date | null = null
): Promise<RecentlyChangedSymptom[]> {
  const cutoffDate = computeEffectiveCutoffDate(windowDays, baselineDate)

  // Get all approved symptom review statuses within the window
  const recentReviews = await prisma.symptomReviewStatus.findMany({
    where: {
      surgeryId,
      status: 'APPROVED',
      lastReviewedAt: {
        gte: cutoffDate
      }
    },
    select: {
      symptomId: true,
      ageGroup: true,
      lastReviewedAt: true
    }
  })

  if (recentReviews.length === 0) {
    return []
  }

  const symptomIds = recentReviews.map(r => r.symptomId)

  // Fetch custom symptoms
  const customSymptoms = await prisma.surgeryCustomSymptom.findMany({
    where: {
      surgeryId,
      id: { in: symptomIds },
      isDeleted: false
    },
    select: {
      id: true,
      name: true,
      ageGroup: true,
      briefInstruction: true
    }
  })

  // Fetch base symptoms (the symptomId could be a base symptom ID)
  const baseSymptoms = await prisma.baseSymptom.findMany({
    where: {
      id: { in: symptomIds },
      isDeleted: false
    },
    select: {
      id: true,
      name: true,
      ageGroup: true,
      briefInstruction: true,
      createdAt: true
    }
  })

  // Fetch overrides for base symptoms
  const overrides = await prisma.surgerySymptomOverride.findMany({
    where: {
      surgeryId,
      baseSymptomId: { in: baseSymptoms.map(b => b.id) },
      isHidden: false
    },
    select: {
      baseSymptomId: true,
      name: true,
      ageGroup: true,
      briefInstruction: true
    }
  })

  // Check for symptom history to determine if symptoms have been previously modified
  const historyRecords = await prisma.symptomHistory.findMany({
    where: {
      symptomId: { in: symptomIds }
    },
    select: {
      symptomId: true,
      changedAt: true
    },
    orderBy: {
      changedAt: 'asc'
    }
  })

  // Build a map of symptomId -> first change date
  const firstChangeBySymptom = new Map<string, Date>()
  for (const h of historyRecords) {
    if (!firstChangeBySymptom.has(h.symptomId)) {
      firstChangeBySymptom.set(h.symptomId, h.changedAt)
    }
  }

  // Create lookup maps
  const customMap = new Map(customSymptoms.map(c => [c.id, c]))
  const baseMap = new Map(baseSymptoms.map(b => [b.id, b]))
  const overrideMap = new Map(overrides.map(o => [o.baseSymptomId, o]))
  const reviewMap = new Map(recentReviews.map(r => [r.symptomId, r]))

  const results: RecentlyChangedSymptom[] = []

  for (const review of recentReviews) {
    const symptomId = review.symptomId
    const approvedAt = review.lastReviewedAt!

    // Check if it's a custom symptom
    const custom = customMap.get(symptomId)
    if (custom) {
      // Determine if "new" or "updated":
      // "New" if there's no history before the cutoff date (first-time approval)
      // "Updated" if there's history before the window
      const hasHistoryBefore = firstChangeBySymptom.has(symptomId) && 
        firstChangeBySymptom.get(symptomId)! < cutoffDate
      const isNew = !hasHistoryBefore
      
      results.push({
        id: custom.id,
        name: custom.name,
        ageGroup: custom.ageGroup as 'U5' | 'O5' | 'Adult',
        briefInstruction: custom.briefInstruction,
        source: 'custom',
        changeType: isNew ? 'new' : 'updated',
        approvedAt
      })
      continue
    }

    // Check if it's a base symptom (possibly with override)
    const base = baseMap.get(symptomId)
    if (base) {
      const override = overrideMap.get(symptomId)
      const hasHistoryBefore = firstChangeBySymptom.has(symptomId) && 
        firstChangeBySymptom.get(symptomId)! < cutoffDate

      // For base symptoms, they're always considered "updated" from the surgery's perspective
      // unless this is the first time they've been approved for this surgery
      const isNew = !hasHistoryBefore && !override

      const effectiveSymptom = override ? {
        id: base.id,
        name: override.name || base.name,
        ageGroup: (override.ageGroup || base.ageGroup) as 'U5' | 'O5' | 'Adult',
        briefInstruction: override.briefInstruction || base.briefInstruction,
        source: 'override' as const
      } : {
        id: base.id,
        name: base.name,
        ageGroup: base.ageGroup as 'U5' | 'O5' | 'Adult',
        briefInstruction: base.briefInstruction,
        source: 'base' as const
      }

      results.push({
        ...effectiveSymptom,
        changeType: isNew ? 'new' : 'updated',
        approvedAt
      })
    }
  }

  // Sort by approval date, most recent first
  results.sort((a, b) => b.approvedAt.getTime() - a.approvedAt.getTime())

  return results
}

/**
 * Gets the count of recently changed symptoms for a surgery.
 * Useful for displaying badge counts without fetching full details.
 * 
 * @param surgeryId - The surgery to scope the query to
 * @param windowDays - Number of days to look back (default: 14)
 * @param baselineDate - Surgery-specific baseline date (optional)
 * @returns Count of recently changed symptoms
 */
export async function getRecentlyChangedSymptomsCount(
  surgeryId: string,
  windowDays: number = DEFAULT_CHANGE_WINDOW_DAYS,
  baselineDate: Date | null = null
): Promise<number> {
  const cutoffDate = computeEffectiveCutoffDate(windowDays, baselineDate)

  const count = await prisma.symptomReviewStatus.count({
    where: {
      surgeryId,
      status: 'APPROVED',
      lastReviewedAt: {
        gte: cutoffDate
      }
    }
  })

  return count
}

/**
 * Checks if a specific symptom was recently changed (approved within the window).
 * Used for displaying badges on symptom cards.
 * 
 * @param surgeryId - The surgery to scope the query to
 * @param symptomId - The symptom ID to check
 * @param windowDays - Number of days to look back (default: 14)
 * @param baselineDate - Surgery-specific baseline date (optional)
 * @returns Object with isRecentlyChanged flag and changeType if applicable
 */
export async function checkSymptomRecentlyChanged(
  surgeryId: string,
  symptomId: string,
  windowDays: number = DEFAULT_CHANGE_WINDOW_DAYS,
  baselineDate: Date | null = null
): Promise<{ isRecentlyChanged: boolean; changeType?: 'new' | 'updated'; approvedAt?: Date }> {
  const cutoffDate = computeEffectiveCutoffDate(windowDays, baselineDate)

  const review = await prisma.symptomReviewStatus.findFirst({
    where: {
      surgeryId,
      symptomId,
      status: 'APPROVED',
      lastReviewedAt: {
        gte: cutoffDate
      }
    },
    select: {
      lastReviewedAt: true
    }
  })

  if (!review || !review.lastReviewedAt) {
    return { isRecentlyChanged: false }
  }

  // Check for prior history to determine change type
  // "New" if there's no history before the cutoff date
  // "Updated" if there's prior history
  const historyCount = await prisma.symptomHistory.count({
    where: {
      symptomId,
      changedAt: {
        lt: cutoffDate
      }
    }
  })

  const isNew = historyCount === 0

  return {
    isRecentlyChanged: true,
    changeType: isNew ? 'new' : 'updated',
    approvedAt: review.lastReviewedAt
  }
}

/**
 * Batch check for multiple symptoms - optimized for symptom list rendering.
 * Returns a map of symptomId -> change info.
 * 
 * @param surgeryId - The surgery to scope the query to
 * @param symptomIds - Array of symptom IDs to check
 * @param windowDays - Number of days to look back (default: 14)
 * @param baselineDate - Surgery-specific baseline date (optional)
 * @returns Map of symptom ID to change info
 */
export async function batchCheckSymptomsRecentlyChanged(
  surgeryId: string,
  symptomIds: string[],
  windowDays: number = DEFAULT_CHANGE_WINDOW_DAYS,
  baselineDate: Date | null = null
): Promise<Map<string, { changeType: 'new' | 'updated'; approvedAt: Date }>> {
  const cutoffDate = computeEffectiveCutoffDate(windowDays, baselineDate)

  const reviews = await prisma.symptomReviewStatus.findMany({
    where: {
      surgeryId,
      symptomId: { in: symptomIds },
      status: 'APPROVED',
      lastReviewedAt: {
        gte: cutoffDate
      }
    },
    select: {
      symptomId: true,
      lastReviewedAt: true
    }
  })

  if (reviews.length === 0) {
    return new Map()
  }

  const reviewedIds = reviews.map(r => r.symptomId)

  // Check history for all reviewed symptoms
  // Symptoms with history before the cutoff date are "updated", otherwise "new"
  const historyRecords = await prisma.symptomHistory.findMany({
    where: {
      symptomId: { in: reviewedIds },
      changedAt: {
        lt: cutoffDate
      }
    },
    select: {
      symptomId: true
    },
    distinct: ['symptomId']
  })
  const hasOldHistory = new Set(historyRecords.map(h => h.symptomId))

  const result = new Map<string, { changeType: 'new' | 'updated'; approvedAt: Date }>()
  
  for (const review of reviews) {
    if (!review.lastReviewedAt) continue
    
    // "New" if no history before cutoff, "Updated" otherwise
    const isNew = !hasOldHistory.has(review.symptomId)
    
    result.set(review.symptomId, {
      changeType: isNew ? 'new' : 'updated',
      approvedAt: review.lastReviewedAt
    })
  }

  return result
}
