import 'server-only'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'
import { DEFAULT_DAILY_DOSE_TAG_NAMES } from '@/lib/editorial/defaultDailyDoseTags'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/editorial/settings/tags/seed
 *
 * Ensures all default Daily Dose tags exist (creates any that are missing).
 * Superuser-only. Idempotent; safe to call multiple times.
 */
export async function POST() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json(
      { ok: false, error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
      { status: 401 },
    )
  }
  if (user.globalRole !== 'SUPERUSER') {
    return NextResponse.json(
      { ok: false, error: { code: 'FORBIDDEN', message: 'Superuser access required' } },
      { status: 403 },
    )
  }

  try {
    let created = 0
    for (const name of DEFAULT_DAILY_DOSE_TAG_NAMES) {
      const trimmed = name.trim()
      if (!trimmed) continue
      const existing = await prisma.dailyDoseTag.findUnique({
        where: { name: trimmed },
      })
      if (!existing) {
        await prisma.dailyDoseTag.create({
          data: { name: trimmed, createdBy: user.id },
        })
        created += 1
      }
    }
    return NextResponse.json({ ok: true, created, total: DEFAULT_DAILY_DOSE_TAG_NAMES.length })
  } catch (error) {
    console.error('POST /api/editorial/settings/tags/seed error', error)
    return NextResponse.json(
      { ok: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } },
      { status: 500 },
    )
  }
}
