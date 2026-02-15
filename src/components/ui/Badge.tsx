'use client'

import { type HTMLAttributes, type ReactNode } from 'react'

/* ------------------------------------------------------------------ */
/*  Colour presets                                                     */
/* ------------------------------------------------------------------ */

const colorClasses = {
  blue: 'bg-blue-100 text-blue-800',
  green: 'bg-green-100 text-green-800',
  red: 'bg-red-100 text-red-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  amber: 'bg-amber-100 text-amber-800',
  purple: 'bg-purple-100 text-purple-800',
  gray: 'bg-gray-100 text-gray-800',
  'nhs-blue': 'bg-nhs-blue text-white',
  'nhs-green': 'bg-nhs-green text-white',
  'nhs-red': 'bg-nhs-red text-white',
} as const

const sizeClasses = {
  sm: 'px-1.5 py-0.5 text-[11px]',
  md: 'px-2.5 py-0.5 text-xs',
  lg: 'px-3 py-1 text-sm',
} as const

export type BadgeColor = keyof typeof colorClasses
export type BadgeSize = keyof typeof sizeClasses

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  color?: BadgeColor
  size?: BadgeSize
  /** Use pill shape (fully rounded) vs slightly rounded */
  pill?: boolean
  children: ReactNode
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function Badge({
  color = 'gray',
  size = 'md',
  pill = true,
  className = '',
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center font-medium whitespace-nowrap',
        pill ? 'rounded-full' : 'rounded',
        colorClasses[color],
        sizeClasses[size],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </span>
  )
}
