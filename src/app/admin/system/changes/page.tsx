export const dynamic = 'force-dynamic'
export const revalidate = 0

import { getSessionUser } from '@/lib/rbac'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { DEFAULT_CHANGE_WINDOW_DAYS } from '@/server/recentlyChangedSymptoms'
import { readChangesBaselineDate, isBaselineActive, formatBaselineDate } from '@/server/whatsChangedBaseline'
import ChangeAwarenessClient from './ChangeAwarenessClient'

interface UiConfigWithBaselines {
  signposting?: {
    changesBaselineDate?: string
  }
  practiceHandbook?: {
    changesBaselineDate?: string
  }
  [key: string]: unknown
}

export default async function ChangeAwarenessPage() {
  const user = await getSessionUser()
  
  if (!user) {
    redirect('/login')
  }

  // Only superusers can access System Management
  if (user.globalRole !== 'SUPERUSER') {
    redirect('/unauthorized')
  }

  // Get all surgeries with their baseline settings
  const surgeries = await prisma.surgery.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      uiConfig: true,
    },
    orderBy: {
      name: 'asc',
    },
  })

  // Process surgeries to extract baseline info
  const surgeriesWithBaselines = surgeries.map((surgery) => {
    const uiConfig = surgery.uiConfig as UiConfigWithBaselines | null
    const signpostingBaseline = readChangesBaselineDate(uiConfig, 'signposting')
    const handbookBaseline = readChangesBaselineDate(uiConfig, 'practiceHandbook')

    return {
      id: surgery.id,
      name: surgery.name,
      slug: surgery.slug,
      signpostingBaseline: signpostingBaseline ? signpostingBaseline.toISOString() : null,
      signpostingBaselineFormatted: signpostingBaseline ? formatBaselineDate(signpostingBaseline) : null,
      signpostingBaselineActive: isBaselineActive(DEFAULT_CHANGE_WINDOW_DAYS, signpostingBaseline),
      handbookBaseline: handbookBaseline ? handbookBaseline.toISOString() : null,
      handbookBaselineFormatted: handbookBaseline ? formatBaselineDate(handbookBaseline) : null,
      handbookBaselineActive: isBaselineActive(DEFAULT_CHANGE_WINDOW_DAYS, handbookBaseline),
    }
  })

  return (
    <ChangeAwarenessClient 
      globalWindowDays={DEFAULT_CHANGE_WINDOW_DAYS}
      surgeries={surgeriesWithBaselines}
    />
  )
}
