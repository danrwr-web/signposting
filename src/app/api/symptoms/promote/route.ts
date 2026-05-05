import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'
import { z } from 'zod'
import { revalidateTag } from 'next/cache'
import { getCachedSymptomsTag } from '@/server/effectiveSymptoms'

// Symptom IDs are Prisma CUIDs (not UUIDs).
const Schema = z.object({ customSymptomId: z.string().cuid() })

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

    const custom = await prisma.surgeryCustomSymptom.findUnique({ where: { id: parsed.data.customSymptomId } })
    if (!custom) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const created = await prisma.$transaction(async (tx) => {
      // Promote with structurally-global fields only. Tenant-flavoured prose
      // stays with the originating surgery as an override so it does not leak
      // to other surgeries via the base-symptom fallback.
      const base = await tx.baseSymptom.create({
        data: {
          name: custom.name,
          slug: custom.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
          ageGroup: custom.ageGroup,
          linkToPage: custom.linkToPage,
        }
      })

      const hasProse =
        (custom.briefInstruction ?? '') !== '' ||
        (custom.instructions ?? '') !== '' ||
        (custom.instructionsHtml ?? '') !== '' ||
        (custom.instructionsJson ?? '') !== '' ||
        (custom.highlightedText ?? '') !== ''

      if (hasProse) {
        await tx.surgerySymptomOverride.create({
          data: {
            surgeryId: custom.surgeryId,
            baseSymptomId: base.id,
            briefInstruction: custom.briefInstruction,
            instructions: custom.instructions,
            instructionsHtml: custom.instructionsHtml,
            instructionsJson: custom.instructionsJson,
            highlightedText: custom.highlightedText,
            lastEditedBy: user.name || user.email,
            lastEditedAt: new Date(),
          }
        })
      }

      // Update status: point to baseSymptomId, keep enabled
      await tx.surgerySymptomStatus.updateMany({
        where: { surgeryId: custom.surgeryId, customSymptomId: custom.id },
        data: { customSymptomId: null, baseSymptomId: base.id, isEnabled: true, lastEditedBy: user.name || user.email, lastEditedAt: new Date() }
      })

      return base
    })

    // Promoting a custom symptom affects base + surgery effective symptom lists.
    revalidateTag(getCachedSymptomsTag(custom.surgeryId, false))
    revalidateTag(getCachedSymptomsTag(custom.surgeryId, true))
    revalidateTag('symptoms')

    // TODO: Add audit logging for create/promote actions (SymptomHistory)
    return NextResponse.json({ ok: true, baseSymptomId: created.id })
  } catch (error) {
    console.error('POST /api/symptoms/promote error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


