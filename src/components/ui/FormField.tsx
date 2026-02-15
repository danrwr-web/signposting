'use client'

import { type ReactNode } from 'react'

/* ------------------------------------------------------------------ */
/*  FormField — label + input + error wrapper                          */
/* ------------------------------------------------------------------ */

export interface FormFieldProps {
  /** Label text (also used to build htmlFor + error id) */
  label: string
  /** Optional htmlFor / id override */
  htmlFor?: string
  /** Error message string — shows styled error and sets aria-describedby on children */
  error?: string
  /** Visually required indicator (*) */
  required?: boolean
  /** The form control (Input, Select, Textarea, etc.) */
  children: ReactNode
  className?: string
}

export function FormField({
  label,
  htmlFor,
  error,
  required = false,
  children,
  className = '',
}: FormFieldProps) {
  const errorId = htmlFor ? `${htmlFor}-error` : undefined

  return (
    <div className={`mb-4 ${className}`}>
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-nhs-grey mb-1"
      >
        {label}
        {required && <span className="text-nhs-red ml-0.5">*</span>}
      </label>
      {children}
      {error && (
        <p
          id={errorId}
          role="alert"
          className="mt-1 text-sm text-red-600"
        >
          {error}
        </p>
      )}
    </div>
  )
}
