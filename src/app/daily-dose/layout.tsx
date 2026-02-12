import 'server-only'

import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import SimpleHeader from '@/components/SimpleHeader'

export const dynamic = 'force-dynamic'

export default async function DailyDoseLayout({ children }: { children: React.ReactNode }) {
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
      <SimpleHeader 
        surgeries={surgeries} 
        currentSurgeryId={currentSurgeryId ?? undefined}
        showDailyDoseNav={true}
      />
      <main className="mx-auto w-full max-w-6xl px-4 py-2 sm:px-6 lg:px-8">{children}</main>
    </div>
  )
}
