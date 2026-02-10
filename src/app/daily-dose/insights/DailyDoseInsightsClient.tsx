'use client'

import { useEffect, useMemo, useState } from 'react'
import PhoneFrame from '@/components/daily-dose/PhoneFrame'

type EngagementByRole = {
  role: string
  activeUsers7: number | null
  activeUsers30: number | null
  suppressed: boolean
  userCount: number
}

type AccuracyByTopic = {
  role: string
  topicId: string
  topicName: string
  accuracy: number | null
  questionCount: number | null
  userCount: number
  suppressed: boolean
}

type MissedTopic = {
  topicId: string
  topicName: string
  accuracy: number | null
  userCount: number
  suppressed: boolean
}

type InsightsResponse = {
  minN: number
  engagementByRole: EngagementByRole[]
  accuracyByTopic: AccuracyByTopic[]
  commonlyMissedTopics: MissedTopic[]
}

export default function DailyDoseInsightsClient({ surgeryId, isSuperuser = false }: { surgeryId: string; isSuperuser?: boolean }) {
  const [insights, setInsights] = useState<InsightsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)

    fetch(`/api/daily-dose/insights?surgeryId=${surgeryId}`, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}))
          throw new Error(payload?.error || 'Unable to load insights')
        }
        const payload = (await res.json()) as InsightsResponse
        if (!active) return
        setInsights(payload)
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

  const accuracyByRole = useMemo(() => {
    if (!insights) return {}
    return insights.accuracyByTopic.reduce((acc, item) => {
      acc[item.role] = acc[item.role] ?? []
      acc[item.role].push(item)
      return acc
    }, {} as Record<string, AccuracyByTopic[]>)
  }, [insights])

  if (loading) {
    return (
      <PhoneFrame>
        <div className="flex h-full items-center justify-center p-6" aria-live="polite">
          <p className="text-slate-600">Loading insights…</p>
        </div>
      </PhoneFrame>
    )
  }

  if (error) {
    return (
      <PhoneFrame>
        <div className="flex h-full flex-col justify-center p-6" role="alert">
          <h1 className="text-lg font-semibold text-red-700">We could not load insights</h1>
          <p className="mt-2 text-sm text-red-700">{error}</p>
        </div>
      </PhoneFrame>
    )
  }

  if (!insights) {
    return (
      <PhoneFrame>
        <div className="flex h-full items-center justify-center p-6">
          <p className="text-slate-600">No insights available yet.</p>
        </div>
      </PhoneFrame>
    )
  }

  return (
    <PhoneFrame>
      <div className="flex h-full flex-col overflow-auto p-6">
        <h1 className="text-xl font-bold text-nhs-dark-blue">Daily Dose insights</h1>
        <p className="mt-2 text-sm text-slate-600">
          {isSuperuser 
            ? `Metrics are normally hidden when fewer than ${insights.minN} users are in a group. As a superuser, you can see all data.`
            : `Metrics are hidden when fewer than ${insights.minN} users are in a group.`}
        </p>

        <section className="mt-6">
          <h2 className="text-lg font-semibold text-nhs-dark-blue">Engagement by role</h2>
          <div className="mt-3 space-y-3">
            {insights.engagementByRole.map((entry) => (
              <div key={entry.role} className="rounded-lg border border-slate-200 p-3 text-sm">
                <p className="font-semibold text-slate-700">{entry.role}</p>
                {entry.suppressed && !isSuperuser ? (
                  <p className="mt-2 text-xs text-slate-500">Hidden due to low participant numbers.</p>
                ) : (
                  <div className="mt-2 space-y-1 text-slate-600">
                    {entry.suppressed && isSuperuser ? (
                      <>
                        <p>Active (7 days): {entry.activeUsers7 ?? 'N/A'} <span className="text-xs text-slate-500">(below threshold, {entry.userCount} users)</span></p>
                        <p>Active (30 days): {entry.activeUsers30 ?? 'N/A'} <span className="text-xs text-slate-500">(below threshold, {entry.userCount} users)</span></p>
                      </>
                    ) : (
                      <>
                        <p>Active (7 days): {entry.activeUsers7}</p>
                        <p>Active (30 days): {entry.activeUsers30}</p>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6">
          <h2 className="text-lg font-semibold text-nhs-dark-blue">Accuracy by topic</h2>
          {Object.entries(accuracyByRole).map(([role, items]) => {
            const suppressed = items.every((item) => item.suppressed)
            return (
              <div key={role} className="mt-4">
                <h3 className="text-sm font-semibold text-slate-700">{role}</h3>
                {suppressed && !isSuperuser ? (
                  <p className="mt-2 text-xs text-slate-500">Hidden due to low participant numbers.</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {items
                      .filter((item) => !item.suppressed || isSuperuser)
                      .map((item) => (
                        <div key={item.topicId} className="rounded-lg border border-slate-200 p-3 text-sm">
                          <p className="font-semibold">{item.topicName}</p>
                          {item.suppressed && isSuperuser ? (
                            <p className="text-xs text-slate-500">
                              Below threshold ({item.userCount} users) • Accuracy and question count not available
                            </p>
                          ) : (
                            <p className="text-xs text-slate-500">
                              Accuracy {item.accuracy}% • {item.questionCount} questions
                            </p>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )
          })}
        </section>

        <section className="mt-6">
          <h2 className="text-lg font-semibold text-nhs-dark-blue">Commonly missed topics</h2>
          {insights.commonlyMissedTopics.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600">No topics to show yet.</p>
          ) : (
            <div className="mt-2 space-y-2">
              {insights.commonlyMissedTopics.map((topic) => (
                <div key={topic.topicId} className="rounded-lg border border-slate-200 p-3 text-sm">
                  <p className="font-semibold">{topic.topicName}</p>
                  <p className="text-xs text-slate-500">Accuracy {topic.accuracy}%</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </PhoneFrame>
  )
}
