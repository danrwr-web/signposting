import { getSessionUser, requireSurgeryAccess } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getEffectiveSymptoms } from '@/server/effectiveSymptoms'
import HomePageClient from '@/app/HomePageClient'

interface SignpostingToolPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function SignpostingToolPage({ params }: SignpostingToolPageProps) {
  const { id: surgeryId } = await params
  
  try {
    const user = await requireSurgeryAccess(surgeryId)
    
    // Get surgery details
    const surgery = await prisma.surgery.findUnique({
      where: { id: surgeryId }
    })

    if (!surgery) {
      redirect('/unauthorized')
    }

    // Get all surgeries for the surgery selector
    const surgeries = await prisma.surgery.findMany({
      orderBy: { name: 'asc' }
    })

    // Get effective symptoms for this surgery (with overrides applied)
    const symptoms = await getEffectiveSymptoms(surgeryId)

    return <HomePageClient surgeries={surgeries} symptoms={symptoms} />
  } catch (error) {
    redirect('/unauthorized')
  }
}
