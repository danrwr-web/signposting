import { requireSurgeryAccess } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import SurgeryDashboardClient from './SurgeryDashboardClient'

interface SurgeryDashboardPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function SurgeryDashboardPage({ params }: SurgeryDashboardPageProps) {
  const { id: surgeryId } = await params

  try {
    const user = await requireSurgeryAccess(surgeryId)

    const [surgery, onboarding] = await Promise.all([
      prisma.surgery.findUnique({
        where: { id: surgeryId },
        select: {
          id: true,
          name: true,
          slug: true,
          createdAt: true,
          requiresClinicalReview: true,
          _count: { select: { users: true } },
        },
      }),
      prisma.surgeryOnboardingProfile.findUnique({
        where: { surgeryId },
        select: { completed: true },
      }),
    ])

    if (!surgery) {
      redirect('/unauthorized')
    }

    const setupComplete = onboarding?.completed ?? false

    return (
      <SurgeryDashboardClient
        surgery={surgery}
        user={user}
        setupComplete={setupComplete}
      />
    )
  } catch (error) {
    // Don't catch NEXT_REDIRECT errors - let them propagate
    if (
      error &&
      typeof error === 'object' &&
      'digest' in error &&
      typeof error.digest === 'string' &&
      error.digest.startsWith('NEXT_REDIRECT')
    ) {
      throw error
    }
    redirect('/unauthorized')
  }
}
