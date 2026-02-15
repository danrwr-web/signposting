'use client'

import { forwardRef, type SelectHTMLAttributes } from 'react'

/* ------------------------------------------------------------------ */
/*  Select                                                             */
/* ------------------------------------------------------------------ */

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  /** Show error ring styling */
  error?: boolean
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ error = false, className = '', children, ...rest }, ref) => {
    return (
      <select
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
      >
        {children}
      </select>
    )
  }
)

Select.displayName = 'Select'

export { Select }
