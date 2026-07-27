import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'
import { z } from 'zod'

export const runtime = 'nodejs'

const calloutActionSchema = z.object({
  key: z.string().trim().min(1).max(100),
  action: z.enum(['seen', 'dismiss']),
})

function serialise(state: { calloutKey: string; firstSeenAt: Date; dismissedAt: Date | null }) {
  return {
    key: state.calloutKey,
    firstSeenAt: state.firstSeenAt.toISOString(),
    dismissedAt: state.dismissedAt ? state.dismissedAt.toISOString() : null,
  }
}

// GET /api/callouts — the caller's callout states
export async function GET() {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const states = await prisma.userCalloutState.findMany({
      where: { userId: user.id },
    })

    return NextResponse.json({ callouts: states.map(serialise) })
  } catch (error) {
    console.error('Callouts API: Error fetching callout states:', error)
    return NextResponse.json({ error: 'Failed to fetch callout states' }, { status: 500 })
  }
}

// POST /api/callouts — record that a callout was seen or dismissed.
// 'seen' is an idempotent upsert that anchors firstSeenAt on first sight;
// 'dismiss' additionally stamps dismissedAt.
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = calloutActionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.issues },
        { status: 400 }
      )
    }
    const { key, action } = parsed.data

    const state = await prisma.userCalloutState.upsert({
      where: { userId_calloutKey: { userId: user.id, calloutKey: key } },
      create: {
        userId: user.id,
        calloutKey: key,
        dismissedAt: action === 'dismiss' ? new Date() : null,
      },
      update: action === 'dismiss' ? { dismissedAt: new Date() } : {},
    })

    return NextResponse.json({ callout: serialise(state) })
  } catch (error) {
    console.error('Callouts API: Error updating callout state:', error)
    return NextResponse.json({ error: 'Failed to update callout state' }, { status: 500 })
  }
}
