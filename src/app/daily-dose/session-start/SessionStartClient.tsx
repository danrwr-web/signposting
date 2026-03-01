'use client'

import Link from 'next/link'
import PhoneFrame from '@/components/daily-dose/PhoneFrame'

interface SessionStartClientProps {
  surgeryId: string
}

export default function SessionStartClient({ surgeryId }: SessionStartClientProps) {
  return (
    <PhoneFrame>
      <div className="flex h-full flex-col justify-between p-6">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <Link
            href={`/daily-dose?surgery=${surgeryId}`}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-nhs-blue"
            aria-label="Back to Daily Dose home"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-base font-bold text-nhs-dark-blue">Start a session</h1>
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col justify-center gap-6">
          {/* Lucky Dip */}
          <div className="rounded-2xl border-2 border-nhs-blue bg-nhs-blue p-5 text-white">
            <p className="text-lg font-bold leading-tight">Lucky Dip</p>
            <p className="mt-1.5 text-sm opacity-90">
              A personalised mix of cards chosen for you — based on your role, spaced repetition schedule, and areas due for review.
            </p>
            <Link
              href={`/daily-dose/session?surgery=${surgeryId}`}
              className="mt-4 block w-full rounded-xl border-2 border-white bg-white py-3 text-center text-sm font-semibold text-nhs-blue transition hover:bg-nhs-light-blue"
            >
              Start Lucky Dip session
            </Link>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 border-t border-slate-200" />
            <span className="text-xs font-medium text-slate-400">or</span>
            <div className="flex-1 border-t border-slate-200" />
          </div>

          {/* Focused */}
          <div className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-5">
            <p className="text-lg font-bold leading-tight text-nhs-dark-blue">Focus on a topic</p>
            <p className="mt-1.5 text-sm text-slate-600">
              Choose a Learning Pathway category and practise cards specifically from that topic area.
            </p>
            <Link
              href={`/daily-dose/pathway?surgery=${surgeryId}&mode=focus`}
              className="mt-4 block w-full rounded-xl border-2 border-nhs-blue py-3 text-center text-sm font-semibold text-nhs-blue transition hover:bg-nhs-blue hover:text-white"
            >
              Choose a topic to focus on
            </Link>
          </div>
        </div>

        {/* Footer hint */}
        <p className="pt-4 text-center text-[11px] text-slate-400">
          Sessions take around 5–10 minutes to complete.
        </p>
      </div>
    </PhoneFrame>
  )
}
