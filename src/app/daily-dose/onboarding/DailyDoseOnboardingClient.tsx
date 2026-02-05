'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import PhoneFrame from '@/components/daily-dose/PhoneFrame'

type Topic = {
  id: string
  name: string
  roleScope: string[]
}

type Profile = {
  role: string
  onboardingCompleted: boolean
  preferences?: {
    weekdayOnlyStreak?: boolean
    chosenFocusTopicIds?: string[]
    baselineConfidence?: number
  }
}

const roles = [
  { value: 'GP', label: 'GP / Prescriber' },
  { value: 'NURSE', label: 'Nurse / HCA' },
  { value: 'ADMIN', label: 'Admin / Reception' },
]

export default function DailyDoseOnboardingClient({ surgeryId }: { surgeryId: string }) {
  const router = useRouter()
  const [topics, setTopics] = useState<Topic[]>([])
  const [role, setRole] = useState<string>('ADMIN')
  const [weekdayOnlyStreak, setWeekdayOnlyStreak] = useState(true)
  const [chosenTopicIds, setChosenTopicIds] = useState<string[]>([])
  const [baselineConfidence, setBaselineConfidence] = useState<number>(3)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    Promise.all([
      fetch(`/api/daily-dose/topics?surgeryId=${surgeryId}`, { cache: 'no-store' }),
      fetch(`/api/daily-dose/profile?surgeryId=${surgeryId}`, { cache: 'no-store' }),
    ])
      .then(async ([topicsRes, profileRes]) => {
        if (!topicsRes.ok) throw new Error('Unable to load topics')
        const topicsJson = (await topicsRes.json()) as { topics: Topic[] }
        const profileJson = profileRes.ok ? ((await profileRes.json()) as { profile: Profile | null }) : { profile: null }
        if (!active) return
        setTopics(topicsJson.topics || [])
        if (profileJson.profile) {
          setRole(profileJson.profile.role ?? 'ADMIN')
          setWeekdayOnlyStreak(profileJson.profile.preferences?.weekdayOnlyStreak ?? true)
          setChosenTopicIds(profileJson.profile.preferences?.chosenFocusTopicIds ?? [])
          setBaselineConfidence(profileJson.profile.preferences?.baselineConfidence ?? 3)
        }
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

  const roleFilteredTopics = useMemo(() => {
    return topics.filter((topic) => {
      if (!topic.roleScope || topic.roleScope.length === 0) return true
      return topic.roleScope.includes(role)
    })
  }, [topics, role])

  const toggleTopic = (id: string) => {
    setChosenTopicIds((current) =>
      current.includes(id) ? current.filter((topicId) => topicId !== id) : [...current, id]
    )
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const response = await fetch('/api/daily-dose/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surgeryId,
          role,
          preferences: {
            weekdayOnlyStreak,
            chosenFocusTopicIds: chosenTopicIds,
            baselineConfidence,
          },
          onboardingCompleted: true,
        }),
      })

      if (!response.ok) {
        throw new Error('Unable to save your preferences')
      }

      router.push(`/daily-dose?surgery=${surgeryId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <PhoneFrame>
        <div className="flex h-full items-center justify-center p-6" aria-live="polite">
          <p className="text-slate-600">Loading onboarding…</p>
        </div>
      </PhoneFrame>
    )
  }

  return (
    <PhoneFrame
      actions={
        <button
          type="submit"
          form="daily-dose-onboarding-form"
          disabled={saving}
          className="inline-flex items-center rounded-xl bg-nhs-blue px-6 py-3 text-sm font-semibold text-white hover:bg-nhs-dark-blue disabled:cursor-not-allowed disabled:opacity-70"
        >
          {saving ? 'Saving…' : 'Save and continue'}
        </button>
      }
    >
      <form id="daily-dose-onboarding-form" onSubmit={handleSubmit} className="flex h-full flex-col overflow-auto p-6">
      <div>
        <h1 className="text-2xl font-bold text-nhs-dark-blue">Daily Dose onboarding</h1>
        <p className="mt-2 text-slate-600">
          Tell us your role and focus areas so we can tailor daily learning to your practice.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      <fieldset>
        <legend className="text-sm font-semibold text-slate-700">Your role</legend>
        <div className="mt-3 space-y-2">
          {roles.map((item) => (
            <label
              key={item.value}
              className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                role === item.value ? 'border-nhs-blue bg-nhs-light-blue text-nhs-dark-blue' : 'border-slate-200'
              }`}
            >
              <input
                type="radio"
                name="role"
                value={item.value}
                checked={role === item.value}
                onChange={() => setRole(item.value)}
                className="accent-nhs-blue"
              />
              {item.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-semibold text-slate-700">Focus areas (optional)</legend>
        <p className="mt-1 text-sm text-slate-500">Choose the topics you want to prioritise.</p>
        <div className="mt-3 space-y-2">
          {roleFilteredTopics.length === 0 ? (
            <p className="text-sm text-slate-500">No topics available for this role yet.</p>
          ) : (
            roleFilteredTopics.map((topic) => (
              <label
                key={topic.id}
                className="flex items-start gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={chosenTopicIds.includes(topic.id)}
                  onChange={() => toggleTopic(topic.id)}
                  className="mt-1 accent-nhs-blue"
                />
                <span>{topic.name}</span>
              </label>
            ))
          )}
        </div>
      </fieldset>

      <div className="space-y-4">
        <label className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={weekdayOnlyStreak}
            onChange={(event) => setWeekdayOnlyStreak(event.target.checked)}
            className="accent-nhs-blue"
          />
          Weekdays only for streaks
        </label>

        <label className="rounded-md border border-slate-200 px-3 py-2 text-sm">
          <span className="block text-slate-600">Baseline confidence</span>
          <input
            type="range"
            min={1}
            max={5}
            value={baselineConfidence}
            onChange={(event) => setBaselineConfidence(Number(event.target.value))}
            className="mt-2 w-full accent-nhs-blue"
          />
          <span className="text-xs text-slate-500">Level {baselineConfidence} of 5</span>
        </label>
      </div>
      </form>
    </PhoneFrame>
  )
}
