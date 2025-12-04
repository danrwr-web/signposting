import { getSessionUser, requireSurgeryAdmin } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import OnboardingWizardClient from './OnboardingWizardClient'

interface OnboardingPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function OnboardingPage({ params }: OnboardingPageProps) {
  const { id: surgeryId } = await params
  
  try {
    const user = await requireSurgeryAdmin(surgeryId)
    
    // Get surgery details
    const surgery = await prisma.surgery.findUnique({
      where: { id: surgeryId },
      select: {
        id: true,
        name: true,
      }
    })

    if (!surgery) {
      redirect('/unauthorized')
    }

    return <OnboardingWizardClient surgeryId={surgeryId} surgeryName={surgery.name} user={user} />
  } catch (error) {
    redirect('/unauthorized')
  }
}

