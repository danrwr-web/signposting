'use client'

interface LearningCardOptionCardProps {
  label: string
  onClick?: () => void
  disabled?: boolean
  selected?: boolean
  correct?: boolean
  /** In editorial review: show this option as the correct answer (green + tick) without requiring a click */
  reviewCorrect?: boolean
  'aria-pressed'?: boolean
  'aria-checked'?: boolean
  role?: 'button' | 'radio' | 'checkbox'
}

export default function LearningCardOptionCard({
  label,
  onClick,
  disabled = false,
  selected = false,
  correct,
  reviewCorrect = false,
  role = 'button',
  ...ariaProps
}: LearningCardOptionCardProps) {
  const isAnswered = correct !== undefined
  const isReviewCorrect = reviewCorrect

  const baseClasses =
    'w-full rounded-lg border-2 px-4 py-3.5 text-left text-base font-medium transition-colors min-h-[48px] flex items-center gap-2 ' +
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-nhs-blue focus-visible:ring-offset-2 ' +
    'disabled:cursor-not-allowed disabled:opacity-70'

  const stateClasses = isReviewCorrect
    ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
    : isAnswered
      ? selected && correct
        ? 'border-slate-300 bg-slate-100 text-slate-700'
        : selected && !correct
          ? 'border-slate-300 bg-slate-50 text-slate-500'
          : 'border-slate-200 bg-white text-slate-500'
      : selected
        ? 'border-nhs-blue bg-nhs-light-blue text-nhs-dark-blue'
        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 active:bg-slate-100'

  return (
    <button
      type="button"
      role={role}
      onClick={onClick ?? (() => {})}
      disabled={disabled || isReviewCorrect}
      className={`${baseClasses} ${stateClasses}`}
      aria-pressed={role === 'button' ? selected : undefined}
      aria-checked={role !== 'button' ? selected : undefined}
      aria-label={isReviewCorrect ? `${label} (correct answer)` : undefined}
      {...ariaProps}
    >
      <span className="flex-1 text-left">{label}</span>
      {isReviewCorrect && <span className="text-emerald-600 font-semibold shrink-0" aria-hidden>✓</span>}
    </button>
  )
}
