import 'server-only'

import Link from 'next/link'
import { getSessionUser } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import EditorialLibraryClient from './EditorialLibraryClient'

export const dynamic = 'force-dynamic'

interface EditorialLibraryPageProps {
  searchParams: Promise<{ surgery?: string; jobId?: string; bulkRunId?: string }>
}

export default async function EditorialLibraryPage({ searchParams }: EditorialLibraryPageProps) {
  const user = await getSessionUser()
  if (!user) {
    redirect('/login')
  }

  const params = await searchParams
  const surgeryId = params.surgery ?? user.defaultSurgeryId ?? user.memberships[0]?.surgeryId
  const jobId = params.jobId ?? undefined
  const bulkRunId = params.bulkRunId ?? undefined
  const isSuperuser = user.globalRole === 'SUPERUSER'

  if (!surgeryId) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-bold text-nhs-dark-blue">Card Library</h1>
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

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Link
          href={`/editorial/library/legacy?surgery=${encodeURIComponent(surgeryId)}`}
          className="text-sm font-semibold text-slate-600 hover:text-nhs-blue hover:underline"
        >
          View legacy / test cards
        </Link>
      </div>
      <EditorialLibraryClient
        surgeryId={surgeryId}
        userName={user.name ?? user.email}
        canAdmin={canAdmin}
        isSuperuser={isSuperuser}
        initialJobId={jobId}
        initialBulkRunId={bulkRunId}
      />
    </div>
  )
}
