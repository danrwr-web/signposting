/**
 * Super dashboard page
 * Server component for superuser management interface
 */

import 'server-only'
import { requireSuperuserAuth } from '@/server/auth'
import SuperDashboardClient from './SuperDashboardClient'
import { prisma } from '@/lib/prisma'

export default async function SuperDashboard() {
  await requireSuperuserAuth()

  // Get all surgeries for management
  const surgeries = await prisma.surgery.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      slug: true,
      adminEmail: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return <SuperDashboardClient surgeries={surgeries} />
}
