import 'server-only'
import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getEffectiveSymptomById, getEffectiveSymptomBySlug } from '@/server/effectiveSymptoms'
import InstructionView from '@/components/InstructionView'
import SimpleHeader from '@/components/SimpleHeader'
import { getSessionUser } from '@/lib/rbac'
import ClinicalReviewActions from '@/components/ClinicalReviewActions'

// Disable caching for this page to prevent stale data
export const dynamic = 'force-dynamic'
export const revalidate = 0

interface SymptomPageProps {
  params: Promise<{
    id: string
  }>
  searchParams: Promise<{
    surgery?: string
    ref?: string
  }>
}

export default async function SymptomPage({ params, searchParams }: SymptomPageProps) {
  const resolvedParams = await params
  const { id } = resolvedParams
  const resolvedSearchParams = await searchParams
  const surgeryParam = resolvedSearchParams.surgery
  const refParam = resolvedSearchParams.ref

  // Get surgery ID from param (canonical id, with slug compatibility)
  let surgeryId: string | undefined
  if (surgeryParam) {
    // First try as canonical id (matches `/s/[id]` route segment)
    const surgeryById = await prisma.surgery.findUnique({
      where: { id: surgeryParam },
      select: { id: true }
    })
    if (surgeryById) {
      surgeryId = surgeryById.id
    } else {
      // Fallback to slug for backward compatibility
      const surgeryBySlug = await prisma.surgery.findUnique({
        where: { slug: surgeryParam },
        select: { id: true }
      })
      surgeryId = surgeryBySlug?.id

      // If we resolved via slug, redirect to the canonical `?surgery=<id>` URL
      // so navigation (e.g. logo link back to `/s/[id]`) stays consistent.
      if (surgeryId && surgeryParam !== surgeryId) {
        const next = new URLSearchParams()
        next.set('surgery', surgeryId)
        if (refParam) next.set('ref', refParam)
        redirect(`/symptom/${id}?${next.toString()}`)
      }
    }
  } else {
  }

  // Get effective symptom data - try by ID first, then by slug
  let symptom = await getEffectiveSymptomById(id, surgeryId)
  
  if (!symptom) {
    // Try to find by slug if ID lookup failed
    symptom = await getEffectiveSymptomBySlug(id, surgeryId)
  }
  
  if (!symptom) {
    notFound()
  }

  // Get surgeries for header
  const surgeries = await prisma.surgery.findMany({
    orderBy: { name: 'asc' }
  })

  // If coming from clinical review, compute previous/next for navigation
  let prevSymptomId: string | null = null
  let nextSymptomId: string | null = null
  if (refParam === 'clinical-review' && surgeryId) {
    // Load all effective symptoms for this surgery and sort by name
    const { getEffectiveSymptoms } = await import('@/server/effectiveSymptoms')
    const all = await getEffectiveSymptoms(surgeryId)
    const sorted = all.sort((a, b) => a.name.localeCompare(b.name))
    const index = sorted.findIndex(s => s.id === symptom.id)
    if (index !== -1) {
      prevSymptomId = index > 0 ? sorted[index - 1].id : null
      nextSymptomId = index < sorted.length - 1 ? sorted[index + 1].id : null
    }
  }

  // Track usage for test users BEFORE displaying the symptom
  if (surgeryId) {
    const sessionUser = await getSessionUser()
    if (sessionUser?.email) {
      const user = await prisma.user.findUnique({
        where: { email: sessionUser.email },
        select: { 
          id: true, 
          isTestUser: true, 
          symptomsUsed: true, 
          symptomUsageLimit: true 
        }
      })

      if (user?.isTestUser && user.symptomUsageLimit) {
        // Check if user has reached their limit BEFORE showing content
        if (user.symptomsUsed >= user.symptomUsageLimit) {
          // Redirect to lockout page
          redirect('/test-user-lockout')
        }

        // Increment usage count BEFORE showing content
        await prisma.user.update({
          where: { id: user.id },
          data: { symptomsUsed: user.symptomsUsed + 1 }
        })
      }
    }

    // Log engagement event (after usage tracking)
    let baseSymptomId: string | null = null
    
    if (symptom.source === 'base') {
      // It's already a base symptom
      baseSymptomId = symptom.id
    } else if (symptom.source === 'custom') {
      // Custom symptoms don't have a base symptom, skip logging
      baseSymptomId = null
    } else if (symptom.source === 'override') {
      // Override symptoms reference a base symptom
      baseSymptomId = symptom.baseSymptomId || symptom.id
    }
    
    if (baseSymptomId) {
      await prisma.engagementEvent.create({
        data: {
          surgeryId,
          baseId: baseSymptomId,
          event: 'view_symptom',
          userEmail: sessionUser?.email || null
        }
      })
    }
  }

  return (
    <div className="min-h-screen bg-nhs-light-grey">
      <SimpleHeader surgeries={surgeries} currentSurgeryId={surgeryId} />
      {/* Inline status badge and approver info */}
      {surgeryId && (
        await (async () => {
          const status = await prisma.symptomReviewStatus.findUnique({
            where: {
              surgeryId_symptomId_ageGroup: {
                surgeryId,
                symptomId: symptom.id,
                ageGroup: symptom.ageGroup || null
              }
            },
            include: {
              lastReviewedBy: {
                select: { name: true, email: true }
              }
            }
          })
          const approved = status?.status === 'APPROVED'
          const needsChange = status?.status === 'CHANGES_REQUIRED'
          const pending = !status || status.status === 'PENDING'
          return (
            <div className={needsChange ? 'bg-red-50 border-l-4 border-red-400' : pending ? 'bg-yellow-50 border-l-4 border-yellow-400' : 'bg-green-50 border-l-4 border-green-400'}>
              <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
                {approved && (
                  <p className="text-sm text-green-800">
                    Approved on {status?.lastReviewedAt ? new Date(status.lastReviewedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'} by {status?.lastReviewedBy?.name || status?.lastReviewedBy?.email || 'Unknown'}
                  </p>
                )}
                {(needsChange || pending) && (
                  <div>
                    <p className={`text-sm ${needsChange ? 'text-red-800' : 'text-yellow-800'}`}>
                      {needsChange ? 'Marked as Needs Change' : 'Pending clinical review'}{status?.lastReviewedAt ? ` (last updated ${new Date(status.lastReviewedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })})` : ''}
                    </p>
                    {needsChange && status?.reviewNote && (
                      <p className="text-sm text-red-800 mt-2 whitespace-pre-wrap break-words">
                        <span className="font-semibold">Reviewer note:</span> {status.reviewNote}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })()
      )}
      {refParam === 'clinical-review' && surgeryId && (
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
            <a href="/admin?tab=clinical-review" className="text-blue-600 hover:text-blue-700 text-sm">
              ← Back to Clinical Review
            </a>
            <div className="flex items-center gap-3">
              {prevSymptomId && (
                <a
                  href={`/symptom/${prevSymptomId}?surgery=${surgeryId}&ref=clinical-review`}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  ← Previous
                </a>
              )}
              {nextSymptomId && (
                <a
                  href={`/symptom/${nextSymptomId}?surgery=${surgeryId}&ref=clinical-review`}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Next →
                </a>
              )}
            </div>
          </div>
        </div>
      )}
      {refParam === 'clinical-review' && surgeryId && (
        <ClinicalReviewActions 
          surgeryId={surgeryId} 
          symptomId={symptom.id} 
          ageGroup={symptom.ageGroup}
          symptomSource={symptom.source}
          baseSymptomId={symptom.baseSymptomId || null}
        />
      )}
      
      <InstructionView 
        symptom={symptom} 
        surgeryId={surgeryId}
      />
    </div>
  )
}
