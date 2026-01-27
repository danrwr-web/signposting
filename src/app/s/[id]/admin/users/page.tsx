import { getSessionUser, requireSurgeryAdmin } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getLastActiveForSurgeryUsers } from '@/lib/lastActive'
import SurgeryUsersClient from './SurgeryUsersClient'

interface SurgeryUsersPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function SurgeryUsersPage({ params }: SurgeryUsersPageProps) {
  const { id: surgeryId } = await params
  
  try {
    const user = await requireSurgeryAdmin(surgeryId)
    
    // Get surgery details and its users
    const surgery = await prisma.surgery.findUnique({
      where: { id: surgeryId },
      include: {
        users: {
          include: {
            user: true
          }
        }
      }
    })

    if (!surgery) {
      redirect('/unauthorized')
    }

    // Fetch last active data for surgery users
    const userIds = surgery.users.map(u => u.user.id)
    const lastActiveMap = await getLastActiveForSurgeryUsers(surgeryId, userIds)
    
    // Convert Map to a plain object for serialisation to client
    const lastActiveData: Record<string, string | null> = {}
    for (const [userId, date] of lastActiveMap.entries()) {
      lastActiveData[userId] = date ? date.toISOString() : null
    }

    return <SurgeryUsersClient surgery={surgery} user={user} lastActiveData={lastActiveData} />
  } catch (error) {
    redirect('/unauthorized')
  }
}
