import 'server-only'
import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getEffectiveSymptomById, getEffectiveSymptomBySlug } from '@/server/effectiveSymptoms'
import InstructionView from '@/components/InstructionView'
import SimpleHeader from '@/components/SimpleHeader'
import { getSessionUser } from '@/lib/rbac'
import ClinicalReviewActions from '@/components/ClinicalReviewActions'
import { isFeatureEnabledForSurgery } from '@/lib/features'
import { FEATURE_HIDE_AGE_BANDS, FEATURE_AI_SYMPTOM_VISUALS } from '@/lib/featureKeys'
import { can } from '@/lib/rbac'
import { getSymptomSmartVisuals, visibleSymptomSmartVisuals } from '@/server/symptomSmartVisual'
import { symptomKeyIdFor } from '@/server/symptomSmartVisualGates'
import type { SymptomSmartVisualProps } from '@/components/symptom-smart-visual/SymptomSmartVisualToggle'
import { surgeriesForViewer } from '@/server/viewerSurgeries'
import { firstParam, isInternalEngagementRef } from '@/lib/engagementRefs'

// Disable caching for this page to prevent stale data
export const dynamic = 'force-dynamic'
export const revalidate = 0

interface SymptomPageProps {
  params: Promise<{
    id: string
  }>
  searchParams: Promise<{
    surgery?: string
    ref?: string | string[]
    from?: string | string[]
  }>
}

export default async function SymptomPage({ params, searchParams }: SymptomPageProps) {
  const resolvedParams = await params
  const { id } = resolvedParams
  const resolvedSearchParams = await searchParams
  const surgeryParam = resolvedSearchParams.surgery
  const refParam = firstParam(resolvedSearchParams.ref)
  // `from` marks internal review traffic too, and InstructionView reads it for
  // the back-link, so it has to survive the canonical redirect below.
  const fromParam = firstParam(resolvedSearchParams.from)

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
        if (fromParam) next.set('from', fromParam)
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
  // Reachable without a session, and this list is handed to a client component,
  // so it lands in the page source for whoever is looking. Scoped to the viewer:
  // a signed-out visitor gets nothing rather than the whole practice list.
  const surgeries = await surgeriesForViewer(await getSessionUser())

  // Per-surgery display option: hide age band badges and treat the symptom as all-ages
  const hideAgeBands = surgeryId
    ? await isFeatureEnabledForSurgery(surgeryId, FEATURE_HIDE_AGE_BANDS)
    : false

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
    
    if (baseSymptomId && !isInternalEngagementRef(refParam, fromParam)) {
      await prisma.engagementEvent.create({
        data: {
          surgeryId,
          baseId: baseSymptomId,
          event: 'view_symptom',
          userEmail: sessionUser?.email || null,
          ref: refParam ?? null
        }
      })
    }
  }

  // Clinical review status for this surgery, used both for the status banner
  // and to decide whether a saved smart visual may be shown to staff.
  const reviewStatus = surgeryId
    ? await prisma.symptomReviewStatus.findUnique({
        where: {
          surgeryId_symptomId_ageGroup: {
            surgeryId,
            symptomId: symptom.id,
            ageGroup: symptom.ageGroup || null,
          },
        },
        include: {
          lastReviewedBy: { select: { name: true, email: true } },
        },
      })
    : null

  // AI smart visuals. Unlike the Practice Handbook, a saved visual is only
  // released to staff once the symptom has passed clinical review — generating
  // is gated by the flag, viewing is gated by approval.
  let smartVisual: SymptomSmartVisualProps | undefined
  if (surgeryId) {
    const sessionUser = await getSessionUser()
    const canGenerate = !!sessionUser && can(sessionUser).manageSurgery(surgeryId)
    const isSuperuser = !!sessionUser && can(sessionUser).isSuperuser()
    const symptomKeyId = symptomKeyIdFor(symptom)
    // hideAgeBands changes what the AI was shown, so staleness must be judged
    // with the same option the visual was generated under.
    const visuals = await getSymptomSmartVisuals(surgeryId, symptomKeyId, symptom, { hideAgeBands })

    const approved = reviewStatus?.status === 'APPROVED'
    // Drop layouts this viewer may not see before they reach the RSC payload.
    const visibleVisuals = visibleSymptomSmartVisuals(visuals, { canGenerate, approved })

    // Nothing to render and nothing to offer: skip the client component
    // entirely for staff at practices that don't use the feature.
    const aiVisualsEnabled =
      isSuperuser || (await isFeatureEnabledForSurgery(surgeryId, FEATURE_AI_SYMPTOM_VISUALS))
    if (visibleVisuals.length > 0 || (canGenerate && aiVisualsEnabled)) {
      smartVisual = {
        surgeryId,
        symptomId: symptomKeyId,
        visuals: visibleVisuals.map((v) => ({
          variantKey: v.variantKey,
          layout: v.layout,
          generatedAtIso: v.generatedAt.toISOString(),
          isStale: v.isStale,
        })),
        canGenerate,
        aiVisualsEnabled,
        approved,
      }
    }
  }

  return (
    <div className="min-h-screen bg-nhs-light-grey">
      <SimpleHeader surgeries={surgeries} currentSurgeryId={surgeryId} />
      {/* Inline status badge and approver info */}
      {surgeryId && (
        (() => {
          const status = reviewStatus
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
        hideAgeBands={hideAgeBands}
        smartVisual={smartVisual}
      />
    </div>
  )
}
