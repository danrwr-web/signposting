'use client'

import type { MouseEventHandler } from 'react'

type Props = {
  onClick?: () => void
  title?: string
  ariaLabel?: string
  className?: string
}

export default function InfoBadgeButton({
  onClick,
  title = 'View details',
  ariaLabel = 'View details',
  className = '',
}: Props) {
  const handleClick: MouseEventHandler<HTMLButtonElement> = (e) => {
    e.preventDefault()
    e.stopPropagation()
    onClick?.()
  }

  return (
    <button
      type="button"
      data-rf-no-details
      onClick={handleClick}
      onMouseDown={(e) => e.stopPropagation()}
      className={[
        'inline-flex items-center justify-center',
        'w-6 h-6 rounded-full',
        'bg-blue-100 text-blue-700',
        'hover:bg-blue-200',
        'focus:outline-none focus:ring-2 focus:ring-blue-400',
        'transition-colors transition-transform hover:scale-105',
        'pointer-events-auto',
        className,
      ].join(' ')}
      title={title}
      aria-label={ariaLabel}
    >
      <span className="text-sm font-semibold leading-none" aria-hidden="true">
        i
      </span>
    </button>
  )
}

