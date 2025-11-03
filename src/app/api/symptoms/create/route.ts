import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'
import { z } from 'zod'

const CreateSchema = z.object({
  target: z.enum(['BASE', 'SURGERY']),
  surgeryId: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  briefInstruction: z.string().max(500).optional().nullable(),
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

    // Authorisation
    if (user.globalRole === 'PRACTICE_ADMIN') {
      if (target !== 'SURGERY') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    } else if (user.globalRole !== 'SUPERUSER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Resolve surgeryId
    const surgeryId = target === 'SURGERY'
      ? (user.globalRole === 'PRACTICE_ADMIN' ? user.surgeryId : parsed.data.surgeryId)
      : undefined
    if (target === 'SURGERY' && !surgeryId) {
      return NextResponse.json({ error: 'surgeryId required for SURGERY target' }, { status: 400 })
    }
    if (user.globalRole === 'PRACTICE_ADMIN' && surgeryId !== user.surgeryId) {
      return NextResponse.json({ error: 'Forbidden: surgery mismatch' }, { status: 403 })
    }

    const nameCi = parsed.data.name.trim()

    if (target === 'BASE') {
      // Exact duplicate check in Base
      const dupe = await prisma.baseSymptom.findFirst({ where: { name: nameCi } })
      if (dupe) {
        return NextResponse.json({ error: 'DUPLICATE', matches: [{ id: dupe.id, name: dupe.name }] }, { status: 409 })
      }

      const created = await prisma.baseSymptom.create({
        data: {
          name: nameCi,
          briefInstruction: parsed.data.briefInstruction ?? null,
          instructionsHtml: parsed.data.instructionsHtml,
          instructionsJson: parsed.data.instructionsJson ? JSON.stringify(parsed.data.instructionsJson) : null,
        }
      })
      // TODO: Improve duplicate check with fuzzy matching (Levenshtein/trigram) later
      // TODO: Add audit logging for create/promote actions (SymptomHistory)
      return NextResponse.json({ baseSymptomId: created.id }, { status: 201 })
    }

    // target === 'SURGERY'
    const sid = surgeryId as string
    // Exact duplicate in Base
    const baseDupe = await prisma.baseSymptom.findFirst({ where: { name: nameCi } })
    // Exact duplicate in Surgery custom
    const customDupe = await prisma.surgeryCustomSymptom.findFirst({ where: { surgeryId: sid, name: nameCi } })
    if (baseDupe || customDupe) {
      return NextResponse.json({ error: 'DUPLICATE', matches: [
        ...(baseDupe ? [{ id: baseDupe.id, name: baseDupe.name, scope: 'BASE' as const }] : []),
        ...(customDupe ? [{ id: customDupe.id, name: customDupe.name, scope: 'SURGERY' as const }] : []),
      ] }, { status: 409 })
    }

    const created = await prisma.surgeryCustomSymptom.create({
      data: {
        surgeryId: sid,
        slug: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`,
        name: nameCi,
        ageGroup: 'Adult',
        briefInstruction: parsed.data.briefInstruction ?? null,
        instructions: null,
        instructionsHtml: parsed.data.instructionsHtml,
        instructionsJson: parsed.data.instructionsJson ? JSON.stringify(parsed.data.instructionsJson) : null,
      }
    })

    // Upsert SurgerySymptomStatus enablement
    await prisma.surgerySymptomStatus.upsert({
      where: { surgeryId_customSymptomId: { surgeryId: sid, customSymptomId: created.id } },
      update: { isEnabled: true, lastEditedBy: user.name || user.email, lastEditedAt: new Date() },
      create: { surgeryId: sid, customSymptomId: created.id, isEnabled: true, lastEditedBy: user.name || user.email, lastEditedAt: new Date() }
    })

    // TODO: Improve duplicate check with fuzzy matching (Levenshtein/trigram) later
    // TODO: Add audit logging for create/promote actions (SymptomHistory)
    return NextResponse.json({ customSymptomId: created.id }, { status: 201 })
  } catch (error) {
    console.error('POST /api/symptoms/create error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}


