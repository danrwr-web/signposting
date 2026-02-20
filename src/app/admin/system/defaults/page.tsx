export const dynamic = 'force-dynamic'
export const revalidate = 0

import { getSessionUser } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import GlobalDefaultsClient from './GlobalDefaultsClient'

export default async function GlobalDefaultsPage() {
  const user = await getSessionUser()
  
  if (!user) {
    redirect('/login')
  }

  // Only superusers can access System Management
  if (user.globalRole !== 'SUPERUSER') {
    redirect('/unauthorized')
  }

  // Get global defaults
  // In a future version, these could be stored in a SystemConfig table
  // For now, we display the hardcoded defaults
  const globalDefaults = {
    recentChangesWindowDays: 14, // DEFAULT_CHANGE_WINDOW_DAYS from recentlyChangedSymptoms.ts
  }

  return <GlobalDefaultsClient globalDefaults={globalDefaults} />
}
