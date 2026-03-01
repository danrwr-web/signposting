'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import PhoneFrame from '@/components/daily-dose/PhoneFrame'

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
      <PhoneFrame>
        <div className="flex h-full items-center justify-center p-6" aria-live="polite">
          <p className="text-slate-600">Loading Daily Dose…</p>
        </div>
      </PhoneFrame>
    )
  }

  if (error) {
    return (
      <PhoneFrame>
        <div className="flex h-full flex-col justify-center p-6" role="alert">
          <h1 className="text-lg font-semibold text-red-700">We could not load Daily Dose</h1>
          <p className="mt-2 text-sm text-red-700">{error}</p>
        </div>
      </PhoneFrame>
    )
  }

  if (!profile || !profile.onboardingCompleted) {
    return (
      <PhoneFrame
        actions={
          <Link
            href={`/daily-dose/onboarding?surgery=${surgeryId}`}
            className="inline-flex items-center rounded-xl bg-nhs-blue px-6 py-3 text-sm font-semibold text-white hover:bg-nhs-dark-blue"
          >
            Start onboarding
          </Link>
        }
      >
        <div className="flex h-full flex-col justify-center p-6">
          <h1 className="text-2xl font-bold text-nhs-dark-blue">Daily Dose</h1>
          <p className="mt-3 text-slate-600">
            Set up your role and focus areas to start your daily learning.
          </p>
        </div>
      </PhoneFrame>
    )
  }

  return (
    <PhoneFrame>
      <div className="flex h-full flex-col justify-between p-6">
        {/* Stats at top */}
        <div className="flex justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
          <div className="flex-1">
            <p className="text-xs text-slate-500">Streak</p>
            <p className="text-lg font-semibold text-nhs-dark-blue">{history?.streak ?? 0} days</p>
          </div>
          <div className="flex-1">
            <p className="text-xs text-slate-500">Total XP</p>
            <p className="text-lg font-semibold text-nhs-dark-blue">{history?.totalXp ?? 0}</p>
          </div>
          <div className="flex-1">
            <p className="text-xs text-slate-500">Due</p>
            <p className="text-lg font-semibold text-nhs-dark-blue">{history?.reviewQueue?.length ?? 0}</p>
          </div>
        </div>

        {/* Welcome message */}
        <div className="flex flex-1 flex-col justify-center">
          <h1 className="text-2xl font-bold text-nhs-dark-blue">
            Welcome back{userName ? `, ${userName}` : ''}
          </h1>
          <p className="mt-3 text-slate-600">
            Keep your learning streak ticking with a short Daily Dose session.
          </p>
        </div>

        {/* Buttons at bottom */}
        <div className="flex flex-col gap-3 pt-4">
          <Link
            href={`/daily-dose/session-start?surgery=${surgeryId}`}
            className="inline-flex items-center justify-center rounded-xl bg-nhs-blue px-6 py-3 text-sm font-semibold text-white hover:bg-nhs-dark-blue"
          >
            Start session
          </Link>
          <Link
            href={`/daily-dose/pathway?surgery=${surgeryId}`}
            className="inline-flex items-center justify-center rounded-xl border border-nhs-blue px-6 py-3 text-sm font-semibold text-nhs-blue hover:bg-nhs-blue hover:text-white"
          >
            View Learning Pathway
          </Link>
          <Link
            href={`/daily-dose/onboarding?surgery=${surgeryId}`}
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Update preferences
          </Link>
        </div>
      </div>
    </PhoneFrame>
  )
}
