import { NextResponse } from 'next/server'
import { requireSuperuser } from '@/lib/rbac'
import { refreshPracticeListSizes, PracticeDataRefreshError } from '@/server/practiceListSize'

export const maxDuration = 300

// POST /api/super/practice-data/refresh — Download and import the latest NHS Digital list-size CSV
export async function POST() {
  try {
    await requireSuperuser()
    const summary = await refreshPracticeListSizes()
    return NextResponse.json(summary)
  } catch (error) {
    if (error instanceof PracticeDataRefreshError) {
      console.error('Practice data refresh failed:', error.message)
      return NextResponse.json({ error: error.clientMessage }, { status: 502 })
    }
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
