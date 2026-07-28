/**
 * Suggest quick access (common reasons) items from symptom usage data.
 */

import 'server-only'
import { prisma } from '@/lib/prisma'
import { getCachedEffectiveSymptoms } from '@/server/effectiveSymptoms'
import { COMMON_REASONS_MAX } from '@/lib/commonReasonsShared'

export interface QuickAccessSuggestion {
  symptomId: string
  name: string
  ageGroup: string
  viewCount: number
}

// Views are only recorded for base symptoms, so events for symptoms since
// hidden or disabled for the surgery may top the raw counts; oversample so
// filtering them out doesn't shrink the suggestion list below the limit.
const OVERSAMPLE = 24

/**
 * The surgery's most-viewed symptoms over the trailing window, as quick access
 * items. Only symptoms currently visible to the surgery are returned (hidden,
 * disabled and deleted ones are dropped), using their effective (possibly
 * surgery-renamed) names. Custom symptoms never appear because views are only
 * logged against base symptoms (see src/app/symptom/[id]/page.tsx).
 */
export async function getTopViewedQuickAccessItems(
  surgeryId: string,
  { days = 30, limit = COMMON_REASONS_MAX }: { days?: number; limit?: number } = {}
): Promise<QuickAccessSuggestion[]> {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const grouped = await prisma.engagementEvent.groupBy({
    by: ['baseId'],
    where: {
      event: 'view_symptom',
      surgeryId,
      createdAt: { gte: startDate },
    },
    _count: { baseId: true },
    orderBy: { _count: { baseId: 'desc' } },
    take: Math.max(limit, OVERSAMPLE),
  })

  if (grouped.length === 0) return []

  const symptoms = await getCachedEffectiveSymptoms(surgeryId)
  // EffectiveSymptom.id equals the base symptom id for base/override sources,
  // which is also the id quick access items store.
  const visible = new Map(
    symptoms.filter(s => s.source !== 'custom' && !s.isHidden).map(s => [s.id, s])
  )

  const suggestions: QuickAccessSuggestion[] = []
  for (const g of grouped) {
    const symptom = visible.get(g.baseId)
    if (!symptom) continue
    suggestions.push({
      symptomId: symptom.id,
      name: symptom.name,
      ageGroup: symptom.ageGroup,
      viewCount: g._count.baseId,
    })
    if (suggestions.length >= limit) break
  }

  return suggestions
}
