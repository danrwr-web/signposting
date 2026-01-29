export const dynamic = 'force-dynamic'
export const revalidate = 0

import { getSessionUser } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import SystemManagementClient from './SystemManagementClient'

export default async function SystemManagementPage() {
  const user = await getSessionUser()
  
  if (!user) {
    redirect('/login')
  }

  // Only superusers can access System Management
  if (user.globalRole !== 'SUPERUSER') {
    redirect('/unauthorized')
  }

  // Get surgery count for display
  const surgeryCount = await prisma.surgery.count()

  // Get user count for display
  const userCount = await prisma.user.count()

  // Get global defaults (if any exist)
  // For now, we'll use the hardcoded default from recentlyChangedSymptoms.ts
  // In future, this could be stored in a SystemConfig table
  const globalDefaults = {
    recentChangesWindowDays: 14, // DEFAULT_CHANGE_WINDOW_DAYS
  }

  return (
    <SystemManagementClient 
      surgeryCount={surgeryCount}
      userCount={userCount}
      globalDefaults={globalDefaults}
    />
  )
}
