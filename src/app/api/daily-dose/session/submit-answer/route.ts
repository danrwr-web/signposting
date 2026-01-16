import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/rbac'
import { resolveSurgeryIdForUser } from '@/lib/daily-dose/access'
import { DailyDoseSubmitAnswerZ } from '@/lib/daily-dose/schemas'
import { z } from 'zod'

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = DailyDoseSubmitAnswerZ.parse(body)
    const surgeryId = resolveSurgeryIdForUser({ requestedId: parsed.surgeryId, user })
    if (!surgeryId) {
      return NextResponse.json({ error: 'Surgery access required' }, { status: 403 })
    }

    const card = await prisma.dailyDoseCard.findFirst({
      where: {
        id: parsed.cardId,
        OR: [{ surgeryId }, { surgeryId: null }],
      },
      select: { contentBlocks: true },
    })

    if (!card || !Array.isArray(card.contentBlocks)) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 })
    }

    const block = (card.contentBlocks as Array<{ type?: string }>)[parsed.blockIndex]
    if (!block || block.type !== 'question') {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }

    const question = block as {
      correctAnswer?: string
      rationale?: string
    }
    const correctAnswer = question.correctAnswer ?? ''
    const isCorrect = correctAnswer.trim().toLowerCase() === parsed.answer.trim().toLowerCase()

    return NextResponse.json({
      correct: isCorrect,
      correctAnswer,
      rationale: question.rationale ?? '',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    console.error('POST /api/daily-dose/session/submit-answer error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
