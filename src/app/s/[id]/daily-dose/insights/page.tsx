import 'server-only'

import { getSessionUser } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import DailyDoseInsightsClient from '@/app/daily-dose/insights/DailyDoseInsightsClient'

export const dynamic = 'force-dynamic'

interface DailyDoseInsightsPageProps {
  params: Promise<{ id: string }>
}

export default async function DailyDoseInsightsPage({ params }: DailyDoseInsightsPageProps) {
  const { id: surgeryId } = await params
  const user = await getSessionUser()
  
  if (!user) {
    redirect('/login')
  }

  // Verify user has access to this surgery
  const hasMembership = user.memberships.some(m => m.surgeryId === surgeryId)
  const isSuperuser = user.globalRole === 'SUPERUSER'
  
  if (!hasMembership && !isSuperuser) {
    redirect('/unauthorized')
  }

  // Check admin permissions
  const canAdmin =
    isSuperuser ||
    user.memberships.some((membership) => membership.surgeryId === surgeryId && membership.role === 'ADMIN')

  if (!canAdmin) {
    redirect('/unauthorized')
  }

  return <DailyDoseInsightsClient surgeryId={surgeryId} />
}
