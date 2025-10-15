/**
 * Server-only effective symptoms management
 * Handles merging base symptoms with surgery-specific overrides and custom symptoms
 */

import 'server-only'
import { prisma } from '@/lib/prisma'

export interface EffectiveSymptom {
  id: string
  slug: string
  name: string
  ageGroup: 'U5' | 'O5' | 'Adult'
  briefInstruction: string | null
  highlightedText: string | null
  instructions: string | null
  linkToPage: string | null
  source: 'base' | 'override' | 'custom'
  baseSymptomId?: string // For overrides, this is the base symptom ID
  isHidden?: boolean // For overrides, indicates if symptom is hidden for this surgery
}

export async function getEffectiveSymptoms(surgeryId: string): Promise<EffectiveSymptom[]> {
  // Base symptoms
  const base = await prisma.baseSymptom.findMany({
    select: { 
      id: true, 
      slug: true, 
      name: true, 
      ageGroup: true,
      briefInstruction: true, 
      highlightedText: true, 
      instructions: true, 
      linkToPage: true 
    },
    orderBy: { name: 'asc' }
  })

  // Overrides & customs
  const overrides = await prisma.surgerySymptomOverride.findMany({ 
    where: { surgeryId },
    select: {
      baseSymptomId: true,
      name: true,
      ageGroup: true,
      briefInstruction: true,
      highlightedText: true,
      instructions: true,
      linkToPage: true,
      isHidden: true
    }
  })
  const customs = await prisma.surgeryCustomSymptom.findMany({ 
    where: { surgeryId },
    select: {
      id: true,
      slug: true,
      name: true,
      ageGroup: true,
      briefInstruction: true,
      highlightedText: true,
      instructions: true,
      linkToPage: true
    }
  })

  // Merge base+overrides; include customs
  const byBaseId = new Map(base.map(b => [b.id, { ...b, source: 'base' as const }]))
  
  for (const o of overrides) {
    const b = byBaseId.get(o.baseSymptomId)
    if (!b) continue
    
    // If symptom is hidden, skip it entirely
    if (o.isHidden) {
      byBaseId.delete(o.baseSymptomId)
      continue
    }
    
    byBaseId.set(o.baseSymptomId, {
      ...b,
      name: (o.name && o.name.trim() !== '') ? o.name : b.name,
      ageGroup: (o.ageGroup && o.ageGroup.trim() !== '') ? o.ageGroup : b.ageGroup,
      briefInstruction: (o.briefInstruction && o.briefInstruction.trim() !== '') ? o.briefInstruction : b.briefInstruction,
      highlightedText: (o.highlightedText && o.highlightedText.trim() !== '') ? o.highlightedText : b.highlightedText,
      instructions: (o.instructions && o.instructions.trim() !== '') ? o.instructions : b.instructions,
      linkToPage: (o.linkToPage && o.linkToPage.trim() !== '') ? o.linkToPage : b.linkToPage,
      source: 'override' as const,
      isHidden: o.isHidden,
    })
  }
  
  const effective = Array.from(byBaseId.values())
  const customsProjected = customs.map(c => ({ 
    ...c, 
    source: 'custom' as const 
  }))
  
  return [...effective, ...customsProjected]
}

export async function getEffectiveSymptomById(id: string, surgeryId?: string): Promise<EffectiveSymptom | null> {
  if (!surgeryId) {
    // Return base symptom if no surgery context
    const base = await prisma.baseSymptom.findUnique({
      where: { id },
      select: { 
        id: true, 
        slug: true, 
        name: true, 
        ageGroup: true,
        briefInstruction: true, 
        highlightedText: true, 
        instructions: true, 
        linkToPage: true 
      }
    })
    
    return base ? { ...base, source: 'base' as const } : null
  }

  // Check if it's a custom symptom first
  const custom = await prisma.surgeryCustomSymptom.findFirst({
    where: { 
      id,
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
      linkToPage: true 
    }
  })
  
  if (custom) {
    return { ...custom, source: 'custom' as const }
  }

  // Get base symptom
  const base = await prisma.baseSymptom.findUnique({
    where: { id },
    select: { 
      id: true, 
      slug: true, 
      name: true, 
      ageGroup: true,
      briefInstruction: true, 
      highlightedText: true, 
      instructions: true, 
      linkToPage: true 
    }
  })
  
  if (!base) return null

  // Check for override
  const override = await prisma.surgerySymptomOverride.findUnique({
    where: {
      surgeryId_baseSymptomId: {
        surgeryId,
        baseSymptomId: id
      }
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
      ageGroup: (override.ageGroup && override.ageGroup.trim() !== '') ? override.ageGroup : base.ageGroup,
      briefInstruction: (override.briefInstruction && override.briefInstruction.trim() !== '') ? override.briefInstruction : base.briefInstruction,
      highlightedText: (override.highlightedText && override.highlightedText.trim() !== '') ? override.highlightedText : base.highlightedText,
      instructions: (override.instructions && override.instructions.trim() !== '') ? override.instructions : base.instructions,
      linkToPage: (override.linkToPage && override.linkToPage.trim() !== '') ? override.linkToPage : base.linkToPage,
      source: 'override' as const,
      baseSymptomId: base.id, // Include the base symptom ID for engagement logging
      isHidden: override.isHidden,
    }
  }

  return { ...base, source: 'base' as const }
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
        linkToPage: true 
      }
    })
    
    return base ? { ...base, source: 'base' as const } : null
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
      linkToPage: true 
    }
  })
  
  if (custom) {
    return { ...custom, source: 'custom' as const }
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
      linkToPage: true 
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
      ageGroup: (override.ageGroup && override.ageGroup.trim() !== '') ? override.ageGroup : base.ageGroup,
      briefInstruction: (override.briefInstruction && override.briefInstruction.trim() !== '') ? override.briefInstruction : base.briefInstruction,
      highlightedText: (override.highlightedText && override.highlightedText.trim() !== '') ? override.highlightedText : base.highlightedText,
      instructions: (override.instructions && override.instructions.trim() !== '') ? override.instructions : base.instructions,
      linkToPage: (override.linkToPage && override.linkToPage.trim() !== '') ? override.linkToPage : base.linkToPage,
      source: 'override' as const,
      isHidden: override.isHidden,
    }
  }

  return { ...base, source: 'base' as const }
}
