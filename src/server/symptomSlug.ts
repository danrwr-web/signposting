import 'server-only'

import { prisma } from '@/lib/prisma'
import { slugify } from '@/lib/slugify'

type SymptomSlugScope =
  | { scope: 'BASE' }
  | { scope: 'SURGERY'; surgeryId: string }

function withSuffix(base: string, n: number) {
  return n <= 1 ? base : `${base}-${n}`
}

/**
 * Generate a deterministic, collision-safe slug for a symptom name.
 *
 * - BASE scope: unique across BaseSymptom.slug
 * - SURGERY scope: unique against BOTH BaseSymptom.slug and SurgeryCustomSymptom.slug for that surgery
 */
export async function generateUniqueSymptomSlug(name: string, scope: SymptomSlugScope): Promise<string> {
  const base = slugify(name) || 'symptom'

  // Fast-path: try base first, then -2, -3, ...
  for (let n = 1; n < 10_000; n++) {
    const candidate = withSuffix(base, n)

    if (scope.scope === 'BASE') {
      const exists = await prisma.baseSymptom.findUnique({
        where: { slug: candidate },
        select: { id: true },
      })
      if (!exists) return candidate
      continue
    }

    const [baseExists, customExists] = await Promise.all([
      prisma.baseSymptom.findUnique({ where: { slug: candidate }, select: { id: true } }),
      prisma.surgeryCustomSymptom.findUnique({
        where: { surgeryId_slug: { surgeryId: scope.surgeryId, slug: candidate } },
        select: { id: true },
      }),
    ])

    if (!baseExists && !customExists) return candidate
  }

  // Extremely unlikely unless a surgery has thousands of same-slug symptoms.
  throw new Error('Unable to generate unique symptom slug')
}

