import { getSessionUser, requireSurgeryAdmin } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
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

    return <SurgeryUsersClient surgery={surgery} user={user} />
  } catch (error) {
    redirect('/unauthorized')
  }
}
