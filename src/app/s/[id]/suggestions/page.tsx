import { requireSurgeryAccess } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import MySuggestionsClient from './MySuggestionsClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface MySuggestionsPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function MySuggestionsPage({ params }: MySuggestionsPageProps) {
  const { id: surgeryId } = await params

  try {
    const user = await requireSurgeryAccess(surgeryId)

    const mineWhere = {
      OR: [{ submittedByUserId: user.id }, { userEmail: user.email }],
    }

    const suggestions = await prisma.suggestion.findMany({
      where: mineWhere,
      include: {
        surgery: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    // Flag responses the user hasn't seen before marking them viewed, so the
    // "New response" badge shows on this visit and clears on the next.
    const newResponseIds = new Set(
      suggestions.filter((s) => s.response && !s.responseViewedAt).map((s) => s.id)
    )
    if (newResponseIds.size > 0) {
      await prisma.suggestion.updateMany({
        where: { ...mineWhere, id: { in: [...newResponseIds] } },
        data: { responseViewedAt: new Date() },
      })
    }

    return (
      <MySuggestionsClient
        surgeryId={surgeryId}
        suggestions={suggestions.map((s) => ({
          id: s.id,
          type: s.type,
          status: s.status,
          surgeryId: s.surgeryId,
          baseId: s.baseId,
          symptom: s.symptom,
          title: s.title,
          text: s.text,
          pageContext: s.pageContext,
          userEmail: s.userEmail,
          submittedByUserId: s.submittedByUserId,
          response: s.response,
          respondedAt: s.respondedAt ? s.respondedAt.toISOString() : null,
          responseViewedAt: s.responseViewedAt ? s.responseViewedAt.toISOString() : null,
          createdAt: s.createdAt.toISOString(),
          updatedAt: s.updatedAt.toISOString(),
          surgery: s.surgery,
          hasNewResponse: newResponseIds.has(s.id),
        }))}
      />
    )
  } catch (error) {
    // Don't catch NEXT_REDIRECT errors - let them propagate
    if (
      error &&
      typeof error === 'object' &&
      'digest' in error &&
      typeof error.digest === 'string' &&
      error.digest.startsWith('NEXT_REDIRECT')
    ) {
      throw error
    }
    redirect('/unauthorized')
  }
}
