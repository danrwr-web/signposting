/**
 * Server-only effective symptoms management
 * Handles merging base symptoms with surgery-specific overrides and custom symptoms
 */

import 'server-only'
import { prisma } from '@/lib/prisma'
import { unstable_cache } from 'next/cache'

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
  variants?: unknown | null // Optional variants JSON from BaseSymptom
}

const symptomTag = (surgeryId: string, includeDisabled: boolean) =>
  `symptoms:${surgeryId}:${includeDisabled ? 'with-disabled' : 'enabled'}`

type SymptomOptions = {
  includeDisabled?: boolean
  includeRichContent?: boolean
}

const baseFields = (includeRichContent: boolean) => ({
  id: true,
  slug: true,
  name: true,
  ageGroup: true,
  briefInstruction: true,
  highlightedText: true,
  instructions: true,
  linkToPage: true,
  ...(includeRichContent
    ? {
        instructionsJson: true,
        instructionsHtml: true,
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
  ...(includeRichContent
    ? {
        instructionsJson: true,
        instructionsHtml: true
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
  ...(includeRichContent
    ? {
        instructionsJson: true,
        instructionsHtml: true
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
        instructionsJson: includeRichContent ? (b as any).instructionsJson ?? null : null,
        instructionsHtml: includeRichContent ? (b as any).instructionsHtml ?? null : null,
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
      briefInstruction: (o.briefInstruction && o.briefInstruction.trim() !== '') ? o.briefInstruction : b.briefInstruction,
      highlightedText: (o.highlightedText && o.highlightedText.trim() !== '') ? o.highlightedText : b.highlightedText,
      instructions: (o.instructions && o.instructions.trim() !== '') ? o.instructions : b.instructions,
      linkToPage: (o.linkToPage && o.linkToPage.trim() !== '') ? o.linkToPage : b.linkToPage,
      instructionsJson: includeRichContent ? ((o as any).instructionsJson && (o as any).instructionsJson.trim() !== '' ? (o as any).instructionsJson : (b as any).instructionsJson ?? null) : null,
      instructionsHtml: includeRichContent ? ((o as any).instructionsHtml && (o as any).instructionsHtml.trim() !== '' ? (o as any).instructionsHtml : (b as any).instructionsHtml ?? null) : null,
      source: 'override' as const,
      baseSymptomId: b.id,
      isHidden: o.isHidden,
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
    instructionsJson: includeRichContent ? (c as any).instructionsJson ?? null : null,
    instructionsHtml: includeRichContent ? (c as any).instructionsHtml ?? null : null
  }))
  
  return [...effective, ...customsProjected]
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
    ['effective-symptoms', surgeryId, includeDisabled ? 'with-disabled' : 'enabled'],
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
      briefInstruction: (override.briefInstruction && override.briefInstruction.trim() !== '') ? override.briefInstruction : base.briefInstruction,
      highlightedText: (override.highlightedText && override.highlightedText.trim() !== '') ? override.highlightedText : base.highlightedText,
      instructions: (override.instructions && override.instructions.trim() !== '') ? override.instructions : base.instructions,
      instructionsJson: (override.instructionsJson && override.instructionsJson.trim() !== '') ? override.instructionsJson : base.instructionsJson,
      instructionsHtml: (override.instructionsHtml && override.instructionsHtml.trim() !== '') ? override.instructionsHtml : base.instructionsHtml,
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
      briefInstruction: (override.briefInstruction && override.briefInstruction.trim() !== '') ? override.briefInstruction : base.briefInstruction,
      highlightedText: (override.highlightedText && override.highlightedText.trim() !== '') ? override.highlightedText : base.highlightedText,
      instructions: (override.instructions && override.instructions.trim() !== '') ? override.instructions : base.instructions,
      instructionsJson: (override.instructionsJson && override.instructionsJson.trim() !== '') ? override.instructionsJson : base.instructionsJson,
      instructionsHtml: (override.instructionsHtml && override.instructionsHtml.trim() !== '') ? override.instructionsHtml : base.instructionsHtml,
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
      briefInstruction: (override.briefInstruction && override.briefInstruction.trim() !== '') ? override.briefInstruction : base.briefInstruction,
      highlightedText: (override.highlightedText && override.highlightedText.trim() !== '') ? override.highlightedText : base.highlightedText,
      instructions: (override.instructions && override.instructions.trim() !== '') ? override.instructions : base.instructions,
      instructionsJson: (override.instructionsJson && override.instructionsJson.trim() !== '') ? override.instructionsJson : base.instructionsJson,
      instructionsHtml: (override.instructionsHtml && override.instructionsHtml.trim() !== '') ? override.instructionsHtml : base.instructionsHtml,
      linkToPage: (override.linkToPage && override.linkToPage.trim() !== '') ? override.linkToPage : base.linkToPage,
      source: 'override' as const,
      baseSymptomId: base.id,
      isHidden: override.isHidden,
    }
  }

  return { ...base, ageGroup: base.ageGroup as 'U5' | 'O5' | 'Adult', source: 'base' as const }
}
