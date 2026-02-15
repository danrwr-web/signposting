'use client'

import { forwardRef, type InputHTMLAttributes } from 'react'

/* ------------------------------------------------------------------ */
/*  Input                                                              */
/* ------------------------------------------------------------------ */

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Show error ring styling */
  error?: boolean
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ error = false, className = '', ...rest }, ref) => {
    return (
      <input
        ref={ref}
        className={[
          'w-full px-3 py-2 rounded-md border text-sm',
          'transition-[color,border-color,box-shadow] duration-150',
          'focus:outline-none focus:ring-2 focus:border-transparent',
          'disabled:opacity-60 disabled:cursor-not-allowed',
          error
            ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
            : 'border-nhs-grey focus:ring-nhs-blue',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...rest}
      />
    )
  }
)

Input.displayName = 'Input'

export { Input }
