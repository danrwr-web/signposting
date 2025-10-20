export const dynamic = 'force-dynamic'
export const revalidate = 0
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

  // Filter out surgeries without slugs and transform to match api-contracts type
  const validSurgeries = surgeries
    .filter(surgery => surgery.slug !== null)
    .map(surgery => ({
      id: surgery.id,
      name: surgery.name,
      slug: surgery.slug!,
      adminEmail: surgery.adminEmail,
      createdAt: surgery.createdAt,
      updatedAt: surgery.updatedAt,
    }))

  return <SuperDashboardClient surgeries={validSurgeries} />
}
