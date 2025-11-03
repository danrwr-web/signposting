/**
 * Admin symptoms API route
 * Handles CRUD operations for effective symptoms (base + overrides + custom)
 */

import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/rbac'
import { getEffectiveSymptoms } from '@/server/effectiveSymptoms'
import { prisma } from '@/lib/prisma'
import { GetEffectiveSymptomsResZ, CreateSymptomReqZ } from '@/lib/api-contracts'
import { z } from 'zod'
import type { EffectiveSymptom } from '@/lib/api-contracts'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const letter = searchParams.get('letter') ?? 'All'
    const q = (searchParams.get('q') ?? '').trim().toLowerCase()

    // Get effective symptoms for this surgery (or all if superuser)
    let allSymptoms
    if (user.globalRole === 'SUPERUSER') {
      // For superuser, get all base symptoms
      allSymptoms = await prisma.baseSymptom.findMany({
        select: { 
          id: true, 
          slug: true, 
          name: true, 
          ageGroup: true,
          briefInstruction: true, 
          highlightedText: true, 
          instructions: true, 
          instructionsJson: true,
          instructionsHtml: true,
          linkToPage: true
        },
        orderBy: { name: 'asc' }
      }).then(results => 
        results.map(s => ({ ...s, source: 'base' as const }))
      )
    } else {
      // For non-superusers, get symptoms for their default surgery
      const surgeryId = user.defaultSurgeryId
      if (!surgeryId) {
        return NextResponse.json(
          { error: 'No default surgery assigned' },
          { status: 403 }
        )
      }
      allSymptoms = await getEffectiveSymptoms(surgeryId)
    }

    // Apply filters
    let symptoms = allSymptoms as EffectiveSymptom[]

    if (letter !== 'All') {
      symptoms = symptoms.filter(s => 
        s.name.trim().toUpperCase().startsWith(letter)
      )
    }

    if (q) {
      symptoms = symptoms.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.briefInstruction?.toLowerCase().includes(q) ||
        s.instructions?.toLowerCase().includes(q)
      )
    }

    return NextResponse.json(
      GetEffectiveSymptomsResZ.parse({ symptoms }),
      { headers: { 'Cache-Control': 'private, max-age=30' } }
    )
  } catch (error) {
    console.error('Error fetching admin symptoms:', error)
    return NextResponse.json(
      { error: 'Failed to fetch symptoms' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
    
    const body = await request.json()
    const { name, slug, ageGroup, briefInstruction, instructions, instructionsJson, instructionsHtml, highlightedText, linkToPage, variants } = CreateSymptomReqZ.parse(body)

    if (user.globalRole === 'SUPERUSER') {
      // Superusers create base symptoms visible to all surgeries
      const existingSymptom = await prisma.baseSymptom.findUnique({
        where: { slug }
      })

      if (existingSymptom) {
        return NextResponse.json(
          { error: 'A symptom with this slug already exists' },
          { status: 409 }
        )
      }

      const symptom = await prisma.baseSymptom.create({
        data: ({
          slug,
          name,
          ageGroup,
          briefInstruction,
          instructions,
          instructionsJson: instructionsJson ? JSON.stringify(instructionsJson) : null,
          instructionsHtml,
          highlightedText,
          linkToPage,
          variants: variants || null,
        } as any),
        select: {
          id: true,
          slug: true,
          name: true,
          ageGroup: true,
          briefInstruction: true,
          highlightedText: true,
          instructions: true,
          instructionsJson: true,
          instructionsHtml: true,
          linkToPage: true,
        }
      })

      return NextResponse.json({ symptom }, { status: 201 })
    } else {
      // Non-superusers create custom symptoms for their default surgery
      const surgeryId = user.defaultSurgeryId
      if (!surgeryId) {
        return NextResponse.json(
          { error: 'No default surgery assigned' },
          { status: 403 }
        )
      }

      const existingSymptom = await prisma.surgeryCustomSymptom.findUnique({
        where: {
          surgeryId_slug: {
            surgeryId: surgeryId,
            slug: slug
          }
        }
      })

      if (existingSymptom) {
        return NextResponse.json(
          { error: 'A symptom with this slug already exists for this surgery' },
          { status: 409 }
        )
      }

      const symptom = await prisma.surgeryCustomSymptom.create({
        data: {
          surgeryId: surgeryId,
          slug,
          name,
          ageGroup,
          briefInstruction,
          instructions,
          instructionsJson: instructionsJson ? JSON.stringify(instructionsJson) : null,
          instructionsHtml,
          highlightedText,
          linkToPage,
        },
        select: {
          id: true,
          slug: true,
          name: true,
          ageGroup: true,
          briefInstruction: true,
          highlightedText: true,
          instructions: true,
          instructionsJson: true,
          instructionsHtml: true,
          linkToPage: true,
        }
      })

      return NextResponse.json({ symptom }, { status: 201 })
    }
  } catch (error) {
    console.error('Error creating custom symptom:', error)
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid request format' },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to create symptom' },
      { status: 500 }
    )
  }
}

// DELETE - Soft delete base/custom symptoms with RBAC
export async function DELETE(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const BodySchema = z.object({
      scope: z.enum(['BASE', 'SURGERY']),
      baseSymptomId: z.string().optional(),
      surgeryId: z.string().optional(),
      customSymptomId: z.string().optional(),
    }).refine(b => (b.scope === 'BASE' && !!b.baseSymptomId) || (b.scope === 'SURGERY' && !!b.surgeryId && !!b.customSymptomId), {
      message: 'Invalid delete payload',
    })

    const json = await request.json().catch(() => ({}))
    const parsed = BodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
    }
    const { scope, baseSymptomId, surgeryId, customSymptomId } = parsed.data

    const isSuper = user.globalRole === 'SUPERUSER'

    if (scope === 'BASE') {
      if (!isSuper) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      const base = await prisma.baseSymptom.findUnique({ where: { id: baseSymptomId! }, select: { id: true } })
      if (!base) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }
      // Soft delete base and clean related rows
      await prisma.$transaction([
        prisma.baseSymptom.update({ where: { id: baseSymptomId! }, data: { isDeleted: true } }),
        prisma.surgerySymptomOverride.deleteMany({ where: { baseSymptomId: baseSymptomId! } }),
        prisma.surgerySymptomStatus.deleteMany({ where: { baseSymptomId: baseSymptomId! } }),
      ])
      return NextResponse.json({ ok: true })
    }

    // SURGERY scope
    const isAdminOfSurgery = isSuper || (Array.isArray((user as any).memberships) && (user as any).memberships.some((m: any) => m.surgeryId === surgeryId && m.role === 'ADMIN'))
    if (!isAdminOfSurgery) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const custom = await prisma.surgeryCustomSymptom.findFirst({ where: { id: customSymptomId!, surgeryId: surgeryId! }, select: { id: true } })
    if (!custom) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    await prisma.$transaction([
      prisma.surgeryCustomSymptom.update({ where: { id: customSymptomId! }, data: { isDeleted: true } }),
      prisma.surgerySymptomStatus.deleteMany({ where: { surgeryId: surgeryId!, customSymptomId: customSymptomId! } }),
    ])
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('ERROR_DELETE_SYMPTOM', { error: (error as any)?.message })
    return NextResponse.json({ error: 'Failed to delete symptom' }, { status: 500 })
  }
}