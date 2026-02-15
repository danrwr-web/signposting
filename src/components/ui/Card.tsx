'use client'

import { forwardRef, type HTMLAttributes, type ReactNode } from 'react'

/* ------------------------------------------------------------------ */
/*  Elevation presets                                                   */
/* ------------------------------------------------------------------ */

const elevationClasses = {
  flat: 'border border-gray-200',
  raised: 'border border-gray-100 shadow-sm',
  elevated: 'border border-gray-200 shadow-md',
  floating: 'shadow-xl',
} as const

export type CardElevation = keyof typeof elevationClasses

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  elevation?: CardElevation
  /** Apply hover lift effect (shadow increase on hover) */
  hoverable?: boolean
  /** Padding preset */
  padding?: 'none' | 'sm' | 'md' | 'lg'
  children: ReactNode
}

const paddingClasses = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
} as const

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      elevation = 'elevated',
      hoverable = false,
      padding = 'md',
      className = '',
      children,
      ...rest
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={[
          'bg-white rounded-lg',
          elevationClasses[elevation],
          hoverable && 'hover:shadow-lg hover:-translate-y-0.5 transition-[box-shadow,transform] duration-200 ease-out cursor-pointer',
          paddingClasses[padding],
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...rest}
      >
        {children}
      </div>
    )
  }
)

Card.displayName = 'Card'

export { Card }
