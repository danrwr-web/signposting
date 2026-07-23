'use client'

import { Badge, Card, EmptyState } from '@/components/ui'
import type { EngagementTopRes } from '@/lib/api-contracts'
import { ageGroupBadgeColor } from './ageGroupBadge'

export interface LeastViewedCardProps {
  insights: EngagementTopRes['insights']
  hideAgeBands: boolean
}

export function LeastViewedCard({ insights, hideAgeBands }: LeastViewedCardProps) {
  const { leastViewed, neverViewedCount, trackedSymptomCount } = insights

  return (
    <Card elevation="flat" padding="lg">
      <h3 className="mb-1 text-lg font-medium text-gray-900">Least Viewed Symptoms</h3>
      <p className="mb-4 text-sm text-gray-600">
        {neverViewedCount > 0
          ? `${neverViewedCount.toLocaleString()} of ${trackedSymptomCount.toLocaleString()} symptoms had no views in this period.`
          : `All ${trackedSymptomCount.toLocaleString()} symptoms were viewed at least once in this period.`}
      </p>
      {leastViewed.length === 0 ? (
        <EmptyState
          illustration="search"
          title="No symptoms to report"
          description="There are no symptoms in the library for this view yet."
        />
      ) : (
        <ul className="space-y-2">
          {leastViewed.map(symptom => (
            <li
              key={symptom.id}
              className="flex items-center justify-between gap-3 rounded-md bg-gray-50 px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-medium text-gray-900">{symptom.name}</span>
                {!hideAgeBands && (
                  <Badge color={ageGroupBadgeColor(symptom.ageGroup)} size="sm">
                    {symptom.ageGroup}
                  </Badge>
                )}
              </div>
              <span className="shrink-0 text-sm text-gray-500 tabular-nums">
                {symptom.viewCount === 0
                  ? 'No views'
                  : `${symptom.viewCount.toLocaleString()} view${symptom.viewCount === 1 ? '' : 's'}`}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs text-gray-500">
        Views are only recorded for library symptoms, so surgery-created custom symptoms are not
        included here.
      </p>
    </Card>
  )
}
