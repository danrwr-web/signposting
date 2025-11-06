import { getSessionUser, requireSurgeryAccess } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import AppointmentsPageClient from './AppointmentsPageClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface AppointmentsPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function AppointmentsPage({ params }: AppointmentsPageProps) {
  const { id: surgeryId } = await params
  
  try {
    const user = await requireSurgeryAccess(surgeryId)
    
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

    // Check if user is admin
    const isAdmin = user.globalRole === 'SUPERUSER' || 
      user.memberships.some(m => m.surgeryId === surgeryId && m.role === 'ADMIN')

    return (
      <AppointmentsPageClient 
        surgeryId={surgeryId}
        surgeryName={surgery.name}
        isAdmin={isAdmin}
      />
    )
  } catch (error) {
    redirect('/unauthorized')
  }
}

