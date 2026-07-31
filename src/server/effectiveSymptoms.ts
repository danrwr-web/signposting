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
  linkToPage: string | null // Legacy single link — mirrors linkToPages[0]
  linkToPages: string[] | null // Related-symptom names, resolved by name at click time
  // False for opt-in base symptoms (promoted from a practice) that this
  // surgery has not adopted yet. Absent on custom symptoms.
  enabledByDefault?: boolean
  source: 'base' | 'override' | 'custom'
  baseSymptomId?: string // For overrides, this is the base symptom ID
  isHidden?: boolean // For overrides, indicates if symptom is hidden for this surgery
  disabled?: boolean // True if disabled for this surgery (only meaningful when includeDisabled is set)
  // Effective variants JSON. Base variants unless the surgery's override sets
  // its own (null = inherit; {"ageGroups":[]} = hidden for this surgery).
  variants?: unknown | null
  // Raw values behind the merge, present on override-source symptoms so the
  // editor can tell inherited variants apart from surgery-customised ones.
  baseVariants?: unknown | null
  overrideVariants?: unknown | null
  // Plain-text search index derived from the displayed content. Computed
  // server-side so search works even when rich content is omitted from the
  // payload (the slim cached path used for the main page).
  searchText?: string
}

const symptomTag = (surgeryId: string, includeDisabled: boolean) =>
  `symptoms:${surgeryId}:${includeDisabled ? 'with-disabled' : 'enabled'}`

// Parse a stored linkToPages JSON value. Returns null when the value is not
// an array (i.e. unset); an empty array is meaningful — on overrides it means
// "explicitly no links for this surgery".
function parseLinkToPages(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  return value
    .filter((v): v is string => typeof v === 'string' && v.trim() !== '')
    .map(v => v.trim())
}

// Resolve a row's related-symptom links: the JSON array when present, else
// the legacy single-value linkToPage column (rows written by older paths).
export function resolveLinkToPages(row: { linkToPages?: unknown; linkToPage?: string | null }): string[] | null {
  const parsed = parseLinkToPages(row.linkToPages)
  if (parsed !== null) return parsed
  const legacy = row.linkToPage?.trim()
  return legacy ? [legacy] : null
}

// Merge override links onto base links. Tri-state on the override: null =
// inherit base links, [] = explicitly none, [...] = replace. Falls back to
// the override's legacy linkToPage (non-blank means replace, matching the
// old single-link merge rule).
export function mergeLinkToPages(
  override: { linkToPages?: unknown; linkToPage?: string | null },
  baseLinks: string[] | null
): string[] | null {
  const overrideLinks = parseLinkToPages(override.linkToPages)
  if (overrideLinks !== null) return overrideLinks
  const legacy = override.linkToPage?.trim()
  return legacy ? [legacy] : baseLinks
}

// Project a raw row's link columns into the EffectiveSymptom shape (resolved
// array plus the legacy first-entry mirror).
function projectLinkFields(row: { linkToPages?: unknown; linkToPage?: string | null }) {
  const links = resolveLinkToPages(row)
  return { linkToPages: links, linkToPage: links?.[0] ?? null }
}

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
  linkToPages: true,
  enabledByDefault: true,
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
  linkToPages: true,
  isHidden: true,
  instructionsHtml: true,
  ...(includeRichContent
    ? {
        instructionsJson: true,
        variants: true as any
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
  linkToPages: true,
  instructionsHtml: true,
  ...(includeRichContent
    ? {
        instructionsJson: true,
        variants: true as any
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

  // Opt-in base symptoms (enabledByDefault=false) count as disabled until the
  // surgery explicitly adopts them — a status row with isEnabled=true wins.
  const explicitlyEnabledBaseIds = new Set(
    statuses.filter(s => s.baseSymptomId && s.isEnabled === true).map(s => s.baseSymptomId!)
  )
  for (const b of base) {
    if ((b as any).enabledByDefault === false && !explicitlyEnabledBaseIds.has(b.id)) {
      disabledBaseIds.add(b.id)
    }
  }

  // Merge base+overrides; include customs
  const byBaseId = new Map<string, EffectiveSymptom>(
    base.map(b => {
      const links = resolveLinkToPages(b)
      return [
        b.id,
        {
          ...b,
          ageGroup: b.ageGroup as 'U5' | 'O5' | 'Adult',
          linkToPages: links,
          linkToPage: links?.[0] ?? null,
          source: 'base' as const,
          disabled: disabledBaseIds.has(b.id),
          instructionsJson: includeRichContent ? (b as any).instructionsJson ?? null : null,
          instructionsHtml: (b as any).instructionsHtml ?? null,
          variants: includeRichContent ? (b as any).variants ?? null : null
        }
      ]
    })
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
    
    const mergedLinks = mergeLinkToPages(o, b.linkToPages)
    byBaseId.set(o.baseSymptomId, {
      ...b,
      name: (o.name && o.name.trim() !== '') ? o.name : b.name,
      ageGroup: (o.ageGroup && o.ageGroup.trim() !== '') ? o.ageGroup as 'U5' | 'O5' | 'Adult' : b.ageGroup as 'U5' | 'O5' | 'Adult',
      briefInstruction: o.briefInstruction == null ? b.briefInstruction : o.briefInstruction,
      highlightedText: o.highlightedText == null ? b.highlightedText : o.highlightedText,
      instructions: o.instructions == null ? b.instructions : o.instructions,
      linkToPages: mergedLinks,
      linkToPage: mergedLinks?.[0] ?? null,
      instructionsJson: includeRichContent ? ((o as any).instructionsJson == null ? ((b as any).instructionsJson ?? null) : (o as any).instructionsJson) : null,
      instructionsHtml: (o as any).instructionsHtml == null ? ((b as any).instructionsHtml ?? null) : (o as any).instructionsHtml,
      variants: includeRichContent ? ((o as any).variants == null ? ((b as any).variants ?? null) : (o as any).variants) : null,
      baseVariants: includeRichContent ? ((b as any).variants ?? null) : null,
      overrideVariants: includeRichContent ? ((o as any).variants ?? null) : null,
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
    .map(c => {
      const links = resolveLinkToPages(c)
      return {
        ...c,
        ageGroup: c.ageGroup as 'U5' | 'O5' | 'Adult',
        linkToPages: links,
        linkToPage: links?.[0] ?? null,
        source: 'custom' as const,
        disabled: disabledCustomIds.has(c.id),
        instructionsJson: includeRichContent ? (c as any).instructionsJson ?? null : null,
        instructionsHtml: (c as any).instructionsHtml ?? null,
        variants: includeRichContent ? (c as any).variants ?? null : null
      }
    })

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
        instructionsJson: true, instructionsHtml: true, linkToPage: true, linkToPages: true, variants: true
      }
    })
    return base ? { ...base, ...projectLinkFields(base), ageGroup: base.ageGroup as 'U5' | 'O5' | 'Adult', source: 'base' as const } : null
  }

  // Check if it's a custom symptom first
  const custom = await prisma.surgeryCustomSymptom.findFirst({
    where: { id, surgeryId },
    select: {
      id: true, slug: true, name: true, ageGroup: true,
      briefInstruction: true, highlightedText: true, instructions: true,
      instructionsJson: true, instructionsHtml: true, linkToPage: true, linkToPages: true, variants: true
    }
  })
  if (custom) {
    return { ...custom, ...projectLinkFields(custom), ageGroup: custom.ageGroup as 'U5' | 'O5' | 'Adult', source: 'custom' as const }
  }

  // Get base symptom
  const base = await prisma.baseSymptom.findUnique({
    where: { id },
    select: {
      id: true, slug: true, name: true, ageGroup: true,
      briefInstruction: true, highlightedText: true, instructions: true,
      instructionsJson: true, instructionsHtml: true, linkToPage: true, linkToPages: true, variants: true as any
    }
  })
  if (!base) return null

  // Check for override
  const override = await prisma.surgerySymptomOverride.findUnique({
    where: { surgeryId_baseSymptomId: { surgeryId, baseSymptomId: id } },
    select: {
      name: true, ageGroup: true, briefInstruction: true, highlightedText: true,
      instructions: true, instructionsJson: true, instructionsHtml: true,
      linkToPage: true, linkToPages: true, isHidden: true, variants: true
    }
  })

  if (override) {
    if (override.isHidden) return null
    const mergedLinks = mergeLinkToPages(override, resolveLinkToPages(base))
    return {
      ...base,
      name: (override.name && override.name.trim() !== '') ? override.name : base.name,
      ageGroup: (override.ageGroup && override.ageGroup.trim() !== '') ? override.ageGroup as 'U5' | 'O5' | 'Adult' : base.ageGroup as 'U5' | 'O5' | 'Adult',
      briefInstruction: override.briefInstruction == null ? base.briefInstruction : override.briefInstruction,
      highlightedText: override.highlightedText == null ? base.highlightedText : override.highlightedText,
      instructions: override.instructions == null ? base.instructions : override.instructions,
      instructionsJson: override.instructionsJson == null ? base.instructionsJson : override.instructionsJson,
      instructionsHtml: override.instructionsHtml == null ? base.instructionsHtml : override.instructionsHtml,
      linkToPages: mergedLinks,
      linkToPage: mergedLinks?.[0] ?? null,
      variants: (override as any).variants == null ? ((base as any).variants ?? null) : (override as any).variants,
      baseVariants: (base as any).variants ?? null,
      overrideVariants: (override as any).variants ?? null,
      source: 'override' as const,
      baseSymptomId: base.id,
      isHidden: override.isHidden,
    } as any
  }

  return { ...base, ...projectLinkFields(base), ageGroup: base.ageGroup as 'U5' | 'O5' | 'Adult', source: 'base' as const }
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
        linkToPages: true,
        variants: true
      }
    })
    
    return base ? { ...base, ...projectLinkFields(base), ageGroup: base.ageGroup as 'U5' | 'O5' | 'Adult', source: 'base' as const } : null
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
      linkToPage: true,
      linkToPages: true,
      variants: true
    }
  })
  
  if (custom) {
    return { ...custom, ...projectLinkFields(custom), ageGroup: custom.ageGroup as 'U5' | 'O5' | 'Adult', source: 'custom' as const }
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
      linkToPages: true,
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
      linkToPages: true,
      isHidden: true,
      variants: true
    }
  })

  if (override) {
    // If symptom is hidden, return null
    if (override.isHidden) {
      return null
    }

    const mergedLinks = mergeLinkToPages(override, resolveLinkToPages(base))
    return {
      ...base,
      name: (override.name && override.name.trim() !== '') ? override.name : base.name,
      ageGroup: (override.ageGroup && override.ageGroup.trim() !== '') ? override.ageGroup as 'U5' | 'O5' | 'Adult' : base.ageGroup as 'U5' | 'O5' | 'Adult',
      briefInstruction: override.briefInstruction == null ? base.briefInstruction : override.briefInstruction,
      highlightedText: override.highlightedText == null ? base.highlightedText : override.highlightedText,
      instructions: override.instructions == null ? base.instructions : override.instructions,
      instructionsJson: override.instructionsJson == null ? base.instructionsJson : override.instructionsJson,
      instructionsHtml: override.instructionsHtml == null ? base.instructionsHtml : override.instructionsHtml,
      linkToPages: mergedLinks,
      linkToPage: mergedLinks?.[0] ?? null,
      variants: (override as any).variants == null ? ((base as any).variants ?? null) : (override as any).variants,
      baseVariants: (base as any).variants ?? null,
      overrideVariants: (override as any).variants ?? null,
      source: 'override' as const,
      isHidden: override.isHidden,
    }
  }

  return { ...base, ...projectLinkFields(base), ageGroup: base.ageGroup as 'U5' | 'O5' | 'Adult', source: 'base' as const }
}

export async function getEffectiveSymptomByName(name: string, surgeryId?: string): Promise<EffectiveSymptom | null> {
  if (!surgeryId) {
    const base = await prisma.baseSymptom.findFirst({
      where: { name: { equals: name.trim(), mode: 'insensitive' } },
      select: {
        id: true, slug: true, name: true, ageGroup: true,
        briefInstruction: true, highlightedText: true, instructions: true,
        instructionsJson: true, instructionsHtml: true, linkToPage: true, linkToPages: true, variants: true
      }
    })
    return base ? { ...base, ...projectLinkFields(base), ageGroup: base.ageGroup as 'U5' | 'O5' | 'Adult', source: 'base' as const } : null
  }

  // Check if it's a custom symptom first
  const custom = await prisma.surgeryCustomSymptom.findFirst({
    where: { name: { equals: name.trim(), mode: 'insensitive' }, surgeryId },
    select: {
      id: true, slug: true, name: true, ageGroup: true,
      briefInstruction: true, highlightedText: true, instructions: true,
      instructionsJson: true, instructionsHtml: true, linkToPage: true, linkToPages: true, variants: true
    }
  })
  if (custom) {
    return { ...custom, ...projectLinkFields(custom), ageGroup: custom.ageGroup as 'U5' | 'O5' | 'Adult', source: 'custom' as const }
  }

  // Search base symptoms
  const base = await prisma.baseSymptom.findFirst({
    where: { name: { equals: name.trim(), mode: 'insensitive' } },
    select: {
      id: true, slug: true, name: true, ageGroup: true,
      briefInstruction: true, highlightedText: true, instructions: true,
      instructionsJson: true, instructionsHtml: true, linkToPage: true, linkToPages: true, variants: true as any
    }
  })
  if (!base) return null

  // Check for override
  const override = await prisma.surgerySymptomOverride.findUnique({
    where: { surgeryId_baseSymptomId: { surgeryId, baseSymptomId: base.id } }
  })

  if (override) {
    if (override.isHidden) return null
    const mergedLinks = mergeLinkToPages(override, resolveLinkToPages(base))
    return {
      ...base,
      name: (override.name && override.name.trim() !== '') ? override.name : base.name,
      ageGroup: (override.ageGroup && override.ageGroup.trim() !== '') ? override.ageGroup as 'U5' | 'O5' | 'Adult' : base.ageGroup as 'U5' | 'O5' | 'Adult',
      briefInstruction: override.briefInstruction == null ? base.briefInstruction : override.briefInstruction,
      highlightedText: override.highlightedText == null ? base.highlightedText : override.highlightedText,
      instructions: override.instructions == null ? base.instructions : override.instructions,
      instructionsJson: override.instructionsJson == null ? base.instructionsJson : override.instructionsJson,
      instructionsHtml: override.instructionsHtml == null ? base.instructionsHtml : override.instructionsHtml,
      linkToPages: mergedLinks,
      linkToPage: mergedLinks?.[0] ?? null,
      variants: (override as any).variants == null ? ((base as any).variants ?? null) : (override as any).variants,
      baseVariants: (base as any).variants ?? null,
      overrideVariants: (override as any).variants ?? null,
      source: 'override' as const,
      baseSymptomId: base.id,
      isHidden: override.isHidden,
    }
  }

  return { ...base, ...projectLinkFields(base), ageGroup: base.ageGroup as 'U5' | 'O5' | 'Adult', source: 'base' as const }
}
