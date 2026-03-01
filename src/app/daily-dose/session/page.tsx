import 'server-only'

import { getSessionUser } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import DailyDoseSessionClient from './DailyDoseSessionClient'

export const dynamic = 'force-dynamic'

interface SessionPageProps {
  searchParams: Promise<{ surgery?: string; category?: string }>
}

export default async function DailyDoseSessionPage({ searchParams }: SessionPageProps) {
  const user = await getSessionUser()
  if (!user) {
    redirect('/login')
  }

  const params = await searchParams
  const surgeryId = params.surgery ?? user.defaultSurgeryId ?? user.memberships[0]?.surgeryId
  const categoryId = params.category

  if (!surgeryId) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-bold text-nhs-dark-blue">Daily Dose session</h1>
        <p className="mt-3 text-slate-600">
          Your account is not linked to a practice yet. Please contact your practice administrator.
        </p>
      </div>
    )
  }

  return <DailyDoseSessionClient surgeryId={surgeryId} categoryId={categoryId} />
}
