'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { DailyDoseContentBlock, DailyDoseQuizQuestion } from '@/lib/daily-dose/types'

interface DailyDoseSessionClientProps {
  surgeryId: string
}

type CoreCard = {
  id: string
  title: string
  topicName?: string
  contentBlocks: DailyDoseContentBlock[]
  sources: Array<{ title: string; org: string; url: string; publishedDate?: string }>
  reviewByDate?: string | null
}

type SessionStartResponse = {
  sessionId: string
  coreCard: CoreCard
  quizQuestions: DailyDoseQuizQuestion[]
  resumed?: boolean
}

type QuestionResult = {
  key: string
  cardId: string
  correct: boolean
  correctAnswer: string
  rationale: string
}

export default function DailyDoseSessionClient({ surgeryId }: DailyDoseSessionClientProps) {
  const [session, setSession] = useState<SessionStartResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
  const [questionResults, setQuestionResults] = useState<Record<string, QuestionResult>>({})
  const [quizIndex, setQuizIndex] = useState(0)
  const [quizFeedbackKey, setQuizFeedbackKey] = useState<string | null>(null)
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

  const embeddedQuestionKeys = useMemo(() => {
    if (!session?.coreCard?.contentBlocks) return []
    return session.coreCard.contentBlocks
      .map((block, index) => (block.type === 'question' ? `embed:${session.coreCard.id}:${index}` : null))
      .filter((key): key is string => Boolean(key))
  }, [session])

  const allEmbeddedAnswered = embeddedQuestionKeys.every((key) => Boolean(questionResults[key]))

  const handleAnswer = async (params: {
    cardId: string
    blockIndex: number
    answer: string
    keyPrefix: 'embed' | 'quiz'
  }) => {
    const key = `${params.keyPrefix}:${params.cardId}:${params.blockIndex}`
    if (questionResults[key]) return

    const response = await fetch('/api/daily-dose/session/submit-answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        surgeryId,
        cardId: params.cardId,
        blockIndex: params.blockIndex,
        answer: params.answer,
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

    setQuestionResults((prev) => ({
      ...prev,
      [key]: {
        key,
        cardId: params.cardId,
        correct: result.correct,
        correctAnswer: result.correctAnswer,
        rationale: result.rationale,
      },
    }))
  }

  const handleQuizAnswer = async (question: DailyDoseQuizQuestion, answer: string) => {
    try {
      setQuizFeedbackKey(null)
      await handleAnswer({
        cardId: question.cardId,
        blockIndex: question.blockIndex,
        answer,
        keyPrefix: 'quiz',
      })
      setQuizFeedbackKey(`quiz:${question.cardId}:${question.blockIndex}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to record answer')
    }
  }

  const handleComplete = async () => {
    if (!session) return
    setSaving(true)
    setError(null)

    try {
      const cardResultsMap = new Map<string, { correctCount: number; questionCount: number }>()
      Object.values(questionResults).forEach((result) => {
        const entry = cardResultsMap.get(result.cardId) ?? { correctCount: 0, questionCount: 0 }
        entry.questionCount += 1
        if (result.correct) entry.correctCount += 1
        cardResultsMap.set(result.cardId, entry)
      })

      let cardResults = Array.from(cardResultsMap.entries()).map(([cardId, counts]) => ({
        cardId,
        correctCount: counts.correctCount,
        questionCount: counts.questionCount,
      }))

      if (cardResults.length === 0) {
        cardResults = [{ cardId: session.coreCard.id, correctCount: 0, questionCount: 0 }]
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
          cardId: session.coreCard.id,
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

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6" aria-live="polite">
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
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-center">
        <h1 className="text-2xl font-bold text-nhs-dark-blue">Session complete</h1>
        <p className="mt-3 text-slate-600">
          You earned <strong>{summary.xpEarned} XP</strong> and answered {summary.correctCount} of{' '}
          {summary.questionsAttempted} questions correctly.
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <Link
            href={`/daily-dose/history?surgery=${surgeryId}`}
            className="inline-flex items-center rounded-md border border-nhs-blue px-4 py-2 text-sm font-semibold text-nhs-blue hover:bg-nhs-blue hover:text-white"
          >
            View history
          </Link>
          <Link
            href={`/daily-dose?surgery=${surgeryId}`}
            className="inline-flex items-center rounded-md bg-nhs-blue px-4 py-2 text-sm font-semibold text-white hover:bg-nhs-dark-blue"
          >
            Back to Daily Dose
          </Link>
        </div>
      </div>
    )
  }

  const quizQuestion = session.quizQuestions[quizIndex]

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold text-nhs-dark-blue">{session.coreCard.title}</h1>
            {session.coreCard.topicName && (
              <p className="text-sm text-slate-500">{session.coreCard.topicName}</p>
            )}
          </div>
          {session.resumed && (
            <span className="rounded-full bg-nhs-light-blue px-3 py-1 text-xs font-semibold text-nhs-dark-blue">
              Resuming session
            </span>
          )}
        </div>

        <div className="mt-4 space-y-4">
          {session.coreCard.contentBlocks.map((block, index) => {
            if (block.type === 'paragraph') {
              return (
                <p key={`p-${index}`} className="text-slate-700">
                  {block.text}
                </p>
              )
            }

            if (block.type === 'question') {
              const key = `embed:${session.coreCard.id}:${index}`
              const result = questionResults[key]
              return (
                <div key={key} className="rounded-md border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-700">{block.prompt}</p>
                  <div className="mt-2 space-y-2">
                    {block.options.map((option) => (
                      <button
                        type="button"
                        key={option}
                        onClick={() =>
                          handleAnswer({
                            cardId: session.coreCard.id,
                            blockIndex: index,
                            answer: option,
                            keyPrefix: 'embed',
                          }).catch((err) =>
                            setError(err instanceof Error ? err.message : 'Unable to record answer')
                          )
                        }
                        disabled={Boolean(result)}
                        className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                          result
                            ? option === result.correctAnswer
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                              : 'border-slate-200 text-slate-500'
                            : 'border-slate-200 hover:border-nhs-blue'
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                  {result && (
                    <p className={`mt-3 text-sm ${result.correct ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {result.correct ? 'Correct.' : 'Not quite.'} {result.rationale}
                    </p>
                  )}
                </div>
              )
            }

            if (block.type === 'reveal') {
              return (
                <div key={`r-${index}`} className="rounded-md border border-slate-200 bg-white p-4">
                  {allEmbeddedAnswered ? (
                    <p className="text-slate-700">{block.text}</p>
                  ) : (
                    <p className="text-sm text-slate-500">Answer the questions above to reveal this explanation.</p>
                  )}
                </div>
              )
            }

            return null
          })}
        </div>

        <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <p className="font-semibold text-slate-700">Sources</p>
          <ul className="mt-2 space-y-1">
            {session.coreCard.sources.map((source) => (
              <li key={source.url}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-nhs-blue underline-offset-2 hover:underline"
                >
                  {source.title} ({source.org})
                </a>
                {source.publishedDate && <span className="text-slate-500"> — {source.publishedDate}</span>}
              </li>
            ))}
          </ul>
          {session.coreCard.reviewByDate && (
            <p className="mt-2 text-xs text-slate-500">Review due: {session.coreCard.reviewByDate}</p>
          )}
          <div className="mt-3">
            <button
              type="button"
              onClick={handleFlag}
              className="text-xs font-semibold text-nhs-blue hover:underline"
            >
              Flag this card for review
            </button>
            {flagMessage && <p className="mt-2 text-xs text-slate-500">{flagMessage}</p>}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-nhs-dark-blue">Quick quiz</h2>
          {session.quizQuestions.length > 0 && (
            <span className="text-sm text-slate-500">
              Question {quizIndex + 1} of {session.quizQuestions.length}
            </span>
          )}
        </div>

        {quizQuestion ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm font-semibold text-slate-700">{quizQuestion.prompt}</p>
            <div className="space-y-2">
              {quizQuestion.options.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => handleQuizAnswer(quizQuestion, option)}
                  disabled={Boolean(questionResults[`quiz:${quizQuestion.cardId}:${quizQuestion.blockIndex}`])}
                  className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                    questionResults[`quiz:${quizQuestion.cardId}:${quizQuestion.blockIndex}`]
                      ? option === quizQuestion.correctAnswer
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 text-slate-500'
                      : 'border-slate-200 hover:border-nhs-blue'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>

            {quizFeedbackKey && questionResults[quizFeedbackKey] && (
              <p className={`text-sm ${questionResults[quizFeedbackKey].correct ? 'text-emerald-700' : 'text-amber-700'}`}>
                {questionResults[quizFeedbackKey].correct ? 'Correct.' : 'Not quite.'}{' '}
                {questionResults[quizFeedbackKey].rationale}
              </p>
            )}

            <div className="flex justify-between pt-2">
              <button
                type="button"
                disabled={quizIndex === 0}
                onClick={() => {
                  setQuizFeedbackKey(null)
                  setQuizIndex((index) => Math.max(index - 1, 0))
                }}
                className="text-sm text-slate-500 hover:text-nhs-dark-blue disabled:cursor-not-allowed"
              >
                Back
              </button>
              {quizIndex < session.quizQuestions.length - 1 ? (
                <button
                  type="button"
                  disabled={!questionResults[`quiz:${quizQuestion.cardId}:${quizQuestion.blockIndex}`]}
                  onClick={() => {
                    setQuizFeedbackKey(null)
                    setQuizIndex((index) => Math.min(index + 1, session.quizQuestions.length - 1))
                  }}
                  className="rounded-md bg-nhs-blue px-4 py-2 text-sm font-semibold text-white hover:bg-nhs-dark-blue disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Next question
                </button>
              ) : (
                <button
                  type="button"
                  disabled={saving || !questionResults[`quiz:${quizQuestion.cardId}:${quizQuestion.blockIndex}`]}
                  onClick={handleComplete}
                  className="rounded-md bg-nhs-blue px-4 py-2 text-sm font-semibold text-white hover:bg-nhs-dark-blue disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {saving ? 'Saving…' : 'Finish session'}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            <p>No quiz questions available right now.</p>
            <button
              type="button"
              disabled={saving || !allEmbeddedAnswered}
              onClick={handleComplete}
              className="rounded-md bg-nhs-blue px-4 py-2 text-sm font-semibold text-white hover:bg-nhs-dark-blue disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? 'Saving…' : 'Finish session'}
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
