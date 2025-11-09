import { getSessionUser, requireSurgeryAccess } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import AppointmentsPageClient from './AppointmentsPageClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface AppointmentsPageProps {
  params: {
    id: string
  }
}

export default async function AppointmentsPage({ params }: AppointmentsPageProps) {
  const { id: surgeryId } = params
  
  try {
    // Get user with memberships
    const user = await getSessionUser()
    if (!user) {
      redirect('/unauthorized')
    }

    // Verify user has access to this surgery
    await requireSurgeryAccess(surgeryId)
    
    // Get surgery details
    const surgery = await prisma.surgery.findUnique({
      where: { id: surgeryId },
      select: {
        id: true,
        name: true,
      }
    })

    if (!surgery) {
      redirect('/unauthorized')
    }

    const surgeries = await prisma.surgery.findMany({
      orderBy: { name: 'asc' }
    })

    // Check if user is admin for this surgery
    const membership = user.memberships.find(m => m.surgeryId === surgeryId)
    const isAdmin = user.globalRole === 'SUPERUSER' || membership?.role === 'ADMIN'

    return (
      <AppointmentsPageClient 
        surgeryId={surgeryId}
        surgeryName={surgery.name}
        isAdmin={isAdmin}
        surgeries={surgeries}
      />
    )
  } catch (error) {
    redirect('/unauthorized')
  }
}

