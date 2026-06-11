import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { requireSuperuser } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { computeAiRerunPlan } from '@/server/aiRerunPlan'

export const runtime = 'nodejs'

// GET /api/surgeries/[surgeryId]/ai/customise-instructions/rerun-plan
// Superuser-only: preview which symptoms are safe to re-run through AI
// customisation without overwriting human edits (see computeAiRerunPlan).
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ surgeryId: string }> }
) {
  try {
    const { surgeryId } = await params

    await requireSuperuser()

    const surgery = await prisma.surgery.findUnique({
      where: { id: surgeryId },
      select: { id: true },
    })
    if (!surgery) {
      return NextResponse.json({ error: 'Surgery not found' }, { status: 404 })
    }

    const plan = await computeAiRerunPlan(surgeryId)
    return NextResponse.json(plan)
  } catch (error) {
    // RBAC helpers throw errors containing "required" on auth failures.
    if (error instanceof Error && error.message.includes('required')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error computing AI rerun plan:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
