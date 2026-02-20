/**
 * Server-only highlight rules management
 * This file must only be imported by server components or API routes
 */

import 'server-only'
import { prisma } from '@/lib/prisma'
import { unstable_cache } from 'next/cache'

export interface HighlightRule {
  id: string
  surgeryId: string | null
  phrase: string
  textColor: string
  bgColor: string
  isEnabled: boolean
  createdAt: Date
  updatedAt: Date
}

export const HIGHLIGHTS_TAG = 'highlights'

export const getCachedHighlightsTag = (surgeryId: string | null) =>
  `highlights:${surgeryId ?? 'global'}`

/**
 * Get all active highlight rules for a surgery (global + surgery-specific)
 */
export async function getActiveHighlightRules(surgeryId?: string): Promise<HighlightRule[]> {
  const whereClause: any = { isEnabled: true }
  
  if (surgeryId) {
    whereClause.OR = [
      { surgeryId: null }, // Global rules
      { surgeryId } // Surgery-specific rules
    ]
  } else {
    whereClause.surgeryId = null // Only global rules
  }

  return await prisma.highlightRule.findMany({
    where: whereClause,
    orderBy: { createdAt: 'asc' }
  })
}

/**
 * Get surgery's built-in highlights setting
 */
export async function getSurgeryBuiltInHighlightsSetting(surgeryId?: string): Promise<boolean> {
  if (!surgeryId) {
    return true // Default to enabled if no surgery
  }

  const surgery = await prisma.surgery.findUnique({
    where: { id: surgeryId },
    select: { enableBuiltInHighlights: true } as any // Temporary type assertion
  })

  return (surgery as any)?.enableBuiltInHighlights ?? true
}

/**
 * Get surgery's image icons setting
 */
export async function getSurgeryImageIconsSetting(surgeryId?: string): Promise<boolean> {
  if (!surgeryId) {
    return true // Default to enabled if no surgery
  }

  try {
    const surgery = await prisma.surgery.findUnique({
      where: { id: surgeryId },
      select: { enableImageIcons: true } as any
    })

    return (surgery as any)?.enableImageIcons ?? true
  } catch {
    // Field doesn't exist yet in production DB, return default
    return true
  }
}

/**
 * Get all highlight rules (admin use)
 */
export async function getAllHighlightRules(surgeryId?: string | null): Promise<HighlightRule[]> {
  const whereClause: any = {}
  
  if (surgeryId !== undefined) {
    whereClause.surgeryId = surgeryId
  }

  return await prisma.highlightRule.findMany({
    where: whereClause,
    orderBy: { createdAt: 'asc' }
  })
}

/**
 * Cached highlight rules by scope (global or a specific surgery).
 *
 * Used to keep highlight application fast in the main UI while still allowing
 * instant updates via `revalidateTag(...)` on mutations.
 */
export async function getCachedHighlightRules(surgeryId: string | null): Promise<HighlightRule[]> {
  const cached = unstable_cache(
    async () => {
      return prisma.highlightRule.findMany({
        where: { surgeryId },
        orderBy: { createdAt: 'asc' },
      })
    },
    ['highlight-rules', surgeryId ?? 'global'],
    {
      // Match the symptoms cache window, but allow instant invalidation.
      revalidate: 300,
      tags: [HIGHLIGHTS_TAG, getCachedHighlightsTag(surgeryId)],
    }
  )

  return cached()
}

/**
 * Create a new highlight rule
 */
export async function createHighlightRule(data: {
  phrase: string
  textColor: string
  bgColor: string
  isEnabled?: boolean
  surgeryId?: string | null
}): Promise<HighlightRule> {
  const normalizedPhrase = data.phrase.trim().toLowerCase()
  
  // Check for duplicates within the same surgery scope
  const existing = await prisma.highlightRule.findFirst({
    where: { 
      surgeryId: data.surgeryId ?? null,
      phrase: normalizedPhrase
    }
  })
  
  if (existing) {
    const error = new Error('A highlight rule with this phrase already exists')
    error.name = 'DuplicatePhraseError'
    throw error
  }
  
  return await prisma.highlightRule.create({
    data: {
      surgeryId: data.surgeryId || null,
      phrase: normalizedPhrase,
      textColor: data.textColor,
      bgColor: data.bgColor,
      isEnabled: data.isEnabled ?? true
    }
  })
}

/**
 * Update a highlight rule
 */
export async function updateHighlightRule(
  id: string, 
  data: Partial<Pick<HighlightRule, 'phrase' | 'textColor' | 'bgColor' | 'isEnabled'>>
): Promise<HighlightRule> {
  const updateData: any = { ...data }
  
  if (data.phrase) {
    const normalizedPhrase = data.phrase.trim().toLowerCase()
    
    // Get the current rule to check surgeryId
    const currentRule = await prisma.highlightRule.findUnique({
      where: { id },
      select: { surgeryId: true }
    })
    
    if (!currentRule) {
      throw new Error('Highlight rule not found')
    }
    
    // Check for duplicates within the same surgery scope
    const existing = await prisma.highlightRule.findFirst({
      where: { 
        surgeryId: currentRule.surgeryId,
        phrase: normalizedPhrase,
        id: { not: id } // Exclude the current rule
      }
    })
    
    if (existing) {
      const error = new Error('A highlight rule with this phrase already exists')
      error.name = 'DuplicatePhraseError'
      throw error
    }
    
    updateData.phrase = normalizedPhrase
  }
  
  return await prisma.highlightRule.update({
    where: { id },
    data: updateData
  })
}

/**
 * Delete a highlight rule
 */
export async function deleteHighlightRule(id: string): Promise<void> {
  await prisma.highlightRule.delete({
    where: { id }
  })
}
