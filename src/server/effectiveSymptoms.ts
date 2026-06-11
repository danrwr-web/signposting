/**
 * Server-only effective symptoms management
 * Handles merging base symptoms with surgery-specific overrides and custom symptoms
 */

import 'server-only'
import { prisma } from '@/lib/prisma'
import { unstable_cache } from 'next/cache'
import { getSymptomSearchText } from '@/lib/symptomSearch'

export interface EffectiveSymptom {
  id: string
  slug: string
  name: string
  ageGroup: 'U5' | 'O5' | 'Adult'
  briefInstruction: string | null
  highlightedText: string | null
  instructions: string | null
  instructionsJson: string | null // ProseMirror JSON as string
  instructionsHtml: string | null // HTML format with colour support
  linkToPage: string | null
  source: 'base' | 'override' | 'custom'
  baseSymptomId?: string // For overrides, this is the base symptom ID
  isHidden?: boolean // For overrides, indicates if symptom is hidden for this surgery
  disabled?: boolean // True if disabled for this surgery (only meaningful when includeDisabled is set)
  variants?: unknown | null // Optional variants JSON from BaseSymptom
  // Plain-text search index derived from the displayed content. Computed
  // server-side so search works even when rich content is omitted from the
  // payload (the slim cached path used for the main page).
  searchText?: string
}

const symptomTag = (surgeryId: string, includeDisabled: boolean) =>
  `symptoms:${surgeryId}:${includeDisabled ? 'with-disabled' : 'enabled'}`

type SymptomOptions = {
  includeDisabled?: boolean
  includeRichContent?: boolean
}

// instructionsHtml is always selected (even for the slim payload) because the
// search index must be derived from the displayed content; it is stripped from
// the returned symptoms when rich content is not requested.
const baseFields = (includeRichContent: boolean) => ({
  id: true,
  slug: true,
  name: true,
  ageGroup: true,
  briefInstruction: true,
  highlightedText: true,
  instructions: true,
  linkToPage: true,
  instructionsHtml: true,
  ...(includeRichContent
    ? {
        instructionsJson: true,
        variants: true as any
      }
    : {})
})

const overrideFields = (includeRichContent: boolean) => ({
  baseSymptomId: true,
  name: true,
  ageGroup: true,
  briefInstruction: true,
  highlightedText: true,
  instructions: true,
  linkToPage: true,
  isHidden: true,
  instructionsHtml: true,
  ...(includeRichContent
    ? {
        instructionsJson: true
      }
    : {})
})

const customFields = (includeRichContent: boolean) => ({
  id: true,
  slug: true,
  name: true,
  ageGroup: true,
  briefInstruction: true,
  highlightedText: true,
  instructions: true,
  linkToPage: true,
  instructionsHtml: true,
  ...(includeRichContent
    ? {
        instructionsJson: true
      }
    : {})
})

async function buildEffectiveSymptoms(
  surgeryId: string,
  { includeDisabled = false, includeRichContent = true }: SymptomOptions = {}
): Promise<EffectiveSymptom[]> {
  const [base, overrides, customs, statuses] = await prisma.$transaction([
    prisma.baseSymptom.findMany({
      where: { isDeleted: false },
      select: baseFields(includeRichContent),
      orderBy: { name: 'asc' }
    }),
    prisma.surgerySymptomOverride.findMany({
      where: { surgeryId },
      select: overrideFields(includeRichContent)
    }),
    prisma.surgeryCustomSymptom.findMany({
      where: { surgeryId, isDeleted: false },
      select: customFields(includeRichContent)
    }),
    prisma.surgerySymptomStatus.findMany({
      where: { surgeryId },
      select: { id: true, baseSymptomId: true, customSymptomId: true, isEnabled: true }
    })
  ])
  const disabledBaseIds = new Set(
    statuses.filter(s => s.baseSymptomId && s.isEnabled === false).map(s => s.baseSymptomId!)
  )
  const disabledCustomIds = new Set(
    statuses.filter(s => s.customSymptomId && s.isEnabled === false).map(s => s.customSymptomId!)
  )

  // Merge base+overrides; include customs
  const byBaseId = new Map<string, EffectiveSymptom>(
    base.map(b => [
      b.id,
      {
        ...b,
        ageGroup: b.ageGroup as 'U5' | 'O5' | 'Adult',
        source: 'base' as const,
        disabled: disabledBaseIds.has(b.id),
        instructionsJson: includeRichContent ? (b as any).instructionsJson ?? null : null,
        instructionsHtml: (b as any).instructionsHtml ?? null,
        variants: includeRichContent ? (b as any).variants ?? null : null
      }
    ])
  )
  
  for (const o of overrides) {
    const b = byBaseId.get(o.baseSymptomId)
    if (!b) continue
    
    // If symptom is hidden, skip it entirely
    if (o.isHidden) {
      byBaseId.delete(o.baseSymptomId)
      continue
    }
    // If explicitly disabled via status row, remove from list unless including disabled
    if (!includeDisabled && disabledBaseIds.has(o.baseSymptomId)) {
      byBaseId.delete(o.baseSymptomId)
      continue
    }
    
    byBaseId.set(o.baseSymptomId, {
      ...b,
      name: (o.name && o.name.trim() !== '') ? o.name : b.name,
      ageGroup: (o.ageGroup && o.ageGroup.trim() !== '') ? o.ageGroup as 'U5' | 'O5' | 'Adult' : b.ageGroup as 'U5' | 'O5' | 'Adult',
      briefInstruction: o.briefInstruction == null ? b.briefInstruction : o.briefInstruction,
      highlightedText: o.highlightedText == null ? b.highlightedText : o.highlightedText,
      instructions: o.instructions == null ? b.instructions : o.instructions,
      linkToPage: (o.linkToPage && o.linkToPage.trim() !== '') ? o.linkToPage : b.linkToPage,
      instructionsJson: includeRichContent ? ((o as any).instructionsJson == null ? ((b as any).instructionsJson ?? null) : (o as any).instructionsJson) : null,
      instructionsHtml: (o as any).instructionsHtml == null ? ((b as any).instructionsHtml ?? null) : (o as any).instructionsHtml,
      source: 'override' as const,
      baseSymptomId: b.id,
      isHidden: o.isHidden,
      disabled: disabledBaseIds.has(o.baseSymptomId),
    })
  }
  
  // Apply disables for base symptoms without overrides (status row may still disable)
  if (!includeDisabled) {
    for (const baseId of disabledBaseIds) {
      if (byBaseId.has(baseId)) {
        byBaseId.delete(baseId)
      }
    }
  }

  const effective = Array.from(byBaseId.values())
  const customsProjected = customs
    .filter(c => includeDisabled ? true : !disabledCustomIds.has(c.id))
    .map(c => ({
    ...c,
    ageGroup: c.ageGroup as 'U5' | 'O5' | 'Adult',
    source: 'custom' as const,
    disabled: disabledCustomIds.has(c.id),
    instructionsJson: includeRichContent ? (c as any).instructionsJson ?? null : null,
    instructionsHtml: (c as any).instructionsHtml ?? null
  }))

  // Compute the search index from the effective (merged) content, then strip
  // the HTML from the slim payload — search must reflect what is displayed
  // even when rich content is not shipped to the client.
  return [...effective, ...customsProjected].map(symptom => ({
    ...symptom,
    searchText: getSymptomSearchText(symptom),
    ...(includeRichContent ? {} : { instructionsHtml: null })
  }))
}

export async function getEffectiveSymptoms(
  surgeryId: string,
  includeDisabled: boolean = false
): Promise<EffectiveSymptom[]> {
  return buildEffectiveSymptoms(surgeryId, { includeDisabled, includeRichContent: true })
}

export async function getCachedEffectiveSymptoms(
  surgeryId: string,
  includeDisabled: boolean = false
): Promise<EffectiveSymptom[]> {
  const cached = unstable_cache(
    async () => buildEffectiveSymptoms(surgeryId, { includeDisabled, includeRichContent: false }),
    // v2: payload gained searchText — keep old cache entries from being served
    ['effective-symptoms-v2', surgeryId, includeDisabled ? 'with-disabled' : 'enabled'],
    {
      revalidate: 300,
      tags: ['symptoms', symptomTag(surgeryId, includeDisabled)]
    }
  )

  return cached()
}

export const getCachedSymptomsTag = symptomTag

export async function getEffectiveSymptomById(id: string, surgeryId?: string): Promise<EffectiveSymptom | null> {
  if (!surgeryId) {
    const base = await prisma.baseSymptom.findUnique({
      where: { id },
      select: {
        id: true, slug: true, name: true, ageGroup: true,
        briefInstruction: true, highlightedText: true, instructions: true,
        instructionsJson: true, instructionsHtml: true, linkToPage: true, variants: true
      }
    })
    return base ? { ...base, ageGroup: base.ageGroup as 'U5' | 'O5' | 'Adult', source: 'base' as const } : null
  }

  // Check if it's a custom symptom first
  const custom = await prisma.surgeryCustomSymptom.findFirst({
    where: { id, surgeryId },
    select: {
      id: true, slug: true, name: true, ageGroup: true,
      briefInstruction: true, highlightedText: true, instructions: true,
      instructionsJson: true, instructionsHtml: true, linkToPage: true
    }
  })
  if (custom) {
    return { ...custom, ageGroup: custom.ageGroup as 'U5' | 'O5' | 'Adult', source: 'custom' as const }
  }

  // Get base symptom
  const base = await prisma.baseSymptom.findUnique({
    where: { id },
    select: {
      id: true, slug: true, name: true, ageGroup: true,
      briefInstruction: true, highlightedText: true, instructions: true,
      instructionsJson: true, instructionsHtml: true, linkToPage: true, variants: true as any
    }
  })
  if (!base) return null

  // Check for override
  const override = await prisma.surgerySymptomOverride.findUnique({
    where: { surgeryId_baseSymptomId: { surgeryId, baseSymptomId: id } },
    select: {
      name: true, ageGroup: true, briefInstruction: true, highlightedText: true,
      instructions: true, instructionsJson: true, instructionsHtml: true,
      linkToPage: true, isHidden: true
    }
  })

  if (override) {
    if (override.isHidden) return null
    return {
      ...base,
      name: (override.name && override.name.trim() !== '') ? override.name : base.name,
      ageGroup: (override.ageGroup && override.ageGroup.trim() !== '') ? override.ageGroup as 'U5' | 'O5' | 'Adult' : base.ageGroup as 'U5' | 'O5' | 'Adult',
      briefInstruction: override.briefInstruction == null ? base.briefInstruction : override.briefInstruction,
      highlightedText: override.highlightedText == null ? base.highlightedText : override.highlightedText,
      instructions: override.instructions == null ? base.instructions : override.instructions,
      instructionsJson: override.instructionsJson == null ? base.instructionsJson : override.instructionsJson,
      instructionsHtml: override.instructionsHtml == null ? base.instructionsHtml : override.instructionsHtml,
      linkToPage: (override.linkToPage && override.linkToPage.trim() !== '') ? override.linkToPage : base.linkToPage,
      source: 'override' as const,
      baseSymptomId: base.id,
      isHidden: override.isHidden,
    } as any
  }

  return { ...base, ageGroup: base.ageGroup as 'U5' | 'O5' | 'Adult', source: 'base' as const }
}

export async function getEffectiveSymptomBySlug(slug: string, surgeryId?: string): Promise<EffectiveSymptom | null> {
  if (!surgeryId) {
    // Return base symptom if no surgery context
    const base = await prisma.baseSymptom.findUnique({
      where: { slug },
      select: { 
        id: true, 
        slug: true, 
        name: true, 
        ageGroup: true,
        briefInstruction: true, 
        highlightedText: true, 
        instructions: true, 
        instructionsJson: true,
        instructionsHtml: true,
        linkToPage: true,
        variants: true
      }
    })
    
    return base ? { ...base, ageGroup: base.ageGroup as 'U5' | 'O5' | 'Adult', source: 'base' as const } : null
  }

  // Check if it's a custom symptom first
  const custom = await prisma.surgeryCustomSymptom.findFirst({
    where: { 
      slug,
      surgeryId 
    },
    select: { 
      id: true, 
      slug: true, 
      name: true, 
      ageGroup: true,
      briefInstruction: true, 
      highlightedText: true, 
      instructions: true, 
      instructionsJson: true,
      instructionsHtml: true,
      linkToPage: true 
    }
  })
  
  if (custom) {
    return { ...custom, ageGroup: custom.ageGroup as 'U5' | 'O5' | 'Adult', source: 'custom' as const }
  }

  // Get base symptom
  const base = await prisma.baseSymptom.findUnique({
    where: { slug },
    select: { 
      id: true, 
      slug: true, 
      name: true, 
      ageGroup: true,
      briefInstruction: true, 
      highlightedText: true, 
      instructions: true, 
      instructionsJson: true,
      instructionsHtml: true,
      linkToPage: true,
      variants: true as any
    }
  })
  
  if (!base) return null

  // Check for override
  const override = await prisma.surgerySymptomOverride.findUnique({
    where: {
      surgeryId_baseSymptomId: {
        surgeryId,
        baseSymptomId: base.id
      }
    },
    select: {
      name: true,
      ageGroup: true,
      briefInstruction: true,
      highlightedText: true,
      instructions: true,
      instructionsJson: true,
      instructionsHtml: true,
      linkToPage: true,
      isHidden: true
    }
  })

  if (override) {
    // If symptom is hidden, return null
    if (override.isHidden) {
      return null
    }
    
    return {
      ...base,
      name: (override.name && override.name.trim() !== '') ? override.name : base.name,
      ageGroup: (override.ageGroup && override.ageGroup.trim() !== '') ? override.ageGroup as 'U5' | 'O5' | 'Adult' : base.ageGroup as 'U5' | 'O5' | 'Adult',
      briefInstruction: override.briefInstruction == null ? base.briefInstruction : override.briefInstruction,
      highlightedText: override.highlightedText == null ? base.highlightedText : override.highlightedText,
      instructions: override.instructions == null ? base.instructions : override.instructions,
      instructionsJson: override.instructionsJson == null ? base.instructionsJson : override.instructionsJson,
      instructionsHtml: override.instructionsHtml == null ? base.instructionsHtml : override.instructionsHtml,
      linkToPage: (override.linkToPage && override.linkToPage.trim() !== '') ? override.linkToPage : base.linkToPage,
      source: 'override' as const,
      isHidden: override.isHidden,
    }
  }

  return { ...base, ageGroup: base.ageGroup as 'U5' | 'O5' | 'Adult', source: 'base' as const }
}

export async function getEffectiveSymptomByName(name: string, surgeryId?: string): Promise<EffectiveSymptom | null> {
  if (!surgeryId) {
    const base = await prisma.baseSymptom.findFirst({
      where: { name: { equals: name.trim(), mode: 'insensitive' } },
      select: {
        id: true, slug: true, name: true, ageGroup: true,
        briefInstruction: true, highlightedText: true, instructions: true,
        instructionsJson: true, instructionsHtml: true, linkToPage: true, variants: true
      }
    })
    return base ? { ...base, ageGroup: base.ageGroup as 'U5' | 'O5' | 'Adult', source: 'base' as const } : null
  }

  // Check if it's a custom symptom first
  const custom = await prisma.surgeryCustomSymptom.findFirst({
    where: { name: { equals: name.trim(), mode: 'insensitive' }, surgeryId },
    select: {
      id: true, slug: true, name: true, ageGroup: true,
      briefInstruction: true, highlightedText: true, instructions: true,
      instructionsJson: true, instructionsHtml: true, linkToPage: true
    }
  })
  if (custom) {
    return { ...custom, ageGroup: custom.ageGroup as 'U5' | 'O5' | 'Adult', source: 'custom' as const }
  }

  // Search base symptoms
  const base = await prisma.baseSymptom.findFirst({
    where: { name: { equals: name.trim(), mode: 'insensitive' } },
    select: {
      id: true, slug: true, name: true, ageGroup: true,
      briefInstruction: true, highlightedText: true, instructions: true,
      instructionsJson: true, instructionsHtml: true, linkToPage: true, variants: true as any
    }
  })
  if (!base) return null

  // Check for override
  const override = await prisma.surgerySymptomOverride.findUnique({
    where: { surgeryId_baseSymptomId: { surgeryId, baseSymptomId: base.id } }
  })

  if (override) {
    if (override.isHidden) return null
    return {
      ...base,
      name: (override.name && override.name.trim() !== '') ? override.name : base.name,
      ageGroup: (override.ageGroup && override.ageGroup.trim() !== '') ? override.ageGroup as 'U5' | 'O5' | 'Adult' : base.ageGroup as 'U5' | 'O5' | 'Adult',
      briefInstruction: override.briefInstruction == null ? base.briefInstruction : override.briefInstruction,
      highlightedText: override.highlightedText == null ? base.highlightedText : override.highlightedText,
      instructions: override.instructions == null ? base.instructions : override.instructions,
      instructionsJson: override.instructionsJson == null ? base.instructionsJson : override.instructionsJson,
      instructionsHtml: override.instructionsHtml == null ? base.instructionsHtml : override.instructionsHtml,
      linkToPage: (override.linkToPage && override.linkToPage.trim() !== '') ? override.linkToPage : base.linkToPage,
      source: 'override' as const,
      baseSymptomId: base.id,
      isHidden: override.isHidden,
    }
  }

  return { ...base, ageGroup: base.ageGroup as 'U5' | 'O5' | 'Adult', source: 'base' as const }
}
