export const dynamic = 'force-dynamic'
export const revalidate = 0

import { getSessionUser } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import ModuleAccessClient from './ModuleAccessClient'

export default async function ModuleAccessPage() {
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
  const primarySurgeryId = adminMemberships[0]?.surgeryId || null

  // Get surgeries the user can manage
  let surgeries
  if (isSuperuser) {
    surgeries = await prisma.surgery.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
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
      },
      orderBy: { name: 'asc' },
    })
  }

  return (
    <ModuleAccessClient 
      surgeries={surgeries}
      primarySurgeryId={primarySurgeryId}
      isSuperuser={isSuperuser}
      currentUserId={user.id}
      currentUserEmail={user.email}
    />
  )
}
