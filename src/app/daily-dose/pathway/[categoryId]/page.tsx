import 'server-only'

import { getSessionUser } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import DailyDoseCategoryDetailClient from './DailyDoseCategoryDetailClient'

export const dynamic = 'force-dynamic'

interface CategoryDetailPageProps {
  params: Promise<{ categoryId: string }>
  searchParams: Promise<{ surgery?: string }>
}

export default async function DailyDoseCategoryDetailPage({
  params,
  searchParams,
}: CategoryDetailPageProps) {
  const user = await getSessionUser()
  if (!user) {
    redirect('/login')
  }

  const { categoryId } = await params
  const sp = await searchParams
  const surgeryId = sp.surgery ?? user.defaultSurgeryId ?? user.memberships[0]?.surgeryId

  if (!surgeryId) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-bold text-nhs-dark-blue">Learning Category</h1>
        <p className="mt-3 text-slate-600">
          Your account is not linked to a practice yet. Please contact your practice administrator.
        </p>
      </div>
    )
  }

  return <DailyDoseCategoryDetailClient surgeryId={surgeryId} categoryId={categoryId} />
}
