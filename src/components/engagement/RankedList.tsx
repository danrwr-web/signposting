'use client'

import { type ReactNode } from 'react'

export interface RankedListItem {
  key: string
  label: string
  /** Optional element rendered after the label (e.g. an age-group Badge). */
  badge?: ReactNode
  /** Optional action rendered after the badge (e.g. a drill-in link). */
  action?: ReactNode
  count: number
  unit: string
}

export interface RankedListProps {
  items: RankedListItem[]
  /** Tailwind text colour class for the count figure. */
  countClass?: string
  /** Tailwind background class for the proportional bar fill. */
  barClass?: string
}

/**
 * Ranked list with a proportional background bar per row, so relative volume
 * is readable at a glance without a separate chart.
 */
export function RankedList({
  items,
  countClass = 'text-nhs-blue',
  barClass = 'bg-nhs-blue/10',
}: RankedListProps) {
  const max = Math.max(...items.map(i => i.count), 1)

  return (
    <ol className="space-y-2">
      {items.map((item, index) => (
        <li key={item.key} className="relative overflow-hidden rounded-md bg-gray-50">
          <div
            aria-hidden="true"
            className={`absolute inset-y-0 left-0 ${barClass}`}
            style={{ width: `${(item.count / max) * 100}%` }}
          />
          <div className="relative flex items-center justify-between gap-3 px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <span className="w-7 shrink-0 text-sm font-medium text-gray-500 tabular-nums">
                #{index + 1}
              </span>
              <span className="truncate text-sm font-medium text-gray-900">{item.label}</span>
              {item.badge}
              {item.action}
            </div>
            <div className="shrink-0 text-right">
              <span className={`text-base font-semibold tabular-nums ${countClass}`}>
                {item.count.toLocaleString()}
              </span>
              <p className="text-xs text-gray-500">{item.unit}</p>
            </div>
          </div>
        </li>
      ))}
    </ol>
  )
}
