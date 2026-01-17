import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'
import { isDailyDoseAdmin, resolveSurgeryIdForUser } from '@/lib/daily-dose/access'
import { DailyDoseSurgeryQueryZ, DailyDoseTopicInputZ } from '@/lib/daily-dose/schemas'
import { z } from 'zod'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const parsed = DailyDoseTopicInputZ.parse(body)
    const query = DailyDoseSurgeryQueryZ.parse({
      surgeryId: request.nextUrl.searchParams.get('surgeryId') ?? body?.surgeryId,
    })
    const surgeryId = resolveSurgeryIdForUser({ requestedId: query.surgeryId, user })
    if (!surgeryId || !isDailyDoseAdmin(user, surgeryId)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const existing = await prisma.dailyDoseTopic.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
    }

    if (existing.surgeryId && existing.surgeryId !== surgeryId) {
      return NextResponse.json({ error: 'Topic does not belong to this surgery' }, { status: 403 })
    }

    if (!existing.surgeryId && user.globalRole !== 'SUPERUSER') {
      return NextResponse.json({ error: 'Superuser access required' }, { status: 403 })
    }

    const topic = await prisma.dailyDoseTopic.update({
      where: { id },
      data: {
        name: parsed.name.trim(),
        roleScope: parsed.roleScope,
        ordering: parsed.ordering ?? existing.ordering,
        isActive: parsed.isActive ?? existing.isActive,
      },
    })

    return NextResponse.json({ topic })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    console.error('PUT /api/daily-dose/admin/topics/[id] error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { id } = await params
    const query = DailyDoseSurgeryQueryZ.parse({
      surgeryId: request.nextUrl.searchParams.get('surgeryId') ?? undefined,
    })
    const surgeryId = resolveSurgeryIdForUser({ requestedId: query.surgeryId, user })
    if (!surgeryId || !isDailyDoseAdmin(user, surgeryId)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const existing = await prisma.dailyDoseTopic.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
    }

    if (existing.surgeryId && existing.surgeryId !== surgeryId) {
      return NextResponse.json({ error: 'Topic does not belong to this surgery' }, { status: 403 })
    }

    if (!existing.surgeryId && user.globalRole !== 'SUPERUSER') {
      return NextResponse.json({ error: 'Superuser access required' }, { status: 403 })
    }

    await prisma.dailyDoseTopic.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    console.error('DELETE /api/daily-dose/admin/topics/[id] error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
