import 'server-only'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getEffectiveSymptomById, getEffectiveSymptomBySlug } from '@/server/effectiveSymptoms'
import InstructionView from '@/components/InstructionView'
import SimpleHeader from '@/components/SimpleHeader'

interface SymptomPageProps {
  params: Promise<{
    id: string
  }>
  searchParams: Promise<{
    surgery?: string
  }>
}

export default async function SymptomPage({ params, searchParams }: SymptomPageProps) {
  const resolvedParams = await params
  const { id } = resolvedParams
  const resolvedSearchParams = await searchParams
  const surgerySlug = resolvedSearchParams.surgery

  // Get surgery ID from slug
  let surgeryId: string | undefined
  if (surgerySlug) {
    const surgery = await prisma.surgery.findUnique({
      where: { slug: surgerySlug }
    })
    surgeryId = surgery?.id
  }

  // Get effective symptom data - try by ID first, then by slug
  let symptom = await getEffectiveSymptomById(id, surgeryId)
  
  if (!symptom) {
    // Try to find by slug if ID lookup failed
    symptom = await getEffectiveSymptomBySlug(id, surgeryId)
  }
  
  if (!symptom) {
    notFound()
  }

  // Get surgeries for header
  const surgeries = await prisma.surgery.findMany({
    orderBy: { name: 'asc' }
  })

  // Log engagement event
  if (surgeryId) {
    // Determine the base symptom ID for the engagement event
    let baseSymptomId: string | null = null
    
    if (symptom.source === 'base') {
      // It's already a base symptom
      baseSymptomId = symptom.id
    } else if (symptom.source === 'custom') {
      // Custom symptoms don't have a base symptom, skip logging
      baseSymptomId = null
    } else if (symptom.source === 'override') {
      // Override symptoms reference a base symptom
      baseSymptomId = symptom.baseSymptomId || symptom.id
    }
    
    if (baseSymptomId) {
      await prisma.engagementEvent.create({
        data: {
          surgeryId,
          baseId: baseSymptomId,
          event: 'view_symptom'
        }
      })
    }
  }

  return (
    <div className="min-h-screen bg-nhs-light-grey">
      <SimpleHeader surgeries={surgeries} currentSurgerySlug={surgerySlug} />
      
      <InstructionView 
        symptom={symptom} 
        surgeryId={surgeryId}
      />
    </div>
  )
}
