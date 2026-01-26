export const dynamic = 'force-dynamic'
export const revalidate = 0

import { getSessionUser } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getLastActiveForUsers } from '@/lib/lastActive'
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

  // Fetch last active data for all users
  const userIds = users.map(u => u.id)
  const lastActiveMap = await getLastActiveForUsers(userIds)
  
  // Convert Map to a plain object for serialisation to client
  const lastActiveData: Record<string, string | null> = {}
  for (const [userId, date] of lastActiveMap.entries()) {
    lastActiveData[userId] = date ? date.toISOString() : null
  }

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

  return <GlobalUsersClient users={users} surgeries={surgeries} lastActiveData={lastActiveData} />
}
