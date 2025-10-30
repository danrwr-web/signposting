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
    // Consolidate to Admin Dashboard
    redirect('/admin')
  } catch (error) {
    redirect('/unauthorized')
  }
}
