import 'server-only'

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'
import { DAILY_DOSE_LIBRARY_RESET_AT } from '@/lib/daily-dose/libraryReset'

export const dynamic = 'force-dynamic'

interface LegacyLibraryPageProps {
  searchParams: Promise<{ surgery?: string }>
}

export default async function LegacyLibraryPage({ searchParams }: LegacyLibraryPageProps) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const surgeryId = params.surgery ?? user.defaultSurgeryId ?? user.memberships[0]?.surgeryId
  if (!surgeryId) redirect('/editorial/library')

  const canAdmin =
    user.globalRole === 'SUPERUSER' ||
    user.memberships.some((membership) => membership.surgeryId === surgeryId && membership.role === 'ADMIN')
  if (!canAdmin) redirect('/unauthorized')

  const cards = await prisma.dailyDoseCard.findMany({
    where: {
      surgeryId,
      createdAt: { lt: DAILY_DOSE_LIBRARY_RESET_AT },
    },
    select: {
      id: true,
      batchId: true,
      title: true,
      targetRole: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Legacy / test card library</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-700">
              These cards were created before the Daily Dose library reset on 3 September 2026. They are retained for reference only and are excluded from the normal editorial library and learner sessions.
            </p>
          </div>
          <Link
            href={`/editorial/library?surgery=${encodeURIComponent(surgeryId)}`}
            className="rounded-md bg-nhs-blue px-4 py-2 text-sm font-semibold text-white hover:bg-nhs-dark-blue"
          >
            Back to fresh library
          </Link>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <p className="text-sm text-slate-600">
          {cards.length === 1 ? '1 legacy card retained' : `${cards.length} legacy cards retained`}
        </p>
        {cards.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No legacy cards found for this practice.</p>
        ) : (
          <div className="mt-4 divide-y divide-slate-200">
            {cards.map((card) => (
              <div key={card.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-slate-800">{card.title}</p>
                  <p className="text-xs text-slate-500">
                    {card.targetRole} · {card.status} · {card.createdAt.toLocaleDateString('en-GB')}
                  </p>
                </div>
                <Link
                  href={`/editorial/batches/${card.batchId}?surgery=${encodeURIComponent(surgeryId)}`}
                  className="text-sm font-semibold text-nhs-blue hover:underline"
                >
                  Review old card
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
