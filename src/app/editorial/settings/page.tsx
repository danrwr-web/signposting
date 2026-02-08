import 'server-only'

import { getSessionUser } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import EditorialSettingsClient from './EditorialSettingsClient'

export const dynamic = 'force-dynamic'

export default async function EditorialSettingsPage() {
  const user = await getSessionUser()
  if (!user) {
    redirect('/login')
  }

  if (user.globalRole !== 'SUPERUSER') {
    redirect('/unauthorized')
  }

  return <EditorialSettingsClient />
}
