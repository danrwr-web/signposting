'use client'

import { forwardRef, type TextareaHTMLAttributes } from 'react'

/* ------------------------------------------------------------------ */
/*  Textarea                                                           */
/* ------------------------------------------------------------------ */

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Show error ring styling */
  error?: boolean
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ error = false, className = '', ...rest }, ref) => {
    return (
      <textarea
        ref={ref}
        className={[
          'w-full px-3 py-2 rounded-md border text-sm',
          'transition-colors',
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

Textarea.displayName = 'Textarea'

export { Textarea }
