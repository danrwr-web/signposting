'use client'

import { useEffect, useState } from 'react'
import PhoneFrame from '@/components/daily-dose/PhoneFrame'

type HistoryResponse = {
  totalXp: number
  completedSessions: number
  streak: number
  weekdayOnlyStreak: boolean
  recentSessions: Array<{
    id: string
    completedAt: string
    xpEarned: number
    correctCount: number
    questionsAttempted: number
  }>
  reviewQueue: Array<{
    cardId: string
    title: string
    topicName?: string
    dueAt: string
    box: number
  }>
}

export default function DailyDoseHistoryClient({ surgeryId }: { surgeryId: string }) {
  const [history, setHistory] = useState<HistoryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)

    fetch(`/api/daily-dose/history?surgeryId=${surgeryId}`, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}))
          throw new Error(payload?.error || 'Unable to load history')
        }
        const payload = (await res.json()) as HistoryResponse
        if (!active) return
        setHistory(payload)
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

  if (loading) {
    return (
      <PhoneFrame>
        <div className="flex h-full items-center justify-center p-6" aria-live="polite">
          <p className="text-slate-600">Loading history…</p>
        </div>
      </PhoneFrame>
    )
  }

  if (error) {
    return (
      <PhoneFrame>
        <div className="flex h-full flex-col justify-center p-6" role="alert">
          <h1 className="text-lg font-semibold text-red-700">We could not load history</h1>
          <p className="mt-2 text-sm text-red-700">{error}</p>
        </div>
      </PhoneFrame>
    )
  }

  if (!history) {
    return (
      <PhoneFrame>
        <div className="flex h-full items-center justify-center p-6">
          <p className="text-slate-600">No history available yet.</p>
        </div>
      </PhoneFrame>
    )
  }

  return (
    <PhoneFrame>
      <div className="flex h-full flex-col overflow-auto p-6">
        <h1 className="text-xl font-bold text-nhs-dark-blue">Your progress</h1>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-slate-200 p-3 text-center">
            <p className="text-xs text-slate-500">Streak</p>
            <p className="text-lg font-semibold text-nhs-dark-blue">{history.streak} days</p>
            <p className="text-[10px] text-slate-500">
              {history.weekdayOnlyStreak ? 'Weekdays' : 'Daily'}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3 text-center">
            <p className="text-xs text-slate-500">Total XP</p>
            <p className="text-lg font-semibold text-nhs-dark-blue">{history.totalXp}</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3 text-center">
            <p className="text-xs text-slate-500">Sessions</p>
            <p className="text-lg font-semibold text-nhs-dark-blue">{history.completedSessions}</p>
          </div>
        </div>

        <h2 className="mt-6 text-lg font-semibold text-nhs-dark-blue">Review queue</h2>
        {history.reviewQueue.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">No reviews due right now.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm text-slate-700">
            {history.reviewQueue.map((item) => (
              <li key={item.cardId} className="rounded-lg border border-slate-200 p-3">
                <p className="font-semibold">{item.title}</p>
                <p className="text-xs text-slate-500">
                  {item.topicName ?? 'General'} • Due {new Date(item.dueAt).toLocaleDateString()}
                </p>
              </li>
            ))}
          </ul>
        )}

        <h2 className="mt-6 text-lg font-semibold text-nhs-dark-blue">Recent sessions</h2>
        {history.recentSessions.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">Complete your first session to see history.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm text-slate-700">
            {history.recentSessions.map((session) => {
              const accuracy = session.questionsAttempted
                ? Math.round((session.correctCount / session.questionsAttempted) * 100)
                : 0
              return (
                <li key={session.id} className="rounded-lg border border-slate-200 p-3">
                  <p className="font-semibold">
                    {new Date(session.completedAt).toLocaleDateString()} — {session.xpEarned} XP
                  </p>
                  <p className="text-xs text-slate-500">
                    {accuracy}% accuracy • {session.correctCount}/{session.questionsAttempted} correct
                  </p>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </PhoneFrame>
  )
}
