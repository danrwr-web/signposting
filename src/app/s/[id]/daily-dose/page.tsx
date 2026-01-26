import 'server-only'

import { getSessionUser } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import DailyDoseHomeClient from '@/app/daily-dose/DailyDoseHomeClient'

export const dynamic = 'force-dynamic'

interface DailyDosePageProps {
  params: Promise<{ id: string }>
}

export default async function DailyDosePage({ params }: DailyDosePageProps) {
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

  return <DailyDoseHomeClient surgeryId={surgeryId} userName={user.name ?? undefined} />
}
