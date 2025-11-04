import { requireSurgeryAdmin } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import ClinicalReviewPanel from '@/components/ClinicalReviewPanel'

interface ClinicalReviewPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function ClinicalReviewPage({ params }: ClinicalReviewPageProps) {
  const { id: surgeryId } = await params
  
  try {
    const user = await requireSurgeryAdmin(surgeryId)
    
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

    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            Clinical Review - {surgery.name}
          </h1>
          <ClinicalReviewPanel 
            selectedSurgery={surgeryId}
            isSuperuser={user.globalRole === 'SUPERUSER'}
          />
        </div>
      </div>
    )
  } catch (error) {
    redirect('/unauthorized')
  }
}

