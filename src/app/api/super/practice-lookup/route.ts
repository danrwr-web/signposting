import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSuperuser } from '@/lib/rbac'
import { searchPractices, OdsLookupError } from '@/server/odsLookup'

const querySchema = z.object({
  q: z.string().trim().min(2).max(100),
})

// GET /api/super/practice-lookup?q= — Search the NHS ODS register for GP practices
export async function GET(request: NextRequest) {
  try {
    await requireSuperuser()

    const parsed = querySchema.safeParse({ q: request.nextUrl.searchParams.get('q') ?? '' })
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Query must be between 2 and 100 characters' },
        { status: 400 }
      )
    }

    const results = await searchPractices(parsed.data.q)
    return NextResponse.json({ results })
  } catch (error) {
    if (error instanceof OdsLookupError) {
      console.error('ODS search error:', error.message)
      return NextResponse.json({ error: error.clientMessage }, { status: 502 })
    }
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
