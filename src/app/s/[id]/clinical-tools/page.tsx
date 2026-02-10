import { requireSurgeryAccess } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import ClinicalToolsClient from '@/app/clinical-tools/ClinicalToolsClient'

// Disable caching for this page
export const dynamic = 'force-dynamic'
export const revalidate = 0

interface ClinicalToolsPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function ClinicalToolsPage({ params }: ClinicalToolsPageProps) {
  const { id: surgeryId } = await params
  
  try {
    await requireSurgeryAccess(surgeryId)
    
    return <ClinicalToolsClient surgeryId={surgeryId} />
  } catch (error) {
    redirect('/unauthorized')
  }
}
