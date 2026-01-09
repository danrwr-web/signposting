import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireSurgeryAdmin } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { unstable_noStore as noStore } from 'next/cache'
import { getEffectiveSymptoms } from '@/server/effectiveSymptoms'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

// GET /api/admin/clinical-review-data?surgeryId=xxx
export async function GET(request: NextRequest) {
  try {
    noStore()

    const { searchParams } = new URL(request.url)
    const surgeryId = searchParams.get('surgeryId')

    if (!surgeryId) {
      return NextResponse.json(
        { error: 'surgeryId is required' },
        { status: 400 }
      )
    }

    // Check permissions - user must be superuser or admin of this surgery
    await requireSurgeryAdmin(surgeryId)

    // Backfill/normalise review statuses so counts reconcile:
    // - If a symptom has a legacy row with ageGroup=null, normalise it to the symptom's ageGroup when safe
    // - If a symptom has no row at all, create one defaulting to APPROVED (legacy)
    const effectiveSymptoms = await getEffectiveSymptoms(surgeryId, true)
    const existingStatuses = await prisma.symptomReviewStatus.findMany({
      where: { surgeryId },
      select: { id: true, symptomId: true, ageGroup: true, status: true },
    })

    const bySymptomId = new Map<string, Array<{ id: string; symptomId: string; ageGroup: string | null; status: any }>>()
    for (const rs of existingStatuses) {
      const arr = bySymptomId.get(rs.symptomId) || []
      arr.push(rs)
      bySymptomId.set(rs.symptomId, arr)
    }

    const toCreate: Array<{ surgeryId: string; symptomId: string; ageGroup: string; status: 'APPROVED' }> = []
    const toUpdateAgeGroup: Array<{ id: string; ageGroup: string }> = []
    const toDeleteIds: string[] = []

    for (const s of effectiveSymptoms) {
      const list = bySymptomId.get(s.id) || []
      const targetAgeGroup = String(s.ageGroup)
      const exact = list.find((r) => r.ageGroup === targetAgeGroup)
      if (exact) continue

      const legacyNull = list.find((r) => r.ageGroup === null)
      if (legacyNull) {
        // If there are multiple null rows, keep the first and delete the rest to reduce ambiguity.
        const extraNulls = list.filter((r) => r.ageGroup === null && r.id !== legacyNull.id)
        for (const d of extraNulls) toDeleteIds.push(d.id)
        // Only normalise null -> ageGroup if it won't collide with an existing exact row.
        const wouldCollide = list.some((r) => r.ageGroup === targetAgeGroup)
        if (!wouldCollide) {
          toUpdateAgeGroup.push({ id: legacyNull.id, ageGroup: targetAgeGroup })
          continue
        }
        // If it would collide, prefer the exact row and delete the null legacy row.
        toDeleteIds.push(legacyNull.id)
        continue
      }

      // No row at all for this symptom: backfill as APPROVED (legacy default).
      toCreate.push({ surgeryId, symptomId: s.id, ageGroup: targetAgeGroup, status: 'APPROVED' })
    }

    if (toDeleteIds.length || toUpdateAgeGroup.length || toCreate.length) {
      await prisma.$transaction([
        ...(toDeleteIds.length
          ? [prisma.symptomReviewStatus.deleteMany({ where: { id: { in: toDeleteIds } } })]
          : []),
        ...toUpdateAgeGroup.map((u) =>
          prisma.symptomReviewStatus.update({ where: { id: u.id }, data: { ageGroup: u.ageGroup } })
        ),
        ...(toCreate.length
          ? [prisma.symptomReviewStatus.createMany({ data: toCreate as any, skipDuplicates: true })]
          : []),
      ])
    }

    // Get surgery details with review information (after backfill)
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
          select: {
            id: true,
            surgeryId: true,
            symptomId: true,
            ageGroup: true,
            status: true,
            lastReviewedAt: true,
            lastReviewedById: true,
            reviewNote: true,
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
      return NextResponse.json(
        { error: 'Surgery not found' },
        { status: 404 }
      )
    }

    const res = NextResponse.json({
      surgery: {
        id: surgery.id,
        name: surgery.name,
        requiresClinicalReview: surgery.requiresClinicalReview,
        lastClinicalReviewAt: surgery.lastClinicalReviewAt,
        lastClinicalReviewer: surgery.lastClinicalReviewer,
      },
      reviewStatuses: surgery.symptomReviews
    })
    res.headers.set('Cache-Control', 'no-store')
    return res
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error fetching clinical review data:', error)
    const res = NextResponse.json(
      { error: 'Failed to fetch clinical review data' },
      { status: 500 }
    )
    res.headers.set('Cache-Control', 'no-store')
    return res
  }
}

