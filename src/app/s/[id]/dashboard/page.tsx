import { getSessionUser, requireSurgeryAccess } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import SurgeryDashboardClient from './SurgeryDashboardClient'

interface SurgeryDashboardPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function SurgeryDashboardPage({ params }: SurgeryDashboardPageProps) {
  const { id: surgeryId } = await params
  
  try {
    const user = await requireSurgeryAccess(surgeryId)
    
    // Get surgery details
    const surgery = await prisma.surgery.findUnique({
      where: { id: surgeryId },
      include: {
        _count: {
          select: {
            users: true
          }
        }
      }
    })

    if (!surgery) {
      redirect('/unauthorized')
    }

    return <SurgeryDashboardClient surgery={surgery} user={user} />
  } catch (error) {
    redirect('/unauthorized')
  }
}
