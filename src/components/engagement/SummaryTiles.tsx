'use client'

import { Card } from '@/components/ui'
import type { EngagementTopRes } from '@/lib/api-contracts'

/** Whole-percent change vs the previous period; null when not computable. */
export function percentDelta(current: number, previous: number): number | null {
  if (previous <= 0) return null
  return Math.round(((current - previous) / previous) * 100)
}

function DeltaChip({ delta, periodLabel }: { delta: number | null; periodLabel: string }) {
  if (delta === null) return null
  const up = delta > 0
  const flat = delta === 0
  const tone = flat
    ? 'bg-gray-100 text-gray-600'
    : up
      ? 'bg-green-100 text-green-800'
      : 'bg-red-100 text-red-700'
  return (
    <span
      className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}
    >
      {!flat && <span aria-hidden="true">{up ? '▲' : '▼'}</span>}
      {flat ? 'No change' : `${up ? '+' : ''}${delta}%`}
      <span className="font-normal">vs previous {periodLabel}</span>
    </span>
  )
}

export interface SummaryTilesProps {
  totals: EngagementTopRes['totals']
  previousTotals: EngagementTopRes['previousTotals']
  /** e.g. "7 days" — names the comparison window on the delta chips. */
  periodLabel: string
  isSuperuser: boolean
}

export function SummaryTiles({ totals, previousTotals, periodLabel, isSuperuser }: SummaryTilesProps) {
  const showSurgeries = isSuperuser && totals.activeSurgeries !== null
  const tiles = [
    {
      label: 'Total symptom views',
      value: totals.totalViews,
      valueClass: 'text-nhs-blue',
      delta: previousTotals ? percentDelta(totals.totalViews, previousTotals.totalViews) : null,
    },
    {
      label: 'Active users',
      value: totals.distinctUsers,
      valueClass: 'text-nhs-green',
      delta: previousTotals ? percentDelta(totals.distinctUsers, previousTotals.distinctUsers) : null,
    },
    {
      label: 'Symptoms accessed',
      value: totals.distinctSymptoms,
      valueClass: 'text-purple-600',
      delta: null,
    },
    ...(showSurgeries
      ? [
          {
            label: 'Active surgeries',
            value: totals.activeSurgeries as number,
            valueClass: 'text-nhs-dark-blue',
            delta: null,
          },
        ]
      : []),
  ]

  return (
    <div className={`grid grid-cols-2 gap-4 ${showSurgeries ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
      {tiles.map(tile => (
        <Card key={tile.label} elevation="flat" padding="md">
          <p className="text-sm text-gray-600">{tile.label}</p>
          <p className={`mt-1 text-3xl font-bold ${tile.valueClass}`}>
            {tile.value.toLocaleString()}
          </p>
          <DeltaChip delta={tile.delta} periodLabel={periodLabel} />
        </Card>
      ))}
    </div>
  )
}
