export const dynamic = 'force-dynamic'
export const revalidate = 0

import { getSessionUser } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import AIUsageClient from './AIUsageClient'

export default async function AIUsagePage() {
  const user = await getSessionUser()
  
  if (!user) {
    redirect('/login')
  }

  // Only superusers can access System Management
  if (user.globalRole !== 'SUPERUSER') {
    redirect('/unauthorized')
  }

  return <AIUsageClient />
}
