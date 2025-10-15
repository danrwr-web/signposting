import 'server-only'
import { Suspense } from 'react'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { getEffectiveSymptoms, EffectiveSymptom } from '@/server/effectiveSymptoms'
import HomePageClient from './HomePageClient'

// Helper function to get base symptoms
async function getBaseSymptoms(): Promise<EffectiveSymptom[]> {
  const baseSymptoms = await prisma.baseSymptom.findMany({
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
  
  return baseSymptoms.map(symptom => ({
    ...symptom,
    source: 'base' as const
  }))
}

interface HomePageProps {
  searchParams: Promise<{
    surgery?: string
  }>
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const resolvedSearchParams = await searchParams
  const cookieStore = await cookies()
  
  // Get surgery slug from URL params first, then fallback to cookie
  const surgerySlug = resolvedSearchParams.surgery || cookieStore.get('surgerySlug')?.value

  // Get surgeries for header
  const surgeries = await prisma.surgery.findMany({
    orderBy: { name: 'asc' }
  })

  // Get surgery ID from slug
  let surgeryId: string | undefined
  if (surgerySlug) {
    const surgery = await prisma.surgery.findUnique({
      where: { slug: surgerySlug }
    })
    surgeryId = surgery?.id
  }

  // Get symptoms - base symptoms if no surgery selected, effective symptoms if surgery selected
  const symptoms = surgeryId ? await getEffectiveSymptoms(surgeryId) : await getBaseSymptoms()

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HomePageClient surgeries={surgeries} symptoms={symptoms} />
    </Suspense>
  )
}
