import { requireSurgeryAccess } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import LUTSClient from '@/app/clinical-tools/luts/LUTSClient'

// Disable caching for this page
export const dynamic = 'force-dynamic'
export const revalidate = 0

interface LUTSPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function LUTSPage({ params }: LUTSPageProps) {
  const { id: surgeryId } = await params
  
  try {
    await requireSurgeryAccess(surgeryId)
    
    return <LUTSClient surgeryId={surgeryId} />
  } catch (error) {
    redirect('/unauthorized')
  }
}
