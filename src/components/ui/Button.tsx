'use client'

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

/* ------------------------------------------------------------------ */
/*  Variant + size maps                                                */
/* ------------------------------------------------------------------ */

const variantClasses = {
  primary:
    'bg-nhs-blue text-white hover:bg-nhs-dark-blue focus-visible:ring-nhs-blue',
  secondary:
    'bg-white text-nhs-grey border border-gray-300 hover:bg-gray-50 focus-visible:ring-nhs-blue',
  success:
    'bg-nhs-green text-white hover:bg-nhs-green-dark focus-visible:ring-nhs-green',
  danger:
    'bg-nhs-red text-white hover:bg-nhs-red-dark focus-visible:ring-nhs-red',
  'danger-soft':
    'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 focus-visible:ring-red-500',
  ghost:
    'bg-transparent text-nhs-grey hover:bg-gray-100 focus-visible:ring-nhs-blue',
  link:
    'bg-transparent text-nhs-blue underline hover:text-nhs-dark-blue focus-visible:ring-nhs-blue p-0',
} as const

const sizeClasses = {
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-6 py-3 text-base gap-2',
} as const

export type ButtonVariant = keyof typeof variantClasses
export type ButtonSize = keyof typeof sizeClasses

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Show a loading spinner and disable the button */
  loading?: boolean
  /** Icon element rendered before children */
  iconLeft?: ReactNode
  /** Icon element rendered after children */
  iconRight?: ReactNode
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled,
      iconLeft,
      iconRight,
      className = '',
      children,
      type = 'button',
      ...rest
    },
    ref
  ) => {
    const isDisabled = disabled || loading

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        className={[
          'inline-flex items-center justify-center font-medium rounded-md',
          'transition-all duration-150 ease-in-out',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          'active:scale-[0.98]',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
          variantClasses[variant],
          variant !== 'link' ? sizeClasses[size] : sizeClasses[size],
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...rest}
      >
        {loading ? (
          <svg
            className="animate-spin h-4 w-4 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        ) : iconLeft ? (
          <span className="shrink-0" aria-hidden="true">
            {iconLeft}
          </span>
        ) : null}
        {children}
        {iconRight && !loading ? (
          <span className="shrink-0" aria-hidden="true">
            {iconRight}
          </span>
        ) : null}
      </button>
    )
  }
)

Button.displayName = 'Button'

export { Button }
