'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { DailyDoseContentBlock, DailyDoseQuizQuestion } from '@/lib/daily-dose/types'
import { getQuestionId } from '@/lib/daily-dose/questionId'
import LearningCardOptionCard from '@/components/daily-dose/LearningCardOptionCard'
import PhoneFrame from '@/components/daily-dose/PhoneFrame'

interface DailyDoseSessionClientProps {
  surgeryId: string
}

type CoreCard = {
  id: string
  title: string
  topicName?: string
  roleScope?: string[]
  contentBlocks: DailyDoseContentBlock[]
  interactions?: Array<{
    type: 'mcq' | 'true_false' | 'choose_action'
    question: string
    options: string[]
    correctIndex: number
    explanation: string
  }>
  sources: Array<{ title: string; org?: string; publisher?: string; url: string; publishedDate?: string }>
  reviewByDate?: string | null
}

type SessionStartResponse = {
  sessionId: string
  coreCard?: CoreCard // Legacy field for backward compatibility
  sessionCards?: CoreCard[] // New: multiple cards for learning block
  warmupQuestions?: DailyDoseQuizQuestion[] // New: 0-2 warm-up recall questions
  quizQuestions: DailyDoseQuizQuestion[]
  resumed?: boolean
}

type QuestionResult = {
  key: string
  cardId: string
  questionId?: string
  correct: boolean
  correctAnswer: string
  rationale: string
}

type Step =
  | { type: 'intro'; title: string; headerText: string; cardProgress?: { current: number; total: number } }
  | {
      type: 'content'
      block: DailyDoseContentBlock
      index: number
      cardProgress?: { current: number; total: number }
    }
  | {
      type: 'question'
      prompt: string
      options: string[]
      key: string
      blockIndex: number
      source: 'interaction' | 'content'
      cardProgress?: { current: number; total: number }
      questionId?: string
    }
  | {
      type: 'feedback'
      prompt: string
      correct: boolean
      rationale: string
      key: string
    }
  | {
      type: 'reveal'
      text: string
    }
  | {
      type: 'sources'
      card: CoreCard
      cardProgress?: { current: number; total: number }
    }
  | {
      type: 'quiz'
      question: DailyDoseQuizQuestion
      quizProgress?: { current: number; total: number }
      isWarmup?: boolean
      questionId?: string
    }

export default function DailyDoseSessionClient({ surgeryId }: DailyDoseSessionClientProps) {
  const [session, setSession] = useState<SessionStartResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
  const [questionResults, setQuestionResults] = useState<Record<string, QuestionResult>>({})
  const [stepIndex, setStepIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  const [flagMessage, setFlagMessage] = useState<string | null>(null)
  const [summary, setSummary] = useState<{
    xpEarned: number
    correctCount: number
    questionsAttempted: number
  } | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)

    fetch('/api/daily-dose/session/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ surgeryId }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}))
          if (payload?.error === 'Daily Dose onboarding required') {
            setNeedsOnboarding(true)
          }
          throw new Error(payload?.error || 'Unable to start session')
        }
        const payload = (await res.json()) as SessionStartResponse
        if (!active) return
        setSession(payload)
      })
      .catch((err) => {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Something went wrong')
      })
      .finally(() => {
        if (!active) return
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [surgeryId])

  const steps = useMemo((): Step[] => {
    if (!session) return []
    const out: Step[] = []

    // Support both old format (coreCard) and new format (sessionCards)
    const cards = session.sessionCards || (session.coreCard ? [session.coreCard] : [])

    if (cards.length === 0) return []

    // 1. Warm-up recall questions (0-2 questions at start)
    if (session.warmupQuestions && session.warmupQuestions.length > 0) {
      const totalWarmup = session.warmupQuestions.length
      for (let i = 0; i < session.warmupQuestions.length; i++) {
        const question = session.warmupQuestions[i]
        out.push({
          type: 'quiz',
          question,
          quizProgress: { current: i + 1, total: totalWarmup },
          isWarmup: true,
          questionId: question.questionId,
        })
      }
    }

    // 2. Learning block: show 3-5 cards sequentially
    const totalCards = cards.length
    for (let cardIndex = 0; cardIndex < cards.length; cardIndex++) {
      const card = cards[cardIndex]
      const roleLabel = card.roleScope?.[0] ?? 'Staff'
      const topicLabel = card.topicName ?? ''
      const headerText = topicLabel ? `${roleLabel} · ${topicLabel}` : roleLabel
      const cardProgress = { current: cardIndex + 1, total: totalCards }

      // Card intro
      out.push({ type: 'intro', title: card.title, headerText, cardProgress })

      // Embedded interactions (questions within the card)
      const interactions = card.interactions ?? []
      for (let i = 0; i < interactions.length; i++) {
        const interaction = interactions[i]
        const key = `embed:${card.id}:interaction:${i}`
        // Generate questionId for tracking
        const questionId = getQuestionId({
          prompt: interaction.question,
          options: interaction.options,
          correctAnswer: interaction.options[interaction.correctIndex ?? 0] ?? interaction.options[0] ?? '',
          questionType: 'multiple-choice',
        })
        out.push({
          type: 'question',
          prompt: interaction.question,
          options: interaction.options,
          key,
          blockIndex: i,
          source: 'interaction',
          cardProgress,
          questionId,
        })
      }

      // Content blocks
      for (let i = 0; i < card.contentBlocks.length; i++) {
        const block = card.contentBlocks[i]
        if (block.type === 'paragraph' || block.type === 'text' || block.type === 'callout' || block.type === 'steps' || block.type === 'do-dont') {
          out.push({ type: 'content', block, index: i, cardProgress })
        } else if (block.type === 'question') {
          const key = `embed:${card.id}:content:${i}`
          // Generate questionId for tracking
          const questionId = getQuestionId({
            prompt: block.prompt,
            options: block.options,
            correctAnswer: block.correctAnswer,
            questionType: block.questionType,
          })
          out.push({
            type: 'question',
            prompt: block.prompt,
            options: block.options,
            key,
            blockIndex: i,
            source: 'content',
            cardProgress,
            questionId,
          })
        } else if (block.type === 'reveal') {
          out.push({ type: 'reveal', text: block.text })
        }
      }

      // Sources for this card
      out.push({ type: 'sources', card, cardProgress })
    }

    // 3. Session-end quiz
    if (session.quizQuestions && session.quizQuestions.length > 0) {
      const totalQuizQuestions = session.quizQuestions.length
      for (let i = 0; i < session.quizQuestions.length; i++) {
        const question = session.quizQuestions[i]
        out.push({
          type: 'quiz',
          question,
          quizProgress: { current: i + 1, total: totalQuizQuestions },
          questionId: question.questionId,
        })
      }
    }

    return out
  }, [session])

  const handleAnswer = async (params: {
    cardId: string
    blockIndex: number
    answer: string
    keyPrefix: 'embed' | 'quiz'
    source: 'content' | 'interaction'
  }) => {
    const key = `${params.keyPrefix}:${params.cardId}:${params.source}:${params.blockIndex}`
    if (questionResults[key]) return

    const response = await fetch('/api/daily-dose/session/submit-answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        surgeryId,
        cardId: params.cardId,
        blockIndex: params.blockIndex,
        answer: params.answer,
        source: params.source,
      }),
    })

    if (!response.ok) {
      throw new Error('Unable to record answer')
    }

    const result = (await response.json()) as {
      correct: boolean
      correctAnswer: string
      rationale: string
    }

    // Find the questionId from the current step
    const currentQuestionStep = steps.find((s) => s.type === 'question' && s.key === key)
    const questionId = currentQuestionStep?.type === 'question' ? currentQuestionStep.questionId : undefined

    setQuestionResults((prev) => ({
      ...prev,
      [key]: {
        key,
        cardId: params.cardId,
        questionId,
        correct: result.correct,
        correctAnswer: result.correctAnswer,
        rationale: result.rationale,
      },
    }))
  }

  const handleQuizAnswer = async (question: DailyDoseQuizQuestion, answer: string) => {
    try {
      const quizKey = `quiz:${question.cardId}:${question.source}:${question.blockIndex}`
      // Find the questionId from the current step
      const currentQuizStep = steps.find((s) => s.type === 'quiz' && s.question === question)
      const questionId = currentQuizStep?.type === 'quiz' ? (currentQuizStep.questionId ?? question.questionId) : question.questionId

      await handleAnswer({
        cardId: question.cardId,
        blockIndex: question.blockIndex,
        answer,
        keyPrefix: 'quiz',
        source: question.source,
      })

      // Update questionId in the result if it wasn't set
      if (questionId) {
        setQuestionResults((prev) => {
          const existing = prev[quizKey]
          if (existing && !existing.questionId) {
            return {
              ...prev,
              [quizKey]: {
                ...existing,
                questionId,
              },
            }
          }
          return prev
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to record answer')
    }
  }

  const handleComplete = async () => {
    if (!session) return
    setSaving(true)
    setError(null)

    try {
      const cardResultsMap = new Map<
        string,
        { correctCount: number; questionCount: number; questionIds: string[] }
      >()
      Object.values(questionResults).forEach((result) => {
        const entry = cardResultsMap.get(result.cardId) ?? {
          correctCount: 0,
          questionCount: 0,
          questionIds: [],
        }
        entry.questionCount += 1
        if (result.correct) entry.correctCount += 1
        if (result.questionId && !entry.questionIds.includes(result.questionId)) {
          entry.questionIds.push(result.questionId)
        }
        cardResultsMap.set(result.cardId, entry)
      })

      let cardResults = Array.from(cardResultsMap.entries()).map(([cardId, counts]) => ({
        cardId,
        correctCount: counts.correctCount,
        questionCount: counts.questionCount,
        questionIds: counts.questionIds.length > 0 ? counts.questionIds : undefined,
      }))

      if (cardResults.length === 0) {
        const fallbackCardId = session.sessionCards?.[0]?.id ?? session.coreCard?.id
        if (fallbackCardId) {
          cardResults = [{ cardId: fallbackCardId, correctCount: 0, questionCount: 0 }]
        }
      }

      const response = await fetch('/api/daily-dose/session/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.sessionId,
          surgeryId,
          cardResults,
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload?.error || 'Unable to complete session')
      }

      const payload = (await response.json()) as {
        xpEarned: number
        correctCount: number
        questionsAttempted: number
      }
      setSummary(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  const handleFlag = async () => {
    if (!session) return
    setFlagMessage(null)
    try {
      const response = await fetch('/api/daily-dose/flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surgeryId,
          cardId: currentCard?.id || session.sessionCards?.[0]?.id || session.coreCard?.id || '',
          reason: 'Content needs review',
          freeText: 'Flagged during Daily Dose session.',
        }),
      })
      if (!response.ok) {
        throw new Error('Unable to flag content')
      }
      setFlagMessage('Thanks — we have sent this to the editorial queue.')
    } catch (err) {
      setFlagMessage(err instanceof Error ? err.message : 'Unable to flag content')
    }
  }

  const goNext = () => {
    if (stepIndex < steps.length - 1) {
      setStepIndex((i) => i + 1)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[calc(100dvh-140px)] items-center justify-center" aria-live="polite">
        <p className="text-slate-600">Preparing your session…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6" role="alert">
        <h1 className="text-lg font-semibold text-red-700">We could not load your session</h1>
        <p className="mt-2 text-sm text-red-700">{error}</p>
        {needsOnboarding && (
          <Link
            href={`/daily-dose/onboarding?surgery=${surgeryId}`}
            className="mt-4 inline-flex items-center rounded-md bg-nhs-blue px-4 py-2 text-sm font-semibold text-white hover:bg-nhs-dark-blue"
          >
            Go to onboarding
          </Link>
        )}
      </div>
    )
  }

  if (!session) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <p className="text-slate-600">No session is available yet.</p>
      </div>
    )
  }

  if (summary) {
    return (
      <PhoneFrame>
        <div className="flex h-full flex-col items-center justify-center p-6 text-center">
          <h1 className="text-2xl font-bold text-nhs-dark-blue">Session complete</h1>
          <p className="mt-3 text-slate-600">
            You earned <strong>{summary.xpEarned} XP</strong> and answered {summary.correctCount} of{' '}
            {summary.questionsAttempted} questions correctly.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <Link
              href={`/daily-dose/history?surgery=${surgeryId}`}
              className="inline-flex items-center justify-center rounded-lg border border-nhs-blue px-6 py-3 text-sm font-semibold text-nhs-blue hover:bg-nhs-blue hover:text-white"
            >
              View history
            </Link>
            <Link
              href={`/daily-dose?surgery=${surgeryId}`}
              className="inline-flex items-center justify-center rounded-lg bg-nhs-blue px-6 py-3 text-sm font-semibold text-white hover:bg-nhs-dark-blue"
            >
              Back to Daily Dose
            </Link>
          </div>
        </div>
      </PhoneFrame>
    )
  }

  // Get current step
  const currentStep = useMemo(() => {
    return steps[Math.min(stepIndex, steps.length - 1)]
  }, [steps, stepIndex])

  // Get current card from session (support both old and new format)
  const currentCard = useMemo(() => {
    const cards = session.sessionCards || (session.coreCard ? [session.coreCard] : [])
    if (cards.length === 0) return null
    
    // Find card for current step by looking backwards for intro step
    if (currentStep && currentStep.type === 'intro' && 'card' in currentStep && currentStep.card) {
      return currentStep.card
    }
    if (currentStep && currentStep.type === 'sources' && 'card' in currentStep) {
      return currentStep.card
    }
    
    // Look backwards for intro step
    for (let i = stepIndex; i >= 0; i--) {
      const step = steps[i]
      if (step && step.type === 'intro' && 'card' in step && step.card) {
        return step.card
      }
    }
    
    // Fallback to first card
    return cards[0] || null
  }, [session, steps, stepIndex, currentStep])

  const allEmbeddedAnswered = currentCard
    ? (currentCard.interactions ?? []).length + currentCard.contentBlocks.filter((b) => b.type === 'question').length ===
        Object.keys(questionResults).filter((k) => k.startsWith(`embed:${currentCard.id}:`)).length
    : false

  const renderStep = () => {
    if (!currentStep) return null

    switch (currentStep.type) {
      case 'intro': {
        return (
          <div className="flex h-full flex-col justify-between p-6">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs text-slate-500">{currentStep.headerText}</p>
                {currentStep.cardProgress && (
                  <p className="text-xs text-slate-500">
                    Card {currentStep.cardProgress.current} of {currentStep.cardProgress.total}
                  </p>
                )}
              </div>
              <h1 className="mt-2 text-2xl font-bold leading-tight text-nhs-dark-blue">{currentStep.title}</h1>
            </div>
            <button
              type="button"
              onClick={goNext}
              className="w-full rounded-xl bg-nhs-blue py-4 text-base font-semibold text-white hover:bg-nhs-dark-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-nhs-blue focus-visible:ring-offset-2"
            >
              Continue
            </button>
          </div>
        )
      }

      case 'content': {
        const block = currentStep.block
        let content: React.ReactNode
        if (block.type === 'paragraph' || block.type === 'text' || block.type === 'callout') {
          content = <p className="text-slate-700">{block.text}</p>
        } else if (block.type === 'steps' || block.type === 'do-dont') {
          content = (
            <ul className="space-y-2 text-slate-700">
              {block.items.map((item, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-nhs-blue">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )
        } else {
          content = null
        }
        return (
          <div className="flex h-full flex-col justify-between p-6">
            <div className={`rounded-lg border p-4 ${block.type === 'callout' ? 'border-amber-200 bg-amber-50/50' : 'border-slate-200 bg-white'}`}>
              {content}
            </div>
            <button
              type="button"
              onClick={goNext}
              className="mt-4 w-full rounded-xl bg-nhs-blue py-4 text-base font-semibold text-white hover:bg-nhs-dark-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-nhs-blue focus-visible:ring-offset-2"
            >
              Continue
            </button>
          </div>
        )
      }

      case 'question': {
        const result = questionResults[currentStep.key]
        if (result) {
          return (
            <div className="flex h-full flex-col justify-between p-6">
              <div>
                <p className="text-sm font-semibold text-slate-700">{currentStep.prompt}</p>
                <div className="mt-4 rounded-lg bg-slate-100 p-4">
                  <p className="text-sm text-slate-600">
                    {result.correct ? 'Correct.' : 'Not quite.'} {result.rationale}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={goNext}
                className="mt-4 w-full rounded-xl bg-nhs-blue py-4 text-base font-semibold text-white hover:bg-nhs-dark-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-nhs-blue focus-visible:ring-offset-2"
              >
                Continue
              </button>
            </div>
          )
        }
        return (
          <div className="flex h-full flex-col justify-between p-6">
            <div>
              <p className="text-sm font-semibold text-slate-700">{currentStep.prompt}</p>
              <div className="mt-4 space-y-2">
                {currentStep.options.map((option) => (
                  <LearningCardOptionCard
                    key={option}
                    label={option}
                    onClick={async () => {
                      await handleAnswer({
                        cardId: card.id,
                        blockIndex: currentStep.blockIndex,
                        answer: option,
                        keyPrefix: 'embed',
                        source: currentStep.source,
                      }).catch((err) => setError(err instanceof Error ? err.message : 'Unable to record answer'))
                    }}
                    disabled={false}
                  />
                ))}
              </div>
            </div>
          </div>
        )
      }

      case 'reveal': {
        return (
          <div className="flex h-full flex-col justify-between p-6">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              {allEmbeddedAnswered ? (
                <p className="text-slate-700">{currentStep.text}</p>
              ) : (
                <p className="text-slate-500">Answer the questions above to reveal this explanation.</p>
              )}
            </div>
            <button
              type="button"
              onClick={goNext}
              className="mt-4 w-full rounded-xl bg-nhs-blue py-4 text-base font-semibold text-white hover:bg-nhs-dark-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-nhs-blue focus-visible:ring-offset-2"
            >
              Continue
            </button>
          </div>
        )
      }

      case 'sources': {
        const c = currentStep.card
        const hasQuiz = session.quizQuestions.length > 0
        return (
          <div className="flex h-full flex-col justify-between p-6">
            <div className="space-y-3 overflow-hidden">
              <p className="font-semibold text-slate-700">Sources</p>
              <ul className="space-y-1 text-sm text-slate-600">
                {c.sources.map((source) => (
                  <li key={source.url}>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-nhs-blue underline-offset-2 hover:underline"
                    >
                      {source.title} ({source.org ?? source.publisher ?? 'UK source'})
                    </a>
                  </li>
                ))}
              </ul>
              {c.reviewByDate && <p className="text-xs text-slate-500">Review due: {c.reviewByDate}</p>}
              <button
                type="button"
                onClick={handleFlag}
                className="text-xs font-semibold text-nhs-blue hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-nhs-blue rounded"
              >
                Flag this card for review
              </button>
              {flagMessage && <p className="text-xs text-slate-500">{flagMessage}</p>}
            </div>
            {hasQuiz ? (
              <button
                type="button"
                onClick={goNext}
                className="mt-4 w-full rounded-xl bg-nhs-blue py-4 text-base font-semibold text-white hover:bg-nhs-dark-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-nhs-blue focus-visible:ring-offset-2"
              >
                Continue to quiz
              </button>
            ) : (
              <button
                type="button"
                disabled={saving}
                onClick={handleComplete}
                className="mt-4 w-full rounded-xl bg-nhs-blue py-4 text-base font-semibold text-white hover:bg-nhs-dark-blue disabled:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-nhs-blue focus-visible:ring-offset-2"
              >
                {saving ? 'Saving…' : 'Finish session'}
              </button>
            )}
          </div>
        )
      }

      case 'quiz': {
        const q = currentStep.question
        const quizKey = `quiz:${q.cardId}:${q.source}:${q.blockIndex}`
        const result = questionResults[quizKey]
        const quizStart = steps.findIndex((s) => s.type === 'quiz')
        const currentQuizIndex = stepIndex - quizStart
        if (result) {
          return (
            <div className="flex h-full flex-col justify-between p-6">
              <div>
              {currentStep.quizProgress && (
                <p className="mb-2 text-xs text-slate-500">
                  {currentStep.isWarmup ? 'Warm-up' : 'Quiz'} Q {currentStep.quizProgress.current} of {currentStep.quizProgress.total}
                </p>
              )}
                <p className="text-sm font-semibold text-slate-700">{q.prompt}</p>
                <div className="mt-4 rounded-lg bg-slate-100 p-4">
                  <p className="text-sm text-slate-600">
                    {result.correct ? 'Correct.' : 'Not quite.'} {result.rationale}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (currentQuizIndex > 0) {
                      setStepIndex(quizStart + currentQuizIndex - 1)
                    } else {
                      setStepIndex(steps.findIndex((s) => s.type === 'sources'))
                    }
                  }}
                  className="flex-1 rounded-xl border border-slate-300 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-nhs-blue"
                >
                  Back
                </button>
                {currentQuizIndex < session.quizQuestions.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setStepIndex((i) => i + 1)}
                    className="flex-1 rounded-xl bg-nhs-blue py-3 text-sm font-semibold text-white hover:bg-nhs-dark-blue focus:outline-none focus-visible:ring-2 focus-visible:ring-nhs-blue"
                  >
                    Next question
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleComplete}
                    className="flex-1 rounded-xl bg-nhs-blue py-3 text-sm font-semibold text-white hover:bg-nhs-dark-blue disabled:opacity-70"
                  >
                    {saving ? 'Saving…' : 'Finish session'}
                  </button>
                )}
              </div>
            </div>
          )
        }
        return (
          <div className="flex h-full flex-col justify-between p-6">
            <div>
              {currentStep.quizProgress ? (
                <p className="text-xs text-slate-500">
                  {currentStep.isWarmup ? 'Warm-up' : 'Quiz'} Q {currentStep.quizProgress.current} of {currentStep.quizProgress.total}
                </p>
              ) : (
                <p className="text-xs text-slate-500">
                  Question {currentQuizIndex + 1} of {session.quizQuestions.length}
                </p>
              )}
              <p className="mt-2 text-sm font-semibold text-slate-700">{q.prompt}</p>
              <div className="mt-4 space-y-2">
                {q.options.map((option) => (
                  <LearningCardOptionCard
                    key={option}
                    label={option}
                    onClick={() => handleQuizAnswer(q, option)}
                    disabled={false}
                  />
                ))}
              </div>
            </div>
          </div>
        )
      }

      default:
        return null
    }
  }

  const currentStep = steps[Math.min(stepIndex, steps.length - 1)]

  return (
    <PhoneFrame>
      {currentStep && (
        <div key={stepIndex} className="flex h-full flex-col">
          {renderStep()}
        </div>
      )}
    </PhoneFrame>
  )
}
