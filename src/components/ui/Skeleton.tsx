'use client'

import { type HTMLAttributes } from 'react'

/* ------------------------------------------------------------------ */
/*  Base Skeleton                                                      */
/*  A single animated placeholder shape.                               */
/* ------------------------------------------------------------------ */

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** Width as Tailwind class (e.g. "w-24", "w-full") */
  width?: string
  /** Height as Tailwind class (e.g. "h-4", "h-8") */
  height?: string
  /** Rounded variant */
  rounded?: 'sm' | 'md' | 'lg' | 'full' | 'xl'
}

const roundedClasses = {
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  full: 'rounded-full',
  xl: 'rounded-xl',
} as const

function Skeleton({
  width = 'w-full',
  height = 'h-4',
  rounded = 'md',
  className = '',
  ...rest
}: SkeletonProps) {
  return (
    <div
      className={[
        'animate-pulse bg-gray-200',
        roundedClasses[rounded],
        width,
        height,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    />
  )
}

/* ------------------------------------------------------------------ */
/*  SkeletonText                                                       */
/*  Multiple lines of skeleton text, mimicking a paragraph.            */
/* ------------------------------------------------------------------ */

export interface SkeletonTextProps {
  /** Number of text lines */
  lines?: number
  /** Gap between lines */
  gap?: 'sm' | 'md'
  className?: string
}

function SkeletonText({ lines = 3, gap = 'sm', className = '' }: SkeletonTextProps) {
  const gapClass = gap === 'sm' ? 'space-y-2' : 'space-y-3'
  const widths = ['w-full', 'w-5/6', 'w-2/3', 'w-4/5', 'w-3/4']

  return (
    <div className={`${gapClass} ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} height="h-3" width={widths[i % widths.length]} />
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  SkeletonCard                                                       */
/*  A card-shaped skeleton matching the app's Card component.          */
/* ------------------------------------------------------------------ */

export interface SkeletonCardProps {
  /** Whether to show a "badge" placeholder */
  showBadge?: boolean
  /** Number of body text lines */
  lines?: number
  className?: string
}

function SkeletonCard({ showBadge = false, lines = 3, className = '' }: SkeletonCardProps) {
  return (
    <div
      className={`rounded-lg border border-gray-200 bg-white p-4 shadow-sm animate-pulse ${className}`}
    >
      <div className="flex items-start justify-between mb-3">
        <Skeleton height="h-5" width="w-2/5" />
        {showBadge && <Skeleton height="h-5" width="w-16" rounded="full" />}
      </div>
      <SkeletonText lines={lines} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  SkeletonTable                                                      */
/*  A table-shaped skeleton with header + rows.                        */
/* ------------------------------------------------------------------ */

export interface SkeletonTableProps {
  /** Number of columns */
  columns?: number
  /** Number of body rows */
  rows?: number
  className?: string
}

function SkeletonTable({ columns = 4, rows = 5, className = '' }: SkeletonTableProps) {
  const colWidths = ['w-1/4', 'w-1/3', 'w-1/5', 'w-2/5', 'w-1/6']

  return (
    <div className={`bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden ${className}`}>
      <div className="animate-pulse">
        {/* Header */}
        <div className="flex gap-4 px-4 py-3 bg-gray-50 border-b border-gray-200">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} height="h-4" width={colWidths[i % colWidths.length]} />
          ))}
        </div>
        {/* Rows */}
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div
            key={rowIndex}
            className={`flex gap-4 px-4 py-3 ${rowIndex < rows - 1 ? 'border-b border-gray-100' : ''}`}
          >
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton key={colIndex} height="h-3" width={colWidths[colIndex % colWidths.length]} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Layout-specific skeletons                                          */
/* ------------------------------------------------------------------ */

/** Grid of skeleton cards (matches symptom/appointment card grids) */
export interface SkeletonCardGridProps {
  /** Number of skeleton cards */
  count?: number
  /** Grid column classes */
  gridCols?: string
  /** Whether cards should show badges */
  showBadge?: boolean
  /** Number of text lines per card */
  lines?: number
  className?: string
}

function SkeletonCardGrid({
  count = 8,
  gridCols = 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  showBadge = false,
  lines = 3,
  className = '',
}: SkeletonCardGridProps) {
  return (
    <div className={`grid ${gridCols} gap-6 ${className}`} role="status" aria-live="polite">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} showBadge={showBadge} lines={lines} />
      ))}
      <span className="sr-only">Loading content…</span>
    </div>
  )
}

/** Workflow card skeleton (matches the wider, horizontal WorkflowCard layout) */
function SkeletonWorkflowCard({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-6 animate-pulse ${className}`}>
      <div className="flex items-start gap-4">
        {/* Icon */}
        <Skeleton height="h-11" width="w-11" rounded="lg" className="flex-none" />
        {/* Content */}
        <div className="flex-1 min-w-0">
          <Skeleton height="h-5" width="w-1/3" className="mb-2" />
          <Skeleton height="h-4" width="w-2/3" />
        </div>
      </div>
      <div className="mt-4">
        <Skeleton height="h-10" width="w-32" rounded="lg" />
      </div>
    </div>
  )
}

/** Admin Toolkit sidebar + grid skeleton */
function SkeletonAdminToolkit({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-white rounded-lg shadow-md border border-gray-200 ${className}`}>
      {/* Header zone */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 animate-pulse">
        <Skeleton height="h-4" width="w-24" />
        <Skeleton height="h-4" width="w-20" />
      </div>

      {/* Search zone */}
      <div className="border-b border-gray-200 px-4 py-3 animate-pulse">
        <Skeleton height="h-10" width="w-full" rounded="lg" />
      </div>

      {/* Sidebar + content */}
      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr]">
        {/* Sidebar */}
        <aside className="border-b md:border-b-0 md:border-r border-gray-200 bg-gray-50 p-4 animate-pulse">
          <Skeleton height="h-3" width="w-20" className="mb-4" />
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} height="h-8" width="w-full" rounded="md" />
            ))}
          </div>
        </aside>
        {/* Content grid */}
        <section className="p-4">
          <SkeletonCardGrid
            count={6}
            gridCols="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
            lines={2}
          />
        </section>
      </div>
    </div>
  )
}

export {
  Skeleton,
  SkeletonText,
  SkeletonCard,
  SkeletonTable,
  SkeletonCardGrid,
  SkeletonWorkflowCard,
  SkeletonAdminToolkit,
}
