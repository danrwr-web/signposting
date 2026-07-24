import { NextRequest, NextResponse } from 'next/server'
import { refreshPracticeListSizes, PracticeDataRefreshError } from '@/server/practiceListSize'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

// GET /api/cron/refresh-practice-data — Monthly Vercel Cron: refresh the national
// list-size cache. Authorised by the CRON_SECRET bearer token that Vercel sends
// to cron invocations, not by a user session.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 })
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const summary = await refreshPracticeListSizes()
    console.log(
      `Practice data cron refresh: imported ${summary.count} practices from ${summary.sourceUrl}`
    )
    if (summary.diagnostics.length > 0) {
      console.warn('Practice data cron refresh skipped newer pages:', summary.diagnostics)
    }
    return NextResponse.json(summary)
  } catch (error) {
    if (error instanceof PracticeDataRefreshError) {
      console.error('Practice data cron refresh failed:', error.message)
      return NextResponse.json(
        { error: error.clientMessage, details: error.message },
        { status: 502 }
      )
    }
    console.error('Practice data cron refresh failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
