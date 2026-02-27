import 'server-only'

import { getSessionUser } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { isDailyDoseAdmin } from '@/lib/daily-dose/access'
import LearningPathwayClient from './LearningPathwayClient'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ surgery?: string }>
}

export default async function LearningPathwayPage({ searchParams }: PageProps) {
  const user = await getSessionUser()
  if (!user) {
    redirect('/login')
  }

  const params = await searchParams
  const surgeryId = params.surgery ?? user.defaultSurgeryId ?? user.memberships[0]?.surgeryId

  if (!surgeryId || !isDailyDoseAdmin(user, surgeryId)) {
    redirect('/unauthorized')
  }

  return <LearningPathwayClient surgeryId={surgeryId} />
}
