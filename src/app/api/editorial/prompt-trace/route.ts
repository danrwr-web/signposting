import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/rbac'
import { isDailyDoseAdmin, resolveSurgeryIdForUser } from '@/lib/daily-dose/access'
import { promptTraceStore } from '@/lib/editorial/promptTraceStore'
import { z } from 'zod'

const traceIdSchema = z.object({
  traceId: z.string().uuid(),
})

export async function GET(request: NextRequest) {
  // Dev/preview only
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Not found' } }, { status: 404 })
  }

  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const parsed = traceIdSchema.parse({ traceId: searchParams.get('traceId') })

    // Verify user has editor/admin access
    const trace = promptTraceStore.get(parsed.traceId)
    if (!trace) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Trace not found or expired' } },
        { status: 404 }
      )
    }

    // Verify user has access to the surgery (or is superuser)
    if (trace.surgeryId) {
      const surgeryId = resolveSurgeryIdForUser({ requestedId: trace.surgeryId, user })
      if (!surgeryId || !isDailyDoseAdmin(user, surgeryId)) {
        return NextResponse.json(
          { error: { code: 'FORBIDDEN', message: 'Access denied' } },
          { status: 403 }
        )
      }
    }

    return NextResponse.json(trace)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message: 'Invalid traceId' } },
        { status: 400 }
      )
    }
    console.error('GET /api/editorial/prompt-trace error', error)
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
