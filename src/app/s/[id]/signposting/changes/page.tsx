import { requireSurgeryAccess } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getRecentlyChangedSymptoms, DEFAULT_CHANGE_WINDOW_DAYS } from '@/server/recentlyChangedSymptoms'
import WhatsChangedClient from './WhatsChangedClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface WhatsChangedPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function WhatsChangedPage({ params }: WhatsChangedPageProps) {
  const { id: surgeryId } = await params
  
  try {
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

    // Get recently changed symptoms
    const recentChanges = await getRecentlyChangedSymptoms(surgeryId, DEFAULT_CHANGE_WINDOW_DAYS)
    
    // Serialise dates for client
    const serialisedChanges = recentChanges.map(change => ({
      ...change,
      approvedAt: change.approvedAt.toISOString()
    }))

    return (
      <WhatsChangedClient
        surgery={surgery}
        changes={serialisedChanges}
        windowDays={DEFAULT_CHANGE_WINDOW_DAYS}
      />
    )
  } catch (error) {
    redirect('/unauthorized')
  }
}
