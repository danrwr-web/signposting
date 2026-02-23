import 'server-only'

import { getSessionUser } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import PathwayThemeDetailClient from '@/app/daily-dose/pathway/PathwayThemeDetailClient'

export const dynamic = 'force-dynamic'

interface ThemeDetailPageProps {
  params: Promise<{ id: string; themeId: string }>
}

export default async function ThemeDetailPage({ params }: ThemeDetailPageProps) {
  const { id: surgeryId, themeId } = await params
  const user = await getSessionUser()

  if (!user) {
    redirect('/login')
  }

  const hasMembership = user.memberships.some(m => m.surgeryId === surgeryId)
  const isSuperuser = user.globalRole === 'SUPERUSER'

  if (!hasMembership && !isSuperuser) {
    redirect('/unauthorized')
  }

  return <PathwayThemeDetailClient surgeryId={surgeryId} themeId={themeId} />
}
