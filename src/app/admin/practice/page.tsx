export const dynamic = 'force-dynamic'
export const revalidate = 0

import { getSessionUser, can } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import PracticeSettingsClient from './PracticeSettingsClient'

export default async function PracticeSettingsPage() {
  const user = await getSessionUser()
  
  if (!user) {
    redirect('/login')
  }

  // Check if user has admin access (superuser or surgery admin)
  const isSuperuser = user.globalRole === 'SUPERUSER'
  const adminMemberships = user.memberships.filter(m => m.role === 'ADMIN')
  const isSurgeryAdmin = adminMemberships.length > 0
  
  if (!isSuperuser && !isSurgeryAdmin) {
    redirect('/unauthorized')
  }

  // Get the user's primary surgery ID
  const primarySurgeryId = isSuperuser 
    ? adminMemberships[0]?.surgeryId || null
    : adminMemberships[0]?.surgeryId || null

  // Get surgeries the user can manage
  let surgeries
  if (isSuperuser) {
    surgeries = await prisma.surgery.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        _count: {
          select: {
            users: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    })
  } else {
    const surgeryIds = adminMemberships.map(m => m.surgeryId)
    surgeries = await prisma.surgery.findMany({
      where: { id: { in: surgeryIds } },
      select: {
        id: true,
        name: true,
        slug: true,
        _count: {
          select: {
            users: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    })
  }

  // Get feature flags for the primary surgery
  let enabledFeatures: Record<string, boolean> = {}
  if (primarySurgeryId) {
    const features = await prisma.surgeryFeature.findMany({
      where: { surgeryId: primarySurgeryId },
      select: { key: true, enabled: true },
    })
    enabledFeatures = Object.fromEntries(features.map(f => [f.key, f.enabled]))
  }

  return (
    <PracticeSettingsClient 
      surgeries={surgeries}
      primarySurgeryId={primarySurgeryId}
      isSuperuser={isSuperuser}
      enabledFeatures={enabledFeatures}
    />
  )
}
