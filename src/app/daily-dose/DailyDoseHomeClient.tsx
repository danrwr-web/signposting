'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface DailyDoseHomeClientProps {
  surgeryId: string
  userName?: string
}

type ProfileResponse = {
  profile: {
    onboardingCompleted: boolean
    role: string
  } | null
}

type HistoryResponse = {
  totalXp: number
  completedSessions: number
  streak: number
  reviewQueue: Array<{ cardId: string }>
}

export default function DailyDoseHomeClient({ surgeryId, userName }: DailyDoseHomeClientProps) {
  const [profile, setProfile] = useState<ProfileResponse['profile'] | null>(null)
  const [history, setHistory] = useState<HistoryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    setLoading(true)
    setError(null)

    Promise.all([
      fetch(`/api/daily-dose/profile?surgeryId=${surgeryId}`, { cache: 'no-store' }),
      fetch(`/api/daily-dose/history?surgeryId=${surgeryId}`, { cache: 'no-store' }),
    ])
      .then(async ([profileRes, historyRes]) => {
        if (!profileRes.ok) {
          throw new Error('Unable to load Daily Dose profile')
        }
        const profileJson = (await profileRes.json()) as ProfileResponse
        const historyJson = historyRes.ok ? ((await historyRes.json()) as HistoryResponse) : null
        if (!isMounted) return
        setProfile(profileJson.profile)
        setHistory(historyJson)
      })
      .catch((err) => {
        if (!isMounted) return
        setError(err instanceof Error ? err.message : 'Something went wrong')
      })
      .finally(() => {
        if (!isMounted) return
        setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [surgeryId])

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6" aria-live="polite">
        <p className="text-slate-600">Loading Daily Dose…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6" role="alert">
        <h1 className="text-lg font-semibold text-red-700">We could not load Daily Dose</h1>
        <p className="mt-2 text-sm text-red-700">{error}</p>
      </div>
    )
  }

  if (!profile || !profile.onboardingCompleted) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-bold text-nhs-dark-blue">Daily Dose</h1>
        <p className="mt-3 text-slate-600">
          Set up your role and focus areas to start your daily learning.
        </p>
        <Link
          href={`/daily-dose/onboarding?surgery=${surgeryId}`}
          className="mt-5 inline-flex items-center rounded-md bg-nhs-blue px-4 py-2 text-sm font-semibold text-white hover:bg-nhs-dark-blue"
        >
          Start onboarding
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-bold text-nhs-dark-blue">
          Welcome back{userName ? `, ${userName}` : ''}
        </h1>
        <p className="mt-3 text-slate-600">
          Keep your learning streak ticking with a short Daily Dose session.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href={`/daily-dose/session?surgery=${surgeryId}`}
            className="inline-flex items-center rounded-md bg-nhs-blue px-4 py-2 text-sm font-semibold text-white hover:bg-nhs-dark-blue"
          >
            Start session
          </Link>
          <Link
            href={`/daily-dose/onboarding?surgery=${surgeryId}`}
            className="inline-flex items-center rounded-md border border-nhs-blue px-4 py-2 text-sm font-semibold text-nhs-blue hover:bg-nhs-blue hover:text-white"
          >
            Update preferences
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Current streak</p>
          <p className="mt-1 text-2xl font-semibold text-nhs-dark-blue">{history?.streak ?? 0} days</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Total XP</p>
          <p className="mt-1 text-2xl font-semibold text-nhs-dark-blue">{history?.totalXp ?? 0}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Reviews due</p>
          <p className="mt-1 text-2xl font-semibold text-nhs-dark-blue">
            {history?.reviewQueue?.length ?? 0}
          </p>
        </div>
      </div>
    </div>
  )
}
