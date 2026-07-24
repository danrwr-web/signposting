import { NextResponse } from 'next/server'
import { requireSuperuser } from '@/lib/rbac'
import { getPracticeDataStatus } from '@/server/practiceListSize'

// GET /api/super/practice-data — Status of the national list-size cache
export async function GET() {
  try {
    await requireSuperuser()
    const status = await getPracticeDataStatus()
    return NextResponse.json(status)
  } catch (error) {
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
