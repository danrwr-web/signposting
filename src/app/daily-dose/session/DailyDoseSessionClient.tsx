'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { DailyDoseContentBlock, DailyDoseQuizQuestion } from '@/lib/daily-dose/types'
import LearningCardLayout from '@/components/daily-dose/LearningCardLayout'
import LearningCardOptionCard from '@/components/daily-dose/LearningCardOptionCard'
import TruncateWithMore from '@/components/daily-dose/TruncateWithMore'

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
    if (!session?.coreCard) return []
    const contentKeys = session.coreCard.contentBlocks
      .map((block, index) => (block.type === 'question' ? `embed:${session.coreCard.id}:content:${index}` : null))
      .filter((key): key is string => Boolean(key))
    const interactionKeys = (session.coreCard.interactions ?? []).map(
      (_, index) => `embed:${session.coreCard.id}:interaction:${index}`
    )
    return [...contentKeys, ...interactionKeys]
  }, [session])

  const allEmbeddedAnswered = embeddedQuestionKeys.every((key) => Boolean(questionResults[key]))

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
        source: question.source,
      })
      setQuizFeedbackKey(`quiz:${question.cardId}:${question.source}:${question.blockIndex}`)
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
  const card = session.coreCard
  const roleLabel = card.roleScope?.[0] ?? 'Staff'
  const topicLabel = card.topicName ?? ''
  const headerText = topicLabel ? `${roleLabel} · ${topicLabel}` : roleLabel

  const renderInteractionBlock = () => (
    <div className="space-y-4">
      {(card.interactions ?? []).map((interaction, index) => {
        const key = `embed:${card.id}:interaction:${index}`
        const result = questionResults[key]
        return (
          <div key={key} className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
            <p className="mb-3 text-sm font-semibold text-slate-700">{interaction.question}</p>
            <div className="space-y-2">
              {interaction.options.map((option) => (
                <LearningCardOptionCard
                  key={option}
                  label={option}
                  onClick={() =>
                    handleAnswer({
                      cardId: card.id,
                      blockIndex: index,
                      answer: option,
                      keyPrefix: 'embed',
                      source: 'interaction',
                    }).catch((err) =>
                      setError(err instanceof Error ? err.message : 'Unable to record answer')
                    )
                  }
                  disabled={Boolean(result)}
                  selected={result ? option === result.correctAnswer : undefined}
                  correct={result ? option === result.correctAnswer : undefined}
                />
              ))}
            </div>
            {result && (
              <div className="mt-3 rounded-md bg-slate-100 px-3 py-2">
                <p className="text-sm text-slate-600">
                  {result.correct ? 'Correct.' : 'Not quite.'}{' '}
                  <TruncateWithMore
                    text={result.rationale}
                    title="Explanation"
                    maxLength={100}
                    inline
                  />
                </p>
              </div>
            )}
          </div>
        )
      })}
      {card.contentBlocks.map((block, index) => {
        if (block.type === 'paragraph') {
          return (
            <p key={`p-${index}`} className="text-sm text-slate-700">
              {block.text}
            </p>
          )
        }
        if (block.type === 'text' || block.type === 'callout') {
          return (
            <div
              key={`t-${index}`}
              className={`rounded-lg border p-3 text-sm text-slate-700 ${
                block.type === 'callout' ? 'border-amber-200 bg-amber-50/50' : 'border-slate-200 bg-white'
              }`}
            >
              {block.text}
            </div>
          )
        }
        if (block.type === 'steps' || block.type === 'do-dont') {
          return (
            <div key={`list-${index}`} className="rounded-lg border border-slate-200 bg-white p-3">
              <ul className="space-y-1.5 text-sm text-slate-700">
                {block.items.map((item, itemIndex) => (
                  <li key={`${index}-${itemIndex}`} className="flex gap-2">
                    <span className="text-nhs-blue">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )
        }
        if (block.type === 'question') {
          const key = `embed:${card.id}:content:${index}`
          const result = questionResults[key]
          return (
            <div key={key} className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
              <p className="mb-3 text-sm font-semibold text-slate-700">{block.prompt}</p>
              <div className="space-y-2">
                {block.options.map((option) => (
                  <LearningCardOptionCard
                    key={option}
                    label={option}
                    onClick={() =>
                      handleAnswer({
                        cardId: card.id,
                        blockIndex: index,
                        answer: option,
                        keyPrefix: 'embed',
                        source: 'content',
                      }).catch((err) =>
                        setError(err instanceof Error ? err.message : 'Unable to record answer')
                      )
                    }
                    disabled={Boolean(result)}
                    selected={result ? option === result.correctAnswer : undefined}
                    correct={result ? option === result.correctAnswer : undefined}
                  />
                ))}
              </div>
              {result && (
                <div className="mt-3 rounded-md bg-slate-100 px-3 py-2">
                  <p className="text-sm text-slate-600">
                    {result.correct ? 'Correct.' : 'Not quite.'}{' '}
                    <TruncateWithMore
                      text={result.rationale}
                      title="Explanation"
                      maxLength={100}
                      className="inline"
                    />
                  </p>
                </div>
              )}
            </div>
          )
        }
        if (block.type === 'reveal') {
          return (
            <div key={`r-${index}`} className="rounded-lg border border-slate-200 bg-white p-3">
              {allEmbeddedAnswered ? (
                <p className="text-sm text-slate-700">{block.text}</p>
              ) : (
                <p className="text-sm text-slate-500">Answer the questions above to reveal this explanation.</p>
              )}
            </div>
          )
        }
        return null
      })}
      <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-sm text-slate-600">
        <p className="font-semibold text-slate-700">Sources</p>
        <ul className="mt-2 space-y-1">
          {card.sources.map((source) => (
            <li key={source.url}>
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer noopener"
                className="text-nhs-blue underline-offset-2 hover:underline"
              >
                {source.title} ({source.org ?? source.publisher ?? 'UK source'})
              </a>
              {source.publishedDate && <span className="text-slate-500"> — {source.publishedDate}</span>}
            </li>
          ))}
        </ul>
        {card.reviewByDate && (
          <p className="mt-2 text-xs text-slate-500">Review due: {card.reviewByDate}</p>
        )}
        <div className="mt-3">
          <button
            type="button"
            onClick={handleFlag}
            className="text-xs font-semibold text-nhs-blue hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-nhs-blue focus-visible:ring-offset-1 rounded"
          >
            Flag this card for review
          </button>
          {flagMessage && <p className="mt-2 text-xs text-slate-500">{flagMessage}</p>}
        </div>
      </div>
    </div>
  )

  return (
    <div
      className="flex flex-col gap-4 max-w-lg mx-auto overflow-hidden"
      style={{ height: 'calc(100dvh - 180px)', minHeight: 360, maxHeight: 680 }}
    >
      <LearningCardLayout
        containerClassName="flex-[2] min-h-0"
        header={
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-slate-500 truncate" title={headerText}>
              {headerText}
            </p>
            {session.resumed && (
              <span className="shrink-0 rounded-full bg-nhs-light-blue px-2 py-0.5 text-xs font-semibold text-nhs-dark-blue">
                Resuming
              </span>
            )}
          </div>
        }
        prompt={
          <div>
            <TruncateWithMore
              text={card.title}
              title="Full prompt"
              className="text-xl font-bold text-nhs-dark-blue leading-tight"
            />
          </div>
        }
        interactionBlock={renderInteractionBlock()}
        footer={
          <p className="text-xs text-slate-500">
            Source: — &nbsp;&nbsp; Reviewed: —
          </p>
        }
      />

      <section className="flex min-h-0 flex-1 flex-col overflow-auto rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between shrink-0">
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
              {quizQuestion.options.map((option) => {
                const quizKey = `quiz:${quizQuestion.cardId}:${quizQuestion.source}:${quizQuestion.blockIndex}`
                const result = questionResults[quizKey]
                return (
                  <LearningCardOptionCard
                    key={option}
                    label={option}
                    onClick={() => handleQuizAnswer(quizQuestion, option)}
                    disabled={Boolean(result)}
                    selected={result ? option === quizQuestion.correctAnswer : undefined}
                    correct={result ? option === quizQuestion.correctAnswer : undefined}
                  />
                )
              })}
            </div>

            {quizFeedbackKey && questionResults[quizFeedbackKey] && (
              <div className="rounded-md bg-slate-100 px-3 py-2">
                <p className="text-sm text-slate-600">
                  {questionResults[quizFeedbackKey].correct ? 'Correct.' : 'Not quite.'}{' '}
                  {questionResults[quizFeedbackKey].rationale}
                </p>
              </div>
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
                  disabled={
                    !questionResults[`quiz:${quizQuestion.cardId}:${quizQuestion.source}:${quizQuestion.blockIndex}`]
                  }
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
                  disabled={
                    saving ||
                    !questionResults[`quiz:${quizQuestion.cardId}:${quizQuestion.source}:${quizQuestion.blockIndex}`]
                  }
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
