export const dynamic = 'force-dynamic'
export const revalidate = 0

import { getSessionUser } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import SuggestionsTriageClient from './SuggestionsTriageClient'
import type { TriageSuggestion } from './types'

export default async function SuggestionsTriagePage() {
  const user = await getSessionUser()

  if (!user) {
    redirect('/login')
  }
  if (user.globalRole !== 'SUPERUSER') {
    redirect('/unauthorized')
  }

  const rows = await prisma.suggestion.findMany({
    include: {
      surgery: { select: { id: true, name: true, slug: true } },
      submittedBy: { select: { id: true, name: true, email: true } },
      respondedBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const suggestions: TriageSuggestion[] = rows.map((s) => ({
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
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    surgery: s.surgery,
    submittedBy: s.submittedBy,
    respondedBy: s.respondedBy,
  }))

  return <SuggestionsTriageClient suggestions={suggestions} />
}
