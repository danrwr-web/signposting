import 'server-only'

import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import SimpleHeader from '@/components/SimpleHeader'
import DailyDoseNav from '@/components/daily-dose/DailyDoseNav'

export const dynamic = 'force-dynamic'

export default async function EditorialLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser()
  if (!user) {
    redirect('/login')
  }

  const surgeries = await prisma.surgery.findMany({
    orderBy: { name: 'asc' },
  })

  const currentSurgeryId = user.defaultSurgeryId ?? user.memberships[0]?.surgeryId

  return (
    <div className="min-h-screen bg-nhs-light-grey">
      <SimpleHeader surgeries={surgeries} currentSurgeryId={currentSurgeryId ?? undefined} />
      <DailyDoseNav currentSurgeryId={currentSurgeryId ?? undefined} />
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  )
}
