export const dynamic = 'force-dynamic'
export const revalidate = 0

import { getSessionUser } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import AdminDashboardClient from './AdminDashboardClient'
import AdminPageWrapper from './AdminPageWrapper'

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
        orderBy: { name: 'asc' },
        include: {
          symptomReviews: {
            where: {
              status: 'PENDING'
            }
          }
        }
      })
    } else {
      const surgeryIds = user.memberships
        .filter(m => m.role === 'ADMIN')
        .map(m => m.surgeryId)
      
      surgeries = await prisma.surgery.findMany({
        where: { id: { in: surgeryIds } },
        orderBy: { name: 'asc' },
        include: {
          symptomReviews: {
            where: {
              status: 'PENDING'
            }
          }
        }
      })
    }

    // For each surgery, get the total symptom count and calculate pending
    for (const surgery of surgeries) {
      const symptoms = await getEffectiveSymptoms(surgery.id)
      const reviewedSymptomIds = new Set(
        surgery.symptomReviews.map(r => `${r.symptomId}-${r.ageGroup || ''}`)
      )
      const pendingCount = symptoms.filter(s => {
        const key = `${s.id}-${s.ageGroup || ''}`
        return !reviewedSymptomIds.has(key)
      }).length
      
      // Add pendingCount to surgery object (TypeScript will accept this as any)
      ;(surgery as any).pendingReviewCount = pendingCount + surgery.symptomReviews.length
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
    const adminMemberships = user.memberships.filter(m => m.role === 'ADMIN')
    const primarySurgeryId = adminMemberships.length > 0 ? adminMemberships[0].surgeryId : undefined
    
    const session = {
      type: isSuperuser ? 'superuser' as const : 'surgery' as const,
      id: user.id,
      email: user.email,
      surgeryId: isSuperuser ? undefined : primarySurgeryId,
      surgerySlug: undefined
    }
    

    return (
      <AdminPageWrapper 
        surgeries={surgeries} 
        symptoms={symptoms} 
        session={session}
        currentSurgerySlug={undefined}
      />
    )
  }
}