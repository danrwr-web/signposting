import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'
import { z } from 'zod'
import { updateRequiresClinicalReview } from '@/server/updateRequiresClinicalReview'
import { generateUniqueSymptomSlug } from '@/server/symptomSlug'

const CreateSchema = z.object({
  target: z.enum(['BASE', 'SURGERY']),
  // Surgery IDs are Prisma CUIDs (not UUIDs).
  surgeryId: z.string().cuid().optional(),
  name: z.string().min(1).max(120),
  ageGroup: z.enum(['U5', 'O5', 'Adult']).default('Adult'),
  briefInstruction: z.string().max(500).optional().nullable(),
  highlightedText: z.string().max(2000).optional(),
  linkToPage: z.string().max(200).optional(),
  instructionsHtml: z.string().min(1),
  instructionsJson: z.any().optional()
})

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const body = await req.json()
    const parsed = CreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
    }
    const { target } = parsed.data

    const isSuperuser = user.globalRole === 'SUPERUSER'
    const isAdminFor = (surgeryId: string) =>
      Array.isArray((user as any).memberships) &&
      (user as any).memberships.some((m: any) => m.surgeryId === surgeryId && m.role === 'ADMIN')

    if (target === 'BASE') {
      if (!isSuperuser) {
        return NextResponse.json(
          { error: 'Forbidden', reason: 'Base symptom creation is restricted to superusers' },
          { status: 403 }
        )
      }
    }

    // Resolve surgeryId for SURGERY target:
    // - Prefer payload surgeryId
    // - Fall back to user's default/current surgery only if payload surgeryId is missing
    const resolvedSurgeryId =
      target === 'SURGERY'
        ? (parsed.data.surgeryId || (user as any).defaultSurgeryId || (user as any).surgeryId || undefined)
        : undefined

    if (target === 'SURGERY' && !resolvedSurgeryId) {
      return NextResponse.json({ error: 'surgeryId required for SURGERY target' }, { status: 400 })
    }

    if (target === 'SURGERY' && !isSuperuser) {
      if (!isAdminFor(resolvedSurgeryId!)) {
        return NextResponse.json(
          { error: 'Forbidden', reason: 'User lacks admin access to surgeryId' },
          { status: 403 }
        )
      }
    }

    const nameCi = parsed.data.name.trim()
    const ageGroup = parsed.data.ageGroup

    if (target === 'BASE') {
      const slug = await generateUniqueSymptomSlug(nameCi, { scope: 'BASE' })

      const created = await prisma.baseSymptom.create({
        data: {
          slug,
          name: nameCi,
          ageGroup,
          briefInstruction: parsed.data.briefInstruction ?? null,
          highlightedText: parsed.data.highlightedText ?? null,
          linkToPage: parsed.data.linkToPage ?? null,
          // Keep legacy mirroring for back-compat.
          instructions: parsed.data.instructionsHtml,
          instructionsHtml: parsed.data.instructionsHtml,
          instructionsJson: parsed.data.instructionsJson ? JSON.stringify(parsed.data.instructionsJson) : null,
        }
      })
      // TODO: Improve duplicate check with fuzzy matching (Levenshtein/trigram) later
      // TODO: Add audit logging for create/promote actions (SymptomHistory)
      return NextResponse.json({ baseSymptomId: created.id }, { status: 201 })
    }

    // target === 'SURGERY'
    const sid = resolvedSurgeryId as string
    const slug = await generateUniqueSymptomSlug(nameCi, { scope: 'SURGERY', surgeryId: sid })

    const created = await prisma.surgeryCustomSymptom.create({
      data: {
        surgeryId: sid,
        slug,
        name: nameCi,
        ageGroup,
        briefInstruction: parsed.data.briefInstruction ?? null,
        highlightedText: parsed.data.highlightedText ?? null,
        linkToPage: parsed.data.linkToPage ?? null,
        // Keep legacy mirroring for back-compat.
        instructions: parsed.data.instructionsHtml,
        instructionsHtml: parsed.data.instructionsHtml,
        instructionsJson: parsed.data.instructionsJson ? JSON.stringify(parsed.data.instructionsJson) : null,
      }
    })

    // Practice-admin created symptoms start as pending and disabled
    // to ensure local clinical review before becoming visible.
    // Superusers creating SURGERY symptoms should still be enabled (they're acting as admins)
    const isPracticeAdmin = user.globalRole === 'PRACTICE_ADMIN' || 
      (user.globalRole !== 'SUPERUSER' &&
       Array.isArray((user as any).memberships) && 
       (user as any).memberships.some((m: any) => m.surgeryId === sid && m.role === 'ADMIN'))

    await prisma.surgerySymptomStatus.upsert({
      where: { surgeryId_customSymptomId: { surgeryId: sid, customSymptomId: created.id } },
      update: { 
        isEnabled: isPracticeAdmin ? false : true, 
        lastEditedBy: user.name || user.email, 
        lastEditedAt: new Date() 
      },
      create: { 
        surgeryId: sid, 
        customSymptomId: created.id, 
        isEnabled: isPracticeAdmin ? false : true, 
        lastEditedBy: user.name || user.email, 
        lastEditedAt: new Date() 
      }
    })

    // If created by practice admin, create review status as PENDING
    if (isPracticeAdmin) {
      await prisma.symptomReviewStatus.upsert({
        where: {
          surgeryId_symptomId_ageGroup: {
            surgeryId: sid,
            symptomId: created.id,
            ageGroup: 'Adult', // Default age group for created symptoms
          }
        },
        update: {
          status: 'PENDING',
        },
        create: {
          surgeryId: sid,
          symptomId: created.id,
          ageGroup: 'Adult',
          status: 'PENDING',
        }
      })

      // Update requiresClinicalReview flag (will be true since symptom is disabled but pending)
      await updateRequiresClinicalReview(sid)
    }

    // TODO: Improve duplicate check with fuzzy matching (Levenshtein/trigram) later
    // TODO: Add audit logging for create/promote actions (SymptomHistory)
    return NextResponse.json({ customSymptomId: created.id }, { status: 201 })
  } catch (error) {
    console.error('POST /api/symptoms/create error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


