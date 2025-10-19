import { getSessionUser } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import GlobalUsersClient from './GlobalUsersClient'

export default async function GlobalUsersPage() {
  const user = await getSessionUser()
  
  if (!user) {
    redirect('/login')
  }

  if (user.globalRole !== 'SUPERUSER') {
    redirect('/unauthorized')
  }

  // Get all users with their memberships and default surgery
  const users = await prisma.user.findMany({
    include: {
      memberships: {
        include: {
          surgery: true
        }
      },
      defaultSurgery: true
    },
    orderBy: {
      createdAt: 'desc'
    }
  })

  // Get all surgeries for default surgery selection
  const surgeries = await prisma.surgery.findMany({
    select: {
      id: true,
      name: true
    },
    orderBy: {
      name: 'asc'
    }
  })

  return <GlobalUsersClient users={users} surgeries={surgeries} />
}
