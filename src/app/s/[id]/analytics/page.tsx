import { requireSurgeryAdmin } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import AnalyticsClient from './AnalyticsClient'

interface AnalyticsPageProps {
  params: Promise<{
    id: string
  }>
}

/**
 * Analytics landing page - /s/[id]/analytics
 * 
 * Provides a calm, high-level overview of system usage across modules.
 * Visible to surgery admins and superusers only.
 * 
 * Design principle: Visibility over surveillance.
 */
export default async function AnalyticsPage({ params }: AnalyticsPageProps) {
  const { id: surgeryId } = await params

  try {
    await requireSurgeryAdmin(surgeryId)
    return <AnalyticsClient surgeryId={surgeryId} />
  } catch {
    redirect('/unauthorized')
  }
}
