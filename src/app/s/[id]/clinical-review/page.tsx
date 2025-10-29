import { requireSurgeryAdmin } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getEffectiveSymptoms } from '@/server/effectiveSymptoms'
import ClinicalReviewClient from './ClinicalReviewClient'

interface ClinicalReviewPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function ClinicalReviewPage({ params }: ClinicalReviewPageProps) {
  const { id: surgeryId } = await params
  
  try {
    const user = await requireSurgeryAdmin(surgeryId)
    
    // Get surgery details with review information
    const surgery = await prisma.surgery.findUnique({
      where: { id: surgeryId },
      include: {
        lastClinicalReviewer: {
          select: {
            id: true,
            email: true,
            name: true,
          }
        },
        symptomReviews: {
          include: {
            lastReviewedBy: {
              select: {
                id: true,
                email: true,
                name: true,
              }
            }
          }
        }
      }
    })

    if (!surgery) {
      redirect('/unauthorized')
    }

    // Get all effective symptoms for this surgery
    const symptoms = await getEffectiveSymptoms(surgeryId)

    return <ClinicalReviewClient 
      surgery={surgery} 
      symptoms={symptoms} 
      reviewStatuses={surgery.symptomReviews}
      user={user}
    />
  } catch (error) {
    redirect('/unauthorized')
  }
}

