'use client'

import Link from 'next/link'
import { type ReactNode } from 'react'

/* ------------------------------------------------------------------ */
/*  SVG illustration presets                                           */
/* ------------------------------------------------------------------ */

type IllustrationName =
  | 'search'
  | 'documents'
  | 'calendar'
  | 'clipboard'
  | 'folder'
  | 'users'
  | 'workflow'

const illustrations: Record<IllustrationName, ReactNode> = {
  search: (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="52" cy="52" r="32" stroke="#D1D5DB" strokeWidth="4" fill="#F9FAFB" />
      <circle cx="52" cy="52" r="20" stroke="#E5E7EB" strokeWidth="2" strokeDasharray="4 4" />
      <line x1="76" y1="76" x2="100" y2="100" stroke="#D1D5DB" strokeWidth="4" strokeLinecap="round" />
      <circle cx="52" cy="46" r="3" fill="#D1D5DB" />
      <path d="M44 60 Q52 66 60 60" stroke="#D1D5DB" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  ),
  documents: (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="28" y="20" width="52" height="68" rx="4" stroke="#D1D5DB" strokeWidth="3" fill="#F9FAFB" />
      <rect x="40" y="32" width="52" height="68" rx="4" stroke="#E5E7EB" strokeWidth="3" fill="white" />
      <line x1="52" y1="48" x2="80" y2="48" stroke="#E5E7EB" strokeWidth="2" strokeLinecap="round" />
      <line x1="52" y1="56" x2="76" y2="56" stroke="#E5E7EB" strokeWidth="2" strokeLinecap="round" />
      <line x1="52" y1="64" x2="72" y2="64" stroke="#E5E7EB" strokeWidth="2" strokeLinecap="round" />
      <line x1="52" y1="72" x2="68" y2="72" stroke="#E5E7EB" strokeWidth="2" strokeLinecap="round" />
      <circle cx="66" cy="84" r="3" fill="#D1D5DB" />
    </svg>
  ),
  calendar: (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="20" y="28" width="80" height="72" rx="6" stroke="#D1D5DB" strokeWidth="3" fill="#F9FAFB" />
      <line x1="20" y1="48" x2="100" y2="48" stroke="#D1D5DB" strokeWidth="3" />
      <line x1="40" y1="20" x2="40" y2="36" stroke="#D1D5DB" strokeWidth="3" strokeLinecap="round" />
      <line x1="80" y1="20" x2="80" y2="36" stroke="#D1D5DB" strokeWidth="3" strokeLinecap="round" />
      {/* Grid cells */}
      {[0, 1, 2, 3].map((row) =>
        [0, 1, 2, 3, 4].map((col) => (
          <rect
            key={`${row}-${col}`}
            x={28 + col * 15}
            y={54 + row * 11}
            width="10"
            height="7"
            rx="1.5"
            fill={row === 1 && col === 2 ? '#D1D5DB' : '#F3F4F6'}
          />
        ))
      )}
    </svg>
  ),
  clipboard: (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="30" y="24" width="60" height="76" rx="6" stroke="#D1D5DB" strokeWidth="3" fill="#F9FAFB" />
      <rect x="44" y="16" width="32" height="16" rx="4" stroke="#D1D5DB" strokeWidth="2" fill="white" />
      <circle cx="60" cy="24" r="3" fill="#D1D5DB" />
      {/* Checklist items */}
      <rect x="42" y="48" width="10" height="10" rx="2" stroke="#E5E7EB" strokeWidth="2" fill="none" />
      <line x1="58" y1="53" x2="78" y2="53" stroke="#E5E7EB" strokeWidth="2" strokeLinecap="round" />
      <rect x="42" y="66" width="10" height="10" rx="2" stroke="#E5E7EB" strokeWidth="2" fill="none" />
      <line x1="58" y1="71" x2="74" y2="71" stroke="#E5E7EB" strokeWidth="2" strokeLinecap="round" />
      <rect x="42" y="84" width="10" height="10" rx="2" stroke="#E5E7EB" strokeWidth="2" fill="none" />
      <line x1="58" y1="89" x2="72" y2="89" stroke="#E5E7EB" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  folder: (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M20 40 L20 88 C20 91.3137 22.6863 94 26 94 L94 94 C97.3137 94 100 91.3137 100 88 L100 44 C100 40.6863 97.3137 38 94 38 L58 38 L50 26 L26 26 C22.6863 26 20 28.6863 20 32 L20 40Z" stroke="#D1D5DB" strokeWidth="3" fill="#F9FAFB" />
      <line x1="40" y1="62" x2="80" y2="62" stroke="#E5E7EB" strokeWidth="2" strokeLinecap="round" />
      <line x1="48" y1="72" x2="72" y2="72" stroke="#E5E7EB" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  users: (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="48" cy="44" r="16" stroke="#D1D5DB" strokeWidth="3" fill="#F9FAFB" />
      <path d="M20 92 C20 76 32 66 48 66 C64 66 76 76 76 92" stroke="#D1D5DB" strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="78" cy="48" r="12" stroke="#E5E7EB" strokeWidth="2" fill="#F9FAFB" />
      <path d="M60 96 C60 82 68 74 78 74 C88 74 96 82 96 96" stroke="#E5E7EB" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  ),
  workflow: (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Top node */}
      <rect x="40" y="16" width="40" height="24" rx="4" stroke="#D1D5DB" strokeWidth="2" fill="#F9FAFB" />
      <line x1="52" y1="28" x2="68" y2="28" stroke="#E5E7EB" strokeWidth="2" strokeLinecap="round" />
      {/* Connector lines */}
      <line x1="60" y1="40" x2="60" y2="50" stroke="#D1D5DB" strokeWidth="2" />
      <line x1="60" y1="50" x2="34" y2="50" stroke="#D1D5DB" strokeWidth="2" />
      <line x1="60" y1="50" x2="86" y2="50" stroke="#D1D5DB" strokeWidth="2" />
      <line x1="34" y1="50" x2="34" y2="56" stroke="#D1D5DB" strokeWidth="2" />
      <line x1="86" y1="50" x2="86" y2="56" stroke="#D1D5DB" strokeWidth="2" />
      {/* Left node */}
      <rect x="14" y="56" width="40" height="24" rx="4" stroke="#D1D5DB" strokeWidth="2" fill="#F9FAFB" />
      <line x1="24" y1="68" x2="44" y2="68" stroke="#E5E7EB" strokeWidth="2" strokeLinecap="round" />
      {/* Right node */}
      <rect x="66" y="56" width="40" height="24" rx="4" stroke="#D1D5DB" strokeWidth="2" fill="#F9FAFB" />
      <line x1="76" y1="68" x2="96" y2="68" stroke="#E5E7EB" strokeWidth="2" strokeLinecap="round" />
      {/* Bottom connector */}
      <line x1="34" y1="80" x2="34" y2="86" stroke="#D1D5DB" strokeWidth="2" />
      <line x1="86" y1="80" x2="86" y2="86" stroke="#D1D5DB" strokeWidth="2" />
      <line x1="34" y1="86" x2="86" y2="86" stroke="#D1D5DB" strokeWidth="2" />
      <line x1="60" y1="86" x2="60" y2="92" stroke="#D1D5DB" strokeWidth="2" />
      {/* Bottom node */}
      <rect x="40" y="92" width="40" height="20" rx="4" stroke="#D1D5DB" strokeWidth="2" fill="#F9FAFB" />
      <line x1="50" y1="102" x2="70" y2="102" stroke="#E5E7EB" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
}

/* ------------------------------------------------------------------ */
/*  EmptyState component                                               */
/* ------------------------------------------------------------------ */

export interface EmptyStateProps {
  /** Heading text */
  title: string
  /** Optional description text below the heading */
  description?: string
  /** SVG illustration to display above the title */
  illustration?: IllustrationName
  /** Primary action - supports either onClick or href for navigation */
  action?: {
    label: string
    onClick?: () => void
    href?: string
    /** Button variant - defaults to primary */
    variant?: 'primary' | 'secondary'
  }
  /** Secondary action (rendered as a text link-style button) */
  secondaryAction?: {
    label: string
    onClick?: () => void
    href?: string
  }
  /** Additional className for the container */
  className?: string
}

function EmptyState({
  title,
  description,
  illustration,
  action,
  secondaryAction,
  className = '',
}: EmptyStateProps) {
  const actionVariantClasses =
    action?.variant === 'secondary'
      ? 'bg-white text-nhs-blue border border-nhs-blue hover:bg-blue-50'
      : 'bg-nhs-blue text-white hover:bg-nhs-dark-blue'

  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}>
      {illustration && (
        <div className="mb-6">{illustrations[illustration]}</div>
      )}
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-gray-500 max-w-md mb-6">{description}</p>
      )}
      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {action && (
            action.href ? (
              <Link
                href={action.href}
                className={`inline-flex items-center justify-center rounded-md px-4 py-2.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2 ${actionVariantClasses}`}
              >
                {action.label}
              </Link>
            ) : (
              <button
                type="button"
                onClick={action.onClick}
                className={`inline-flex items-center justify-center rounded-md px-4 py-2.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2 ${actionVariantClasses}`}
              >
                {action.label}
              </button>
            )
          )}
          {secondaryAction && (
            secondaryAction.href ? (
              <Link
                href={secondaryAction.href}
                className="text-sm text-gray-500 hover:text-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2 rounded-md px-3 py-2"
              >
                {secondaryAction.label}
              </Link>
            ) : (
              <button
                type="button"
                onClick={secondaryAction.onClick}
                className="text-sm text-gray-500 hover:text-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-nhs-blue focus:ring-offset-2 rounded-md px-3 py-2"
              >
                {secondaryAction.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  )
}

export type { IllustrationName }
export { EmptyState }
