import 'server-only'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'
import { DEFAULT_LEARNING_CATEGORIES } from '@/lib/editorial/defaultLearningCategories'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/editorial/settings/learning-categories/seed
 *
 * Seeds the 12 default learning categories.
 * Skips any category whose slug already exists.
 * Returns counts of created vs skipped.
 * Superuser-only.
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
    let skipped = 0

    for (const cat of DEFAULT_LEARNING_CATEGORIES) {
      const existing = await prisma.learningCategory.findUnique({ where: { slug: cat.slug } })
      if (existing) {
        skipped++
        continue
      }

      await prisma.learningCategory.create({
        data: {
          name: cat.name,
          slug: cat.slug,
          ordering: cat.ordering,
          subsections: cat.subsections,
          isActive: true,
        },
      })
      created++
    }

    return NextResponse.json({
      ok: true,
      created,
      skipped,
      total: DEFAULT_LEARNING_CATEGORIES.length,
    })
  } catch (error) {
    console.error('POST /api/editorial/settings/learning-categories/seed error', error)
    return NextResponse.json(
      { ok: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } },
      { status: 500 },
    )
  }
}
