import 'server-only'
import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getEffectiveSymptomById, getEffectiveSymptomBySlug } from '@/server/effectiveSymptoms'
import InstructionView from '@/components/InstructionView'
import SimpleHeader from '@/components/SimpleHeader'
import { getSessionUser } from '@/lib/rbac'

// Disable caching for this page to prevent stale data
export const dynamic = 'force-dynamic'
export const revalidate = 0

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
  const surgeryParam = resolvedSearchParams.surgery

  // Debug logging
  console.log('SymptomPage: id =', id, 'surgeryParam =', surgeryParam)

  // Get surgery ID from param (ID or slug for backward compatibility)
  let surgeryId: string | undefined
  if (surgeryParam) {
    // First try as ID
    const surgeryById = await prisma.surgery.findUnique({
      where: { id: surgeryParam },
      select: { id: true }
    })
    if (surgeryById) {
      surgeryId = surgeryById.id
      console.log('SymptomPage: Found surgery by ID:', surgeryId)
    } else {
      // Fallback to slug for backward compatibility
      const surgeryBySlug = await prisma.surgery.findUnique({
        where: { slug: surgeryParam },
        select: { id: true }
      })
      surgeryId = surgeryBySlug?.id
      console.log('SymptomPage: Found surgery by slug:', surgeryId)
    }
  } else {
    console.log('SymptomPage: No surgery parameter provided')
  }

  console.log('SymptomPage: Final surgeryId =', surgeryId)

  // Get effective symptom data - try by ID first, then by slug
  let symptom = await getEffectiveSymptomById(id, surgeryId)
  
  if (!symptom) {
    // Try to find by slug if ID lookup failed
    symptom = await getEffectiveSymptomBySlug(id, surgeryId)
  }
  
  console.log('SymptomPage: Found symptom:', symptom?.name, 'source:', symptom?.source)
  
  if (!symptom) {
    notFound()
  }

  // Get surgeries for header
  const surgeries = await prisma.surgery.findMany({
    orderBy: { name: 'asc' }
  })

  // Track usage for test users BEFORE displaying the symptom
  if (surgeryId) {
    const sessionUser = await getSessionUser()
    if (sessionUser?.email) {
      const user = await prisma.user.findUnique({
        where: { email: sessionUser.email },
        select: { 
          id: true, 
          isTestUser: true, 
          symptomsUsed: true, 
          symptomUsageLimit: true 
        }
      })

      if (user?.isTestUser && user.symptomUsageLimit) {
        // Check if user has reached their limit BEFORE showing content
        if (user.symptomsUsed >= user.symptomUsageLimit) {
          // Redirect to lockout page
          redirect('/test-user-lockout')
        }

        // Increment usage count BEFORE showing content
        await prisma.user.update({
          where: { id: user.id },
          data: { symptomsUsed: user.symptomsUsed + 1 }
        })
      }
    }

    // Log engagement event (after usage tracking)
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
      <SimpleHeader surgeries={surgeries} currentSurgeryId={surgeryId} />
      
      <InstructionView 
        symptom={symptom} 
        surgeryId={surgeryId}
      />
    </div>
  )
}
