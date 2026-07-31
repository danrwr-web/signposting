import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getSessionUser } from '@/lib/rbac'
import { z } from 'zod'
import { revalidateTag } from 'next/cache'
import { getCachedSymptomsTag, getEffectiveSymptomById, resolveLinkToPages } from '@/server/effectiveSymptoms'
import { generateUniqueSymptomSlug } from '@/server/symptomSlug'

/**
 * Superuser-only "push to base" endpoint.
 *
 * - { customSymptomId } — promote a practice-created custom symptom into a
 *   NEW base symptom. The new symptom is opt-in (enabledByDefault=false):
 *   other surgeries see it as available to adopt in their Symptom Library
 *   but it stays disabled until they enable it. The promoting practice keeps
 *   it enabled, and the original custom symptom is retired.
 * - { baseSymptomId, surgeryId } — update an EXISTING base symptom to match
 *   the named practice's customised version (the effective merged content),
 *   then remove that practice's override since it now matches base.
 */
// Symptom IDs are Prisma CUIDs (not UUIDs).
const Schema = z
  .object({
    customSymptomId: z.string().cuid().optional(),
    baseSymptomId: z.string().optional(),
    surgeryId: z.string().optional(),
  })
  .refine(
    (b) => (b.customSymptomId ? !b.baseSymptomId && !b.surgeryId : !!b.baseSymptomId && !!b.surgeryId),
    { message: 'Provide either customSymptomId, or baseSymptomId with surgeryId' }
  )

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    if (user.globalRole !== 'SUPERUSER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json()
    const parsed = Schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
    }

    const editorName = user.name || user.email || 'Superuser'
    const editorEmail = user.email || null

    if (parsed.data.customSymptomId) {
      // ---- Create a new base symptom from a practice custom symptom ----
      const custom = await prisma.surgeryCustomSymptom.findFirst({
        where: { id: parsed.data.customSymptomId, isDeleted: false },
      })
      if (!custom) return NextResponse.json({ error: 'Not found' }, { status: 404 })

      const slug = await generateUniqueSymptomSlug(custom.name, { scope: 'BASE' })
      const links = resolveLinkToPages(custom as any)

      const created = await prisma.$transaction(async (tx) => {
        const base = await tx.baseSymptom.create({
          data: {
            name: custom.name,
            slug,
            ageGroup: custom.ageGroup,
            briefInstruction: custom.briefInstruction,
            instructions: custom.instructions,
            instructionsHtml: custom.instructionsHtml,
            instructionsJson: custom.instructionsJson,
            highlightedText: custom.highlightedText,
            linkToPage: links?.[0] ?? null,
            linkToPages: links ?? Prisma.DbNull,
            variants: (custom as any).variants ?? Prisma.DbNull,
            // Opt-in: other surgeries must adopt it before it appears.
            enabledByDefault: false,
            lastEditedBy: editorName,
            lastEditedAt: new Date(),
          },
        })

        // Keep the promoting practice enabled: repoint its status row at the
        // new base symptom (or create one — opt-in symptoms need an explicit
        // isEnabled row to show at all).
        const repointed = await tx.surgerySymptomStatus.updateMany({
          where: { surgeryId: custom.surgeryId, customSymptomId: custom.id },
          data: {
            customSymptomId: null,
            baseSymptomId: base.id,
            isEnabled: true,
            lastEditedBy: editorName,
            lastEditedAt: new Date(),
          },
        })
        if (repointed.count === 0) {
          await tx.surgerySymptomStatus.create({
            data: {
              surgeryId: custom.surgeryId,
              baseSymptomId: base.id,
              isEnabled: true,
              lastEditedBy: editorName,
              lastEditedAt: new Date(),
            },
          })
        }

        // Retire the practice copy so the practice doesn't see a duplicate.
        await tx.surgeryCustomSymptom.update({
          where: { id: custom.id },
          data: { isDeleted: true },
        })

        // Audit trail for the new base content.
        await tx.symptomHistory.create({
          data: {
            symptomId: base.id,
            source: 'base',
            newText: custom.instructionsHtml ?? custom.instructions ?? '',
            newBriefInstruction: custom.briefInstruction,
            newInstructionsHtml: custom.instructionsHtml,
            newHighlightedText: custom.highlightedText,
            editorName,
            editorEmail,
            modelUsed: 'unknown-model',
          },
        })

        return base
      })

      revalidateTag(getCachedSymptomsTag(custom.surgeryId, false))
      revalidateTag(getCachedSymptomsTag(custom.surgeryId, true))
      revalidateTag('symptoms')

      return NextResponse.json({ ok: true, baseSymptomId: created.id, created: true })
    }

    // ---- Update an existing base symptom to match a practice's version ----
    const surgeryId = parsed.data.surgeryId!
    const baseSymptomId = parsed.data.baseSymptomId!

    const base = await prisma.baseSymptom.findFirst({
      where: { id: baseSymptomId, isDeleted: false },
    })
    if (!base) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const override = await prisma.surgerySymptomOverride.findUnique({
      where: { surgeryId_baseSymptomId: { surgeryId, baseSymptomId } },
    })
    if (!override) {
      return NextResponse.json(
        { error: 'This practice has no customisation of this symptom to push to base' },
        { status: 400 }
      )
    }

    // The effective merged content is exactly what this practice's staff see —
    // tri-state inherit/blank/replace rules are honoured for free.
    const effective = await getEffectiveSymptomById(baseSymptomId, surgeryId)
    if (!effective) {
      return NextResponse.json(
        { error: 'The practice version of this symptom is hidden and cannot be pushed to base' },
        { status: 400 }
      )
    }

    await prisma.$transaction(async (tx) => {
      await tx.baseSymptom.update({
        where: { id: baseSymptomId },
        data: {
          name: effective.name,
          ageGroup: effective.ageGroup,
          briefInstruction: effective.briefInstruction,
          highlightedText: effective.highlightedText,
          instructions: effective.instructions,
          instructionsHtml: effective.instructionsHtml,
          linkToPage: effective.linkToPages?.[0] ?? null,
          linkToPages: effective.linkToPages ?? Prisma.DbNull,
          variants: (effective.variants as any) ?? Prisma.DbNull,
          lastEditedBy: editorName,
          lastEditedAt: new Date(),
        },
      })

      // Audit trail: base content before/after.
      await tx.symptomHistory.create({
        data: {
          symptomId: baseSymptomId,
          source: 'base',
          newText: effective.instructionsHtml ?? effective.instructions ?? '',
          previousBriefInstruction: base.briefInstruction,
          newBriefInstruction: effective.briefInstruction,
          previousInstructionsHtml: base.instructionsHtml,
          newInstructionsHtml: effective.instructionsHtml,
          previousHighlightedText: base.highlightedText,
          newHighlightedText: effective.highlightedText,
          editorName,
          editorEmail,
          modelUsed: 'unknown-model',
        },
      })

      // The practice's customisation now matches base — remove the override so
      // the practice tracks future base updates again (same as Revert to base).
      await tx.surgerySymptomOverride.deleteMany({ where: { surgeryId, baseSymptomId } })
      await tx.surgerySymptomStatus.updateMany({
        where: { surgeryId, baseSymptomId },
        data: { isOverridden: false, lastEditedBy: editorName, lastEditedAt: new Date() },
      })
    })

    revalidateTag(getCachedSymptomsTag(surgeryId, false))
    revalidateTag(getCachedSymptomsTag(surgeryId, true))
    revalidateTag('symptoms')

    return NextResponse.json({ ok: true, baseSymptomId, created: false })
  } catch (error) {
    console.error('POST /api/symptoms/promote error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
