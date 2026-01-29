export const dynamic = 'force-dynamic'
export const revalidate = 0

import { getSessionUser } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import FeatureRolloutsClient from './FeatureRolloutsClient'

export default async function FeatureRolloutsPage() {
  const user = await getSessionUser()
  
  if (!user) {
    redirect('/login')
  }

  if (user.globalRole !== 'SUPERUSER') {
    redirect('/unauthorized')
  }

  // Get all surgeries with their feature flags
  const surgeries = await prisma.surgery.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
    },
    orderBy: { name: 'asc' },
  })

  // Get all features
  const features = await prisma.feature.findMany({
    select: {
      id: true,
      key: true,
      name: true,
      description: true,
    },
    orderBy: { name: 'asc' },
  })

  // Get all surgery feature flags
  const surgeryFlags = await prisma.surgeryFeatureFlag.findMany({
    select: {
      surgeryId: true,
      featureId: true,
      enabled: true,
    },
  })

  // Build a map of surgeryId -> featureId -> enabled
  const flagsMap: Record<string, Record<string, boolean>> = {}
  for (const flag of surgeryFlags) {
    if (!flagsMap[flag.surgeryId]) {
      flagsMap[flag.surgeryId] = {}
    }
    flagsMap[flag.surgeryId][flag.featureId] = flag.enabled
  }

  return (
    <FeatureRolloutsClient 
      surgeries={surgeries}
      features={features}
      flagsMap={flagsMap}
    />
  )
}
