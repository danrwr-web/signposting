import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'
import { z } from 'zod'

interface SymptomPreviewResponse {
  name: string
  status: 'BASE' | 'MODIFIED' | 'LOCAL_ONLY'
  isEnabled: boolean
  canEnable: boolean
  lastEditedBy: string | null
  lastEditedAt: string | null
  briefInstruction: string | null
  instructionsHtml: string | null
  baseInstructionsHtml: string | null
  statusRowId: string | null
  highlightedText: string | null
}

const QuerySchema = z
  .object({
    surgeryId: z.string().min(1, 'surgeryId required'),
    baseSymptomId: z.string().optional(),
    customSymptomId: z.string().optional(),
  })
  .refine(q => !!q.baseSymptomId || !!q.customSymptomId, {
    message: 'Either baseSymptomId or customSymptomId must be provided',
    path: ['baseSymptomId'],
  })

// GET - Fetch symptom preview data
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const parsed = QuerySchema.safeParse({
      surgeryId: searchParams.get('surgeryId') || '',
      baseSymptomId: searchParams.get('baseSymptomId') || undefined,
      customSymptomId: searchParams.get('customSymptomId') || undefined,
    })

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid query', details: parsed.error.flatten() }, { status: 400 })
    }

    const { surgeryId, baseSymptomId, customSymptomId } = parsed.data

    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const isSuper = user.globalRole === 'SUPERUSER'
    const isPracticeAdmin = Array.isArray((user as any).memberships)
      ? (user as any).memberships.some((m: any) => m.surgeryId === surgeryId && m.role === 'ADMIN')
      : false

    if (!isSuper && !isPracticeAdmin) {
      return NextResponse.json({ error: 'Superuser or Practice Admin required' }, { status: 403 })
    }

    let response: SymptomPreviewResponse

    if (baseSymptomId) {
      const surgeryExists = await prisma.surgery.findUnique({ where: { id: surgeryId }, select: { id: true } })
      if (!surgeryExists) {
        return NextResponse.json({ error: 'Surgery not found' }, { status: 404 })
      }

      const baseSymptom = await prisma.baseSymptom.findFirst({
        where: { id: baseSymptomId, isDeleted: false },
        select: { id: true, name: true, briefInstruction: true, instructionsHtml: true, highlightedText: true }
      })
      if (!baseSymptom) {
        return NextResponse.json({ error: 'Base symptom not found' }, { status: 404 })
      }

      let override: { briefInstruction: string | null; instructionsHtml: string | null; highlightedText: string | null } | null = null
      try {
        override = await prisma.surgerySymptomOverride.findUnique({
          where: { surgeryId_baseSymptomId: { surgeryId, baseSymptomId } },
          select: { briefInstruction: true, instructionsHtml: true, highlightedText: true }
        })
      } catch {
        override = null
      }

      const statusRow = await prisma.surgerySymptomStatus.findFirst({
        where: { surgeryId, baseSymptomId },
        select: { id: true, isEnabled: true, lastEditedBy: true, lastEditedAt: true }
      })

      const hasOverride = !!override
      const isEnabled = !!statusRow?.isEnabled
      const effectiveBriefInstruction = hasOverride
        ? (override?.briefInstruction ?? baseSymptom.briefInstruction ?? null)
        : (baseSymptom.briefInstruction ?? null)
      const effectiveInstructionsHtml = hasOverride
        ? (override?.instructionsHtml ?? baseSymptom.instructionsHtml ?? null)
        : (baseSymptom.instructionsHtml ?? null)
      const effectiveHighlightedText = hasOverride
        ? (override?.highlightedText ?? baseSymptom.highlightedText ?? null)
        : (baseSymptom.highlightedText ?? null)

      response = {
        name: baseSymptom.name,
        status: hasOverride ? 'MODIFIED' : 'BASE',
        isEnabled,
        canEnable: true,
        lastEditedBy: statusRow?.lastEditedBy ?? null,
        lastEditedAt: statusRow?.lastEditedAt ? statusRow.lastEditedAt.toISOString() : null,
        briefInstruction: effectiveBriefInstruction,
        instructionsHtml: effectiveInstructionsHtml,
        baseInstructionsHtml: hasOverride ? (baseSymptom.instructionsHtml ?? null) : null,
        statusRowId: statusRow?.id ?? null,
        highlightedText: effectiveHighlightedText,
      }
    } else if (customSymptomId) {
      const surgeryExists = await prisma.surgery.findUnique({ where: { id: surgeryId }, select: { id: true } })
      if (!surgeryExists) {
        return NextResponse.json({ error: 'Surgery not found' }, { status: 404 })
      }

      const customSymptom = await prisma.surgeryCustomSymptom.findFirst({
        where: { id: customSymptomId, surgeryId, isDeleted: false },
        select: { id: true, name: true, briefInstruction: true, instructionsHtml: true, highlightedText: true }
      })
      if (!customSymptom) {
        return NextResponse.json({ error: 'Custom symptom not found' }, { status: 404 })
      }

      const statusRow = await prisma.surgerySymptomStatus.findFirst({
        where: { surgeryId, customSymptomId },
        select: { id: true, isEnabled: true, lastEditedBy: true, lastEditedAt: true }
      })

      response = {
        name: customSymptom.name,
        status: 'LOCAL_ONLY',
        isEnabled: !!statusRow?.isEnabled,
        canEnable: true,
        lastEditedBy: statusRow?.lastEditedBy ?? null,
        lastEditedAt: statusRow?.lastEditedAt ? statusRow.lastEditedAt.toISOString() : null,
        briefInstruction: customSymptom.briefInstruction ?? null,
        instructionsHtml: customSymptom.instructionsHtml ?? null,
        baseInstructionsHtml: null,
        statusRowId: statusRow?.id ?? null,
        highlightedText: customSymptom.highlightedText ?? null,
      }
    } else {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    return NextResponse.json(response)
  } catch (error) {
    try {
      const url = new URL(request.url)
      const surgeryId = url.searchParams.get('surgeryId') || ''
      const baseSymptomId = url.searchParams.get('baseSymptomId') || ''
      const customSymptomId = url.searchParams.get('customSymptomId') || ''
      console.error('SYMPTOM_PREVIEW_ERROR', {
        surgeryId,
        baseSymptomId,
        customSymptomId,
        error: (error as any)?.code || (error as any)?.name || 'Unknown',
        message: (error as any)?.message,
      })
    } catch {}
    return NextResponse.json({ error: 'Preview failed unexpectedly' }, { status: 500 })
  }
}
