import 'server-only'

import { getSessionUser } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import DailyDoseHistoryClient from '@/app/daily-dose/history/DailyDoseHistoryClient'

export const dynamic = 'force-dynamic'

interface DailyDoseHistoryPageProps {
  params: Promise<{ id: string }>
}

export default async function DailyDoseHistoryPage({ params }: DailyDoseHistoryPageProps) {
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

  return <DailyDoseHistoryClient surgeryId={surgeryId} />
}
