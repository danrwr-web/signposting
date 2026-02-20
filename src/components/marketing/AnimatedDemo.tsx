'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'

/**
 * Animated demo showing the core signposting workflow:
 * 1. Empty search bar → user types "sore throat"
 * 2. Symptom cards filter down
 * 3. A card is "clicked" and expands into a detail view with triage instructions
 * 4. Pauses, then resets and loops
 *
 * Pure CSS + React state — no external animation library.
 */

type DemoStep =
  | 'idle'           // Brief pause before typing starts
  | 'typing'         // Characters appear one by one
  | 'filtering'      // Cards fade out that don't match
  | 'selecting'      // Card highlight + click effect
  | 'detail'         // Detail panel slides in
  | 'reading'        // Pause on detail view
  | 'resetting'      // Fade out, prepare for loop

const SYMPTOMS = [
  { name: 'Sore Throat', age: 'Adult', color: 'purple' as const, match: true },
  { name: 'Headache', age: 'All ages', color: 'blue' as const, match: false },
  { name: 'Earache', age: 'Under 5', color: 'sky' as const, match: false },
  { name: 'Cough', age: 'Adult', color: 'purple' as const, match: false },
  { name: 'Sore Eyes', age: '5–17', color: 'green' as const, match: true },
  { name: 'Back Pain', age: 'Adult', color: 'purple' as const, match: false },
]

const SEARCH_TEXT = 'sore'
const TYPING_SPEED = 120 // ms per character
const STEP_TIMINGS: Record<DemoStep, number> = {
  idle: 1200,
  typing: SEARCH_TEXT.length * TYPING_SPEED + 400,
  filtering: 800,
  selecting: 600,
  detail: 600,
  reading: 3500,
  resetting: 1000,
}

const STEP_ORDER: DemoStep[] = [
  'idle', 'typing', 'filtering', 'selecting', 'detail', 'reading', 'resetting',
]

const AGE_COLORS = {
  blue: { bg: 'bg-blue-100', text: 'text-blue-700' },
  sky: { bg: 'bg-blue-100', text: 'text-blue-700' },
  green: { bg: 'bg-green-100', text: 'text-green-700' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-700' },
} as const

export default function AnimatedDemo() {
  const [step, setStep] = useState<DemoStep>('idle')
  const [typedChars, setTypedChars] = useState(0)
  const [isPaused, setIsPaused] = useState(false)

  const isReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [])

  // Advance through steps
  const advanceStep = useCallback(() => {
    setStep((prev: DemoStep): DemoStep => {
      const idx = STEP_ORDER.indexOf(prev)
      const next = STEP_ORDER[(idx + 1) % STEP_ORDER.length]
      if (next === 'idle') {
        setTypedChars(0)
      }
      return next
    })
  }, [])

  // Step timer
  useEffect(() => {
    if (isPaused) return
    const timer = setTimeout(advanceStep, STEP_TIMINGS[step])
    return () => clearTimeout(timer)
  }, [step, isPaused, advanceStep])

  // Typing effect
  useEffect(() => {
    if (step !== 'typing') return
    if (typedChars >= SEARCH_TEXT.length) return

    const timer = setTimeout(() => {
      setTypedChars((c: number) => c + 1)
    }, TYPING_SPEED)
    return () => clearTimeout(timer)
  }, [step, typedChars])

  const searchValue = step === 'idle' || step === 'resetting' ? '' : SEARCH_TEXT.slice(0, typedChars)
  const showFiltered = step === 'filtering' || step === 'selecting' || step === 'detail' || step === 'reading'
  const showDetail = step === 'detail' || step === 'reading'
  const isSelecting = step === 'selecting'

  // For reduced motion, show a static view of the detail step
  if (isReducedMotion) {
    return (
      <div className="w-full rounded-2xl shadow-xl overflow-hidden ring-1 ring-gray-200 bg-white">
        <StaticDetailView />
      </div>
    )
  }

  return (
    <div
      className="w-full rounded-2xl shadow-xl overflow-hidden ring-1 ring-gray-200 bg-white relative"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      role="img"
      aria-label="Animated demonstration of the Signposting Toolkit showing symptom search, filtering, and triage instructions"
    >
      {/* Browser chrome */}
      <div className="bg-gray-100 border-b border-gray-200 px-4 py-2.5 flex items-center gap-2">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div className="w-3 h-3 rounded-full bg-yellow-400" />
          <div className="w-3 h-3 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 mx-3">
          <div className="bg-white rounded-md px-3 py-1 text-xs text-gray-400 border border-gray-200 max-w-xs mx-auto text-center truncate">
            signpostingtool.co.uk/s/your-surgery
          </div>
        </div>
      </div>

      {/* Demo content area */}
      <div
        className={`relative transition-opacity duration-500 ${step === 'resetting' ? 'opacity-0' : 'opacity-100'}`}
      >
        {/* Grid view (search + cards) */}
        <div
          className={`transition-all duration-500 ${showDetail ? 'opacity-0 scale-95 absolute inset-0 pointer-events-none' : 'opacity-100 scale-100'}`}
        >
          <DemoGridView
            searchValue={searchValue}
            showFiltered={showFiltered}
            isSelecting={isSelecting}
            isTyping={step === 'typing'}
          />
        </div>

        {/* Detail view */}
        <div
          className={`transition-all duration-500 ${showDetail ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 absolute inset-0 pointer-events-none'}`}
        >
          <DemoDetailView />
        </div>
      </div>

      {/* Step indicator */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
        {STEP_ORDER.slice(0, -1).map((s, i) => (
          <div
            key={s}
            className={`h-1 rounded-full transition-all duration-300 ${
              STEP_ORDER.indexOf(step) >= i
                ? 'w-4 bg-nhs-blue'
                : 'w-2 bg-gray-300'
            }`}
          />
        ))}
      </div>

      {/* Pause indicator */}
      {isPaused && (
        <div className="absolute top-14 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded-md flex items-center gap-1">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          Paused
        </div>
      )}
    </div>
  )
}

function DemoGridView({
  searchValue,
  showFiltered,
  isSelecting,
  isTyping,
}: {
  searchValue: string
  showFiltered: boolean
  isSelecting: boolean
  isTyping: boolean
}) {
  return (
    <div className="p-4 sm:p-6">
      {/* Page header */}
      <div className="mb-4">
        <h3 className="text-base sm:text-lg font-bold text-[#003087]">Find the right place for care</h3>
        <p className="text-xs text-gray-500 mt-0.5">Search by symptom and we&apos;ll guide you to the appropriate service.</p>
      </div>

      {/* Search bar */}
      <div className="relative mb-4">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <div
          className={`w-full pl-9 pr-3 py-2 border rounded-lg text-sm bg-white transition-all ${
            isTyping || searchValue
              ? 'border-[#005EB8] ring-2 ring-[#005EB8]/20'
              : 'border-gray-300'
          }`}
        >
          <span className="text-gray-900">{searchValue}</span>
          {isTyping && (
            <span className="inline-block w-0.5 h-4 bg-[#005EB8] ml-px align-middle demo-cursor-blink" />
          )}
          {!searchValue && !isTyping && (
            <span className="text-gray-400">Search symptoms...</span>
          )}
        </div>
      </div>

      {/* Age filter pills */}
      <div className="flex gap-2 mb-4">
        {['All', 'Under 5', '5–17', 'Adult'].map((label) => (
          <span
            key={label}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              label === 'All'
                ? 'bg-[#005EB8] text-white'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {label}
          </span>
        ))}
      </div>

      {/* Symptom cards grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
        {SYMPTOMS.map((symptom, i) => {
          const hidden = showFiltered && !symptom.match
          const selected = isSelecting && symptom.name === 'Sore Throat'
          const ageStyle = AGE_COLORS[symptom.color]

          return (
            <div
              key={symptom.name}
              className={`
                rounded-lg border p-3 sm:p-3.5 transition-all duration-300
                ${hidden ? 'opacity-0 scale-90' : 'opacity-100 scale-100'}
                ${selected
                  ? 'border-[#005EB8] shadow-lg ring-2 ring-[#005EB8]/30 bg-blue-50/50 scale-[1.02]'
                  : 'border-gray-200 bg-white shadow-sm hover:shadow-md'
                }
              `}
              style={{ transitionDelay: hidden ? '0ms' : `${i * 40}ms` }}
            >
              <div className="flex items-start justify-between gap-1 mb-1.5">
                <span className="text-xs sm:text-sm font-semibold text-[#003087] leading-tight">
                  {symptom.name}
                </span>
                <span className={`${ageStyle.bg} ${ageStyle.text} text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap flex-shrink-0`}>
                  {symptom.age}
                </span>
              </div>
              <div className="space-y-1">
                <div className="h-1.5 bg-gray-100 rounded-full w-full" />
                <div className="h-1.5 bg-gray-100 rounded-full w-3/4" />
              </div>
              {selected && (
                <div className="mt-2 text-[10px] text-[#005EB8] font-medium flex items-center gap-0.5">
                  Open
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Results count */}
      {showFiltered && (
        <div className="mt-3 text-xs text-gray-500 text-center">
          Showing 2 of 6 symptoms
        </div>
      )}
    </div>
  )
}

function DemoDetailView() {
  return (
    <div className="p-4 sm:p-6">
      {/* Back link */}
      <div className="mb-3">
        <span className="text-xs text-[#005EB8] flex items-center gap-1 font-medium">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to symptoms
        </span>
      </div>

      {/* Symptom title */}
      <h3 className="text-xl sm:text-2xl font-bold text-[#003087] mb-1">Sore Throat</h3>
      <p className="text-xs text-gray-500 mb-4">Clinically approved guidance for reception teams</p>

      {/* Important notice */}
      <div className="bg-red-50 border-l-[3px] border-[#DA020E] rounded-r-lg p-3 mb-4">
        <p className="text-xs font-semibold text-[#DA020E] mb-0.5">Important</p>
        <p className="text-xs text-[#DA020E]/80">
          If the patient has difficulty breathing, swallowing saliva, or drooling — transfer to 999 immediately.
        </p>
      </div>

      {/* Age group selector */}
      <div className="flex gap-2 mb-4">
        {['Under 5', '5–17', 'Adult'].map((label) => (
          <span
            key={label}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border-2 transition-colors ${
              label === 'Adult'
                ? 'bg-[#005EB8] text-white border-[#005EB8]'
                : 'bg-white text-[#003087] border-gray-200'
            }`}
          >
            {label}
          </span>
        ))}
      </div>

      {/* Instructions */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h4 className="text-sm font-semibold text-[#003087] mb-3">Instructions</h4>
        <div className="space-y-2.5 text-xs text-gray-700 leading-relaxed">
          <div className="flex gap-2">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#005EB8] text-white text-[10px] font-bold flex items-center justify-center">1</span>
            <p>Ask: <em>&ldquo;How long have you had the sore throat?&rdquo;</em></p>
          </div>
          <div className="flex gap-2">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#005EB8] text-white text-[10px] font-bold flex items-center justify-center">2</span>
            <p>If less than 7 days, refer to <span className="text-[#005EB8] font-medium">Community Pharmacy</span> via Pharmacy First.</p>
          </div>
          <div className="flex gap-2">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#005EB8] text-white text-[10px] font-bold flex items-center justify-center">3</span>
            <p>If longer than 7 days or recurring, book a <span className="text-[#005EB8] font-medium">Routine GP appointment</span>.</p>
          </div>
        </div>
      </div>

      {/* Pharmacy First badge */}
      <div className="mt-3 inline-flex items-center gap-1.5 bg-[#00A499]/10 text-[#00A499] text-xs font-medium px-3 py-1.5 rounded-full">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Pharmacy First eligible
      </div>
    </div>
  )
}

/** Static fallback for prefers-reduced-motion */
function StaticDetailView() {
  return (
    <div>
      <div className="bg-gray-100 border-b border-gray-200 px-4 py-2.5 flex items-center gap-2">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div className="w-3 h-3 rounded-full bg-yellow-400" />
          <div className="w-3 h-3 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 mx-3">
          <div className="bg-white rounded-md px-3 py-1 text-xs text-gray-400 border border-gray-200 max-w-xs mx-auto text-center truncate">
            signpostingtool.co.uk/s/your-surgery
          </div>
        </div>
      </div>
      <DemoDetailView />
    </div>
  )
}
