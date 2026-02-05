import 'server-only'

import { getSessionUser } from '@/lib/rbac'
import { isDailyDoseAdmin } from '@/lib/daily-dose/access'
import { redirect } from 'next/navigation'
import DailyDoseHomeClient from './DailyDoseHomeClient'

export const dynamic = 'force-dynamic'

export default async function DailyDoseHomePage() {
  const user = await getSessionUser()
  if (!user) {
    redirect('/login')
  }

  const surgeryId = user.defaultSurgeryId ?? user.memberships[0]?.surgeryId

  if (!surgeryId) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-bold text-nhs-dark-blue">Daily Dose</h1>
        <p className="mt-3 text-slate-600">
          Your account is not linked to a practice yet. Please contact your practice administrator.
        </p>
      </div>
    )
  }

  const canAdmin = isDailyDoseAdmin(user, surgeryId)

  return <DailyDoseHomeClient surgeryId={surgeryId} userName={user.name ?? undefined} canAdmin={canAdmin} />
}
