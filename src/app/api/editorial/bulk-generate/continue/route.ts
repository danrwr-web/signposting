import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { prisma } from '@/lib/prisma'
import { runBulkGenerationChunk } from '@/server/editorial/runBulkGeneration'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * POST /api/editorial/bulk-generate/continue
 * Processes the next chunk of a bulk run. Called by the server after each chunk completes.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const bulkRunId = body.bulkRunId
    if (!bulkRunId || typeof bulkRunId !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'bulkRunId is required' },
        { status: 400 }
      )
    }

    const run = await prisma.bulkGenerationRun.findUnique({
      where: { id: bulkRunId },
      select: { status: true, completedCount: true, failedCount: true, totalSubsections: true },
    })
    if (!run || run.status !== 'RUNNING') {
      return NextResponse.json({ ok: true, message: 'Run not active, nothing to do.' })
    }
    if (run.completedCount + run.failedCount >= run.totalSubsections) {
      return NextResponse.json({ ok: true, message: 'Run already complete.' })
    }

    const baseUrl = new URL(request.url).origin
    after(async () => {
      await runBulkGenerationChunk(bulkRunId, baseUrl)
    })

    return NextResponse.json({
      ok: true,
      message: 'Continue scheduled.',
    })
  } catch (error) {
    console.error('POST /api/editorial/bulk-generate/continue error', error)
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
