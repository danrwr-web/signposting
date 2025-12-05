import { getSessionUser, requireSurgeryAdmin } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import OnboardingWizardClient from './OnboardingWizardClient'

interface OnboardingPageProps {
  params: Promise<{
    id: string
  }>
  searchParams: Promise<{
    step?: string
  }>
}

export default async function OnboardingPage({ params, searchParams }: OnboardingPageProps) {
  const { id: surgeryId } = await params
  const { step } = await searchParams
  
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

    // Parse initial step from query param
    // Support both "2.5" and "appointment-model" for the appointment model step
    let initialStep: number | undefined
    if (step) {
      if (step === 'appointment-model' || step === '2.5') {
        initialStep = 2.5
      } else {
        const parsed = parseFloat(step)
        if (!isNaN(parsed)) {
          initialStep = parsed
        }
      }
    }

    return <OnboardingWizardClient surgeryId={surgeryId} surgeryName={surgery.name} user={user} initialStep={initialStep} />
  } catch (error) {
    redirect('/unauthorized')
  }
}

