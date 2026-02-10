import { requireSurgeryAccess } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import DiabeticTitrationClient from '@/app/clinical-tools/diabetic-titration/DiabeticTitrationClient'

// Disable caching for this page
export const dynamic = 'force-dynamic'
export const revalidate = 0

interface DiabeticTitrationPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function DiabeticTitrationPage({ params }: DiabeticTitrationPageProps) {
  const { id: surgeryId } = await params
  
  try {
    await requireSurgeryAccess(surgeryId)
    
    return <DiabeticTitrationClient surgeryId={surgeryId} />
  } catch (error) {
    redirect('/unauthorized')
  }
}
