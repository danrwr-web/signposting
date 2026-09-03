import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'
import { isDailyDoseAdmin, resolveSurgeryIdForUser } from '@/lib/daily-dose/access'
import { getEffectiveSymptoms } from '@/server/effectiveSymptoms'

interface RouteParams {
  params: Promise<{ batchId: string }>
}

type JsonObject = Record<string, unknown>

function asObject(value: unknown): JsonObject | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as JsonObject
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

function stripHtml(value: string | null | undefined): string {
  if (!value) return ''
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
        { status: 401 },
      )
    }

    const { batchId } = await params
    const requestedId = request.nextUrl.searchParams.get('surgeryId') ?? undefined
    const surgeryId = resolveSurgeryIdForUser({ requestedId, user })

    if (!surgeryId || !isDailyDoseAdmin(user, surgeryId)) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Admin access required' } },
        { status: 403 },
      )
    }

    const batch = await prisma.dailyDoseGenerationBatch.findFirst({
      where: { id: batchId, surgeryId },
      select: {
        id: true,
        targetRole: true,
        generationMeta: true,
        createdAt: true,
      },
    })

    if (!batch) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Batch not found' } },
        { status: 404 },
      )
    }

    if (batch.targetRole !== 'ADMIN') {
      return NextResponse.json({ applicable: false })
    }

    const generationMeta = asObject(batch.generationMeta)
    const storedSourceReview = asObject(generationMeta?.sourceReview)
    const storedContext =
      typeof storedSourceReview?.toolkitContext === 'string'
        ? storedSourceReview.toolkitContext
        : null

    if (storedContext) {
      return NextResponse.json({
        applicable: true,
        mode: 'snapshot',
        generatedAt: batch.createdAt,
        capturedAt:
          typeof storedSourceReview?.capturedAt === 'string'
            ? storedSourceReview.capturedAt
            : null,
        matchedSymptoms: asStringArray(storedSourceReview?.matchedSymptoms),
        fallbackUsed: storedSourceReview?.fallbackUsed === true,
        fallbackReason:
          typeof storedSourceReview?.fallbackReason === 'string'
            ? storedSourceReview.fallbackReason
            : null,
        snapshotContext: storedContext,
        symptoms: [],
      })
    }

    const matchedSymptoms = asStringArray(generationMeta?.matchedSymptoms)
    const fallbackUsed = generationMeta?.fallbackUsed === true
    const fallbackReason =
      typeof generationMeta?.fallbackReason === 'string' ? generationMeta.fallbackReason : null

    if (matchedSymptoms.length === 0) {
      return NextResponse.json({
        applicable: true,
        mode: 'current',
        generatedAt: batch.createdAt,
        matchedSymptoms: [],
        fallbackUsed,
        fallbackReason,
        snapshotContext: null,
        symptoms: [],
      })
    }

    const effectiveSymptoms = await getEffectiveSymptoms(surgeryId, false)
    const wanted = new Set(matchedSymptoms.map((name) => name.trim().toLowerCase()))

    const symptoms = effectiveSymptoms
      .filter((symptom) => wanted.has((symptom.name || '').trim().toLowerCase()))
      .map((symptom) => ({
        id: symptom.id,
        name: symptom.name || 'Untitled symptom',
        ageGroup: symptom.ageGroup || null,
        briefInstruction: symptom.briefInstruction || null,
        instructionsText: stripHtml(symptom.instructionsHtml || symptom.instructions),
        highlightedText: symptom.highlightedText || null,
        sourceUrl: `/symptom/${symptom.id}?surgery=${surgeryId}`,
      }))

    return NextResponse.json({
      applicable: true,
      mode: 'current',
      generatedAt: batch.createdAt,
      matchedSymptoms,
      fallbackUsed,
      fallbackReason,
      snapshotContext: null,
      symptoms,
    })
  } catch (error) {
    console.error('GET /api/editorial/batches/[batchId]/source-review error', error)
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Unable to load Toolkit source review' } },
      { status: 500 },
    )
  }
}
