import { getSessionUser } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import AdminDashboardClient from './AdminDashboardClient'
import AdminPageClient from './AdminPageClient'

export default async function AdminPage() {
  const user = await getSessionUser()
  
  if (!user) {
    redirect('/login')
  }

  // Check if user has admin access (superuser or surgery admin)
  const isSuperuser = user.globalRole === 'SUPERUSER'
  const isSurgeryAdmin = user.memberships.some(m => m.role === 'ADMIN')
  
  if (!isSuperuser && !isSurgeryAdmin) {
    redirect('/unauthorized')
  }

  // For superusers and surgery admins, use the original AdminPageClient with full functionality
  if (isSuperuser || isSurgeryAdmin) {
    // Get surgeries for superuser or user's surgeries for surgery admin
    let surgeries
    if (isSuperuser) {
      surgeries = await prisma.surgery.findMany({
        orderBy: { name: 'asc' }
      })
    } else {
      const surgeryIds = user.memberships
        .filter(m => m.role === 'ADMIN')
        .map(m => m.surgeryId)
      
      surgeries = await prisma.surgery.findMany({
        where: { id: { in: surgeryIds } },
        orderBy: { name: 'asc' }
      })
    }

    // Get all base symptoms and convert to EffectiveSymptom format
    const baseSymptoms = await prisma.baseSymptom.findMany({
      orderBy: { name: 'asc' }
    })

    // Convert to EffectiveSymptom format
    const symptoms = baseSymptoms.map(symptom => ({
      ...symptom,
      source: 'base' as const
    }))

    // Create a mock session object for compatibility with AdminPageClient
    const session = {
      type: isSuperuser ? 'superuser' as const : 'surgery' as const,
      id: user.id,
      email: user.email,
      surgeryId: isSuperuser ? undefined : user.defaultSurgeryId,
      surgerySlug: undefined
    }

    return (
      <AdminPageClient 
        surgeries={surgeries} 
        symptoms={symptoms} 
        session={session}
        currentSurgerySlug={undefined}
      />
    )
  }
}