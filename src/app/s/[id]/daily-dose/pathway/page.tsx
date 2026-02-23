import 'server-only'

import { getSessionUser } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import PathwayThemeMapClient from '@/app/daily-dose/pathway/PathwayThemeMapClient'

export const dynamic = 'force-dynamic'

interface PathwayPageProps {
  params: Promise<{ id: string }>
}

export default async function PathwayPage({ params }: PathwayPageProps) {
  const { id: surgeryId } = await params
  const user = await getSessionUser()

  if (!user) {
    redirect('/login')
  }

  const hasMembership = user.memberships.some(m => m.surgeryId === surgeryId)
  const isSuperuser = user.globalRole === 'SUPERUSER'

  if (!hasMembership && !isSuperuser) {
    redirect('/unauthorized')
  }

  return <PathwayThemeMapClient surgeryId={surgeryId} />
}
