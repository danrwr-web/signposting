export const dynamic = 'force-dynamic'
export const revalidate = 0

import { getSessionUser } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import SurgeriesClient from './SurgeriesClient'

export default async function SurgeriesPage() {
  const user = await getSessionUser()
  
  if (!user) {
    redirect('/login')
  }

  if (user.globalRole !== 'SUPERUSER') {
    redirect('/unauthorized')
  }

  // Get all surgeries with their user counts
  const surgeries = await prisma.surgery.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      adminEmail: true,
      createdAt: true,
      users: {
        include: {
          user: true
        }
      },
      _count: {
        select: {
          users: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  })

  return <SurgeriesClient surgeries={surgeries} />
}
