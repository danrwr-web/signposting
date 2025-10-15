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
  const baseSymptoms = await prisma.symptomBase.findMany({
    orderBy: { symptom: 'asc' }
  })

  // Get overrides for this surgery if it exists
  const overrides = surgery ? await prisma.symptomOverride.findMany({
    where: { surgeryId: surgery.id }
  }) : []

  // Create a map of overrides by baseId for quick lookup
  const overrideMap = new Map(overrides.map(override => [override.baseId, override]))

  // Merge base symptoms with overrides
  const effectiveSymptoms: EffectiveSymptom[] = baseSymptoms.map(base => {
    const override = overrideMap.get(base.id)
    
    return {
      id: base.id,
      customId: base.customId,
      symptom: override?.symptom ?? base.symptom,
      ageGroup: override?.ageGroup ?? base.ageGroup,
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
  const baseSymptom = await prisma.symptomBase.findUnique({
    where: { id }
  })

  if (!baseSymptom) return null

  // Get override for this surgery if it exists
  const override = surgery ? await prisma.symptomOverride.findUnique({
    where: {
      surgeryId_baseId: {
        surgeryId: surgery.id,
        baseId: id
      }
    }
  }) : null

  // Merge base with override
  return {
    id: baseSymptom.id,
    customId: baseSymptom.customId,
    symptom: override?.symptom ?? baseSymptom.symptom,
    ageGroup: override?.ageGroup ?? baseSymptom.ageGroup,
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
