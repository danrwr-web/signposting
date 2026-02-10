import 'server-only'

import { getSessionUser } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import DailyDoseInsightsClient from './DailyDoseInsightsClient'

export const dynamic = 'force-dynamic'

interface InsightsPageProps {
  searchParams: Promise<{ surgery?: string }>
}

export default async function DailyDoseInsightsPage({ searchParams }: InsightsPageProps) {
  const user = await getSessionUser()
  if (!user) {
    redirect('/login')
  }

  const params = await searchParams
  const surgeryId = params.surgery ?? user.defaultSurgeryId ?? user.memberships[0]?.surgeryId

  if (!surgeryId) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-bold text-nhs-dark-blue">Daily Dose insights</h1>
        <p className="mt-3 text-slate-600">
          Your account is not linked to a practice yet. Please contact your practice administrator.
        </p>
      </div>
    )
  }

  const canAdmin =
    user.globalRole === 'SUPERUSER' ||
    user.memberships.some((membership) => membership.surgeryId === surgeryId && membership.role === 'ADMIN')

  if (!canAdmin) {
    redirect('/unauthorized')
  }

  const isSuperuser = user.globalRole === 'SUPERUSER'

  return <DailyDoseInsightsClient surgeryId={surgeryId} isSuperuser={isSuperuser} />
}
