import { prisma } from './prisma'

export interface EffectiveSymptom {
  id: string
  customId?: string
  symptom: string
  ageGroup: string
  briefInstruction: string
  instructions: string
  highlightedText?: string
  linkToPage?: string
}

export async function getEffectiveSymptoms(surgerySlug?: string): Promise<EffectiveSymptom[]> {
  // Get surgery if slug provided
  const surgery = surgerySlug ? await prisma.surgery.findUnique({
    where: { slug: surgerySlug }
  }) : null

  // Get all base symptoms
  const baseSymptoms = await prisma.baseSymptom.findMany({
    orderBy: { name: 'asc' }
  })

  // Get overrides for this surgery if it exists
  const overrides = surgery ? await prisma.surgerySymptomOverride.findMany({
    where: { surgeryId: surgery.id }
  }) : []

  // Create a map of overrides by baseId for quick lookup
  const overrideMap = new Map(overrides.map(override => [override.baseSymptomId, override]))

  // Merge base symptoms with overrides
  const effectiveSymptoms: EffectiveSymptom[] = baseSymptoms.map(base => {
    const override = overrideMap.get(base.id)
    
    return {
      id: base.id,
      symptom: override?.name ?? base.name,
      ageGroup: (override?.ageGroup ?? base.ageGroup) as 'U5' | 'O5' | 'Adult',
      briefInstruction: override?.briefInstruction ?? base.briefInstruction,
      instructions: override?.instructions ?? base.instructions,
      highlightedText: override?.highlightedText ?? base.highlightedText,
      linkToPage: override?.linkToPage ?? base.linkToPage,
    }
  })

  return effectiveSymptoms
}

export async function getEffectiveSymptomById(id: string, surgerySlug?: string): Promise<EffectiveSymptom | null> {
  // Get surgery if slug provided
  const surgery = surgerySlug ? await prisma.surgery.findUnique({
    where: { slug: surgerySlug }
  }) : null

  // Get base symptom
  const baseSymptom = await prisma.baseSymptom.findUnique({
    where: { id }
  })

  if (!baseSymptom) return null

  // Get override for this surgery if it exists
  const override = surgery ? await prisma.surgerySymptomOverride.findUnique({
    where: {
      surgeryId_baseSymptomId: {
        surgeryId: surgery.id,
        baseSymptomId: id
      }
    }
  }) : null

  // Merge base with override
  return {
    id: baseSymptom.id,
    symptom: override?.name ?? baseSymptom.name,
    ageGroup: (override?.ageGroup ?? baseSymptom.ageGroup) as 'U5' | 'O5' | 'Adult',
    briefInstruction: override?.briefInstruction ?? baseSymptom.briefInstruction,
    instructions: override?.instructions ?? baseSymptom.instructions,
    highlightedText: override?.highlightedText ?? baseSymptom.highlightedText,
    linkToPage: override?.linkToPage ?? baseSymptom.linkToPage,
  }
}

export async function logEngagementEvent(
  baseId: string, 
  event: string, 
  surgerySlug?: string, 
  userEmail?: string
) {
  const surgery = surgerySlug ? await prisma.surgery.findUnique({
    where: { slug: surgerySlug }
  }) : null

  await prisma.engagementEvent.create({
    data: {
      baseId,
      event,
      surgeryId: surgery?.id,
      userEmail,
    }
  })
}
