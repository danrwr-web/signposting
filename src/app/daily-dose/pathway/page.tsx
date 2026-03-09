import 'server-only'

import { getSessionUser } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import DailyDosePathwayClient from './DailyDosePathwayClient'

export const dynamic = 'force-dynamic'

interface PathwayPageProps {
  searchParams: Promise<{ surgery?: string; mode?: string }>
}

export default async function DailyDosePathwayPage({ searchParams }: PathwayPageProps) {
  const user = await getSessionUser()
  if (!user) {
    redirect('/login')
  }

  const params = await searchParams
  const surgeryId = params.surgery ?? user.defaultSurgeryId ?? user.memberships[0]?.surgeryId
  const focusMode = params.mode === 'focus'

  if (!surgeryId) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-bold text-nhs-dark-blue">Learning Pathway</h1>
        <p className="mt-3 text-slate-600">
          Your account is not linked to a practice yet. Please contact your practice administrator.
        </p>
      </div>
    )
  }

  const isSuperuser = user.globalRole === 'SUPERUSER'
  return (
    <DailyDosePathwayClient
      surgeryId={surgeryId}
      focusMode={focusMode}
      isSuperuser={isSuperuser}
    />
  )
}
