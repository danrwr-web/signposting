'use client'

import { Card } from '@/components/ui'

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export interface BusiestTimesCardProps {
  byWeekday: number[]
  byHour: number[]
}

export function BusiestTimesCard({ byWeekday, byHour }: BusiestTimesCardProps) {
  const weekdayMax = Math.max(...byWeekday, 1)
  const hourMax = Math.max(...byHour, 1)
  const hasData = byWeekday.some(v => v > 0) || byHour.some(v => v > 0)

  return (
    <Card elevation="flat" padding="lg">
      <h3 className="mb-1 text-lg font-medium text-gray-900">Busiest Days &amp; Times</h3>
      <p className="mb-4 text-sm text-gray-600">
        When symptom lookups happen — useful for staffing and picking training slots.
      </p>

      {!hasData ? (
        <p className="py-8 text-center text-sm text-gray-500">
          No symptom views recorded in this period.
        </p>
      ) : (
        <>
          <ul className="space-y-1.5">
            {byWeekday.map((views, i) => (
              <li key={WEEKDAY_LABELS[i]} className="flex items-center gap-3">
                <span className="w-9 shrink-0 text-sm text-gray-600">{WEEKDAY_LABELS[i]}</span>
                <div className="relative h-4 flex-1 overflow-hidden rounded-sm bg-gray-100">
                  <div
                    aria-hidden="true"
                    className="absolute inset-y-0 left-0 rounded-sm bg-nhs-blue"
                    style={{ width: `${(views / weekdayMax) * 100}%` }}
                  />
                </div>
                <span className="w-12 shrink-0 text-right text-sm text-gray-600 tabular-nums">
                  {views.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>

          <h4 className="mb-2 mt-5 text-sm font-medium text-gray-700">By hour of day</h4>
          <div className="flex gap-px" role="img" aria-label="Symptom views by hour of day">
            {byHour.map((views, hour) => (
              <div
                key={hour}
                className="h-8 flex-1 rounded-sm"
                style={{
                  backgroundColor: `rgba(0, 94, 184, ${views === 0 ? 0.06 : 0.15 + 0.85 * (views / hourMax)})`,
                }}
                title={`${String(hour).padStart(2, '0')}:00–${String((hour + 1) % 24).padStart(2, '0')}:00 — ${views.toLocaleString()} view${views === 1 ? '' : 's'}`}
              />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-xs text-gray-500">
            <span>00:00</span>
            <span>06:00</span>
            <span>12:00</span>
            <span>18:00</span>
            <span>23:00</span>
          </div>
        </>
      )}

      <p className="mt-4 text-xs text-gray-500">Times shown in UK local time.</p>
    </Card>
  )
}
